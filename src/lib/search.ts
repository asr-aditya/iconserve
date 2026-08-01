import type { Env, CatalogEntry } from "../types";
import { getCatalog, getEmbeddings, type Catalog } from "./store";

export interface SearchHit {
  entry: CatalogEntry;
  score: number;
}

const EMB_MODEL = "@cf/baai/bge-small-en-v1.5";

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Lexical scoring over name / title / tags / aliases.
function keywordRank(catalog: Catalog, query: string, pool?: Set<string>): CatalogEntry[] {
  const q = query.toLowerCase().trim();
  const toks = tokenize(q);
  if (!toks.length) return [];
  const scored: { e: CatalogEntry; s: number }[] = [];

  for (const e of catalog.entries) {
    if (pool && !pool.has(e.id)) continue;
    let s = 0;
    const name = e.name.toLowerCase();
    if (name === q) s += 100;
    else if (name.replace(/[-_]/g, "") === q.replace(/[-_ ]/g, "")) s += 80;
    else if (name.startsWith(q)) s += 40;
    else if (name.includes(q)) s += 20;

    const title = e.title.toLowerCase();
    if (title === q) s += 60;

    const tagSet = new Set(e.tags);
    const aliasSet = new Set(e.aliases);
    for (const t of toks) {
      if (name.includes(t)) s += 8;
      if (title.includes(t)) s += 5;
      if (tagSet.has(t)) s += 6;
      if (aliasSet.has(t)) s += 6;
      for (const tag of e.tags) if (tag.includes(t)) { s += 2; break; }
    }
    if (s > 0) scored.push({ e, s });
  }

  scored.sort((a, b) => b.s - a.s || a.e.id.localeCompare(b.e.id));
  return scored.map((x) => x.e);
}

async function embedQuery(env: Env, query: string): Promise<Float32Array | null> {
  try {
    const res: any = await env.AI.run(EMB_MODEL, { text: [query] });
    const v = res?.data?.[0];
    if (!Array.isArray(v)) return null;
    const arr = Float32Array.from(v);
    // L2 normalize so dot product == cosine similarity.
    let norm = 0;
    for (const x of arr) norm += x * x;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < arr.length; i++) arr[i] /= norm;
    return arr;
  } catch {
    return null;
  }
}

function semanticRank(qv: Float32Array, emb: { ids: string[]; matrix: Float32Array; dim: number }, topN: number): string[] {
  const { ids, matrix, dim } = emb;
  const sims = new Array(ids.length);
  for (let i = 0; i < ids.length; i++) {
    let dot = 0;
    const off = i * dim;
    for (let j = 0; j < dim; j++) dot += matrix[off + j] * qv[j];
    sims[i] = { id: ids[i], s: dot };
  }
  sims.sort((a, b) => b.s - a.s);
  return sims.slice(0, topN).map((x) => x.id);
}

// Reciprocal-rank fusion: scale-free blend of the lexical and semantic rankings.
function rrf(lists: string[][], k = 60): Map<string, number> {
  const acc = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, i) => acc.set(id, (acc.get(id) || 0) + 1 / (k + i + 1)));
  }
  return acc;
}

export async function search(env: Env, query: string, limit: number, set?: string): Promise<SearchHit[]> {
  const catalog = await getCatalog(env);
  const pool = set ? new Set(catalog.entries.filter((e) => e.set === set).map((e) => e.id)) : undefined;

  const kw = keywordRank(catalog, query, pool);
  const kwIds = kw.map((e) => e.id).slice(0, 200);

  const emb = await getEmbeddings(env);
  let semIds: string[] = [];
  if (emb && emb.ids.length) {
    const qv = await embedQuery(env, query);
    if (qv && qv.length === emb.dim) {
      semIds = semanticRank(qv, emb, 200);
      if (pool) semIds = semIds.filter((id) => pool.has(id));
    }
  }

  if (!semIds.length) {
    // keyword-only fallback
    return kw.slice(0, limit).map((e) => ({ entry: e, score: 1 }));
  }

  const fused = rrf([kwIds, semIds]);
  const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]);
  const hits: SearchHit[] = [];
  for (const [id, score] of ranked) {
    const entry = catalog.byId.get(id);
    if (entry) hits.push({ entry, score });
    if (hits.length >= limit) break;
  }
  return hits;
}
