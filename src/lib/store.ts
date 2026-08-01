import type { Env, CatalogEntry } from "../types";

// Packed artifacts live in R2 under these keys (see scripts/upload.mjs).
const K_ICONS = "pack/icons.json";
const K_CATALOG = "pack/catalog.json";
const K_EMB = "pack/embeddings.bin";
const K_EMB_INDEX = "pack/embed-index.json";

// Module-global caches: populated once per isolate, reused across requests.
let iconsP: Promise<Record<string, string>> | null = null;
let catalogP: Promise<Catalog> | null = null;
let embP: Promise<Embeddings | null> | null = null;

export interface Catalog {
  entries: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
  byName: Map<string, CatalogEntry[]>; // name -> entries across sets
}

export interface Embeddings {
  dim: number;
  ids: string[];
  matrix: Float32Array; // ids.length * dim, row-major, L2-normalized
}

async function r2Text(env: Env, key: string): Promise<string> {
  const obj = await env.ICONS.get(key);
  if (!obj) throw new Error(`missing R2 object: ${key} (run: npm run upload:r2)`);
  return obj.text();
}

export function getIcons(env: Env): Promise<Record<string, string>> {
  if (!iconsP) iconsP = r2Text(env, K_ICONS).then((t) => JSON.parse(t));
  return iconsP;
}

export function getCatalog(env: Env): Promise<Catalog> {
  if (!catalogP) {
    catalogP = r2Text(env, K_CATALOG).then((t) => {
      const entries: CatalogEntry[] = JSON.parse(t);
      const byId = new Map<string, CatalogEntry>();
      const byName = new Map<string, CatalogEntry[]>();
      for (const e of entries) {
        byId.set(e.id, e);
        const list = byName.get(e.name) || [];
        list.push(e);
        byName.set(e.name, list);
      }
      return { entries, byId, byName };
    });
  }
  return catalogP;
}

export function getEmbeddings(env: Env): Promise<Embeddings | null> {
  if (!embP) {
    embP = (async () => {
      const idxObj = await env.ICONS.get(K_EMB_INDEX);
      const binObj = await env.ICONS.get(K_EMB);
      if (!idxObj || !binObj) return null; // semantic search gracefully disabled
      const ids: string[] = JSON.parse(await idxObj.text());
      const buf = await binObj.arrayBuffer();
      const matrix = new Float32Array(buf);
      const dim = ids.length ? matrix.length / ids.length : 0;
      return { ids, matrix, dim };
    })().catch(() => null);
  }
  return embP;
}

// Resolve a set-agnostic name to the best entry using the configured set priority.
export function resolveBest(catalog: Catalog, name: string, order: string[]): CatalogEntry | null {
  const list = catalog.byName.get(name);
  if (!list || !list.length) return null;
  const rank = (s: string) => {
    const i = order.indexOf(s);
    return i === -1 ? order.length : i;
  };
  return [...list].sort((a, b) => rank(a.set) - rank(b.set))[0];
}
