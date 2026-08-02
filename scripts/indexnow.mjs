#!/usr/bin/env node
// Ping IndexNow (Bing, Yandex, et al.) so pages get crawled in minutes instead of
// waiting for the sitemap to be discovered.
//
// Usage:
//   node scripts/indexnow.mjs                       # submit every URL in the live sitemap
//   node scripts/indexnow.mjs /icon/lucide/house    # submit only the given path(s)
//   node scripts/indexnow.mjs https://.../icon/...   # absolute URLs work too
//
// The key is read from wrangler.toml (INDEXNOW_KEY) and must match the key file the
// Worker serves at /{key}.txt.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "icons-for-agents.site";
const ORIGIN = `https://${HOST}`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH = 10000; // IndexNow max URLs per request

function readKey() {
  const toml = readFileSync(join(ROOT, "wrangler.toml"), "utf8");
  const m = toml.match(/INDEXNOW_KEY\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("INDEXNOW_KEY not found in wrangler.toml");
  return m[1];
}

async function sitemapUrls() {
  const res = await fetch(`${ORIGIN}/sitemap.xml`, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function toAbsolute(arg) {
  if (arg.startsWith("http://") || arg.startsWith("https://")) return arg;
  return `${ORIGIN}${arg.startsWith("/") ? "" : "/"}${arg}`;
}

async function submit(key, urlList) {
  const body = { host: HOST, key, keyLocation: `${ORIGIN}/${key}.txt`, urlList };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  return { status: res.status, text };
}

async function main() {
  const key = readKey();
  const args = process.argv.slice(2);
  const urls = args.length ? args.map(toAbsolute) : await sitemapUrls();

  console.log(`IndexNow: submitting ${urls.length} URL(s) with key ${key.slice(0, 8)}…`);

  for (let i = 0; i < urls.length; i += BATCH) {
    const chunk = urls.slice(i, i + BATCH);
    const { status, text } = await submit(key, chunk);
    // 200 = accepted, 202 = accepted (pending validation). Both are success.
    const ok = status === 200 || status === 202;
    console.log(`  batch ${i / BATCH + 1}: ${chunk.length} URLs -> HTTP ${status} ${ok ? "✓" : "✗ " + text.slice(0, 120)}`);
    if (!ok) process.exitCode = 1;
  }
  console.log("Done. (Bing may take a little while to reflect the crawl.)");
}

main().catch((e) => {
  console.error("IndexNow error:", e.message);
  process.exit(1);
});
