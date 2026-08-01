import type { Env } from "../types";
import { getCatalog } from "./store";
import { llmsTxt } from "./docs";
import { SET_INFO } from "./pages";

// Explicitly welcome AI crawlers + search engines and advertise our discovery files.
export function robotsTxt(origin: string): string {
  const agents = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-User",
    "Claude-SearchBot",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Googlebot",
    "Bingbot",
    "Applebot",
    "Applebot-Extended",
    "CCBot",
    "Amazonbot",
    "Bytespider",
    "cohere-ai",
    "DuckAssistBot",
    "meta-externalagent",
    "Timpibot",
    "YouBot",
  ];
  const blocks = agents.map((a) => `User-agent: ${a}\nAllow: /`).join("\n\n");
  return `# IconServe — AI agents and crawlers are welcome.
# Machine-readable API docs: ${origin}/llms.txt  and  ${origin}/llms-full.txt

${blocks}

User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

// One sitemap listing the landing page + every per-icon HTML page (well under the 50k-URL cap).
export async function sitemapXml(env: Env, origin: string): Promise<string> {
  const catalog = await getCatalog(env);
  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [
    `  <url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${origin}/for-ai-agents</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
  ];
  for (const e of catalog.entries) {
    urls.push(`  <url><loc>${origin}/icon/${e.set}/${e.name}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

// A fuller, self-contained doc some agents fetch as "llms-full.txt": the standard llms.txt
// plus the complete set inventory and a compact worked example.
export async function llmsFullTxt(env: Env, origin: string): Promise<string> {
  const base = await llmsTxt(env, origin);
  const catalog = await getCatalog(env);
  const counts: Record<string, number> = {};
  for (const e of catalog.entries) counts[e.set] = (counts[e.set] || 0) + 1;

  const setLines = Object.entries(counts)
    .map(([set, n]) => {
      const info = SET_INFO[set];
      return `- ${info?.label || set} (${set}): ${n} icons, ${info ? info.homepage : ""}`;
    })
    .join("\n");

  return `${base}
## Per-icon pages (human + crawler readable)

Every icon also has an HTML page with preview, usage, and structured data:
  ${origin}/icon/{set}/{name}     e.g. ${origin}/icon/lucide/house
These are all listed in ${origin}/sitemap.xml

## Set inventory

${setLines}

## Worked example (agent workflow)

1. Not sure of the name? Search:
     GET ${origin}/api/search?q=notification%20bell&limit=3
2. Take results[0].name and embed the SVG:
     <img src="${origin}/i/bell.svg?color=%234f46e5&size=24">
3. Need a raster for a canvas/email:
     ${origin}/i/bell.svg?format=png&size=128
4. Pin a specific look:
     ${origin}/icons/tabler/bell.svg?style=filled

That's the whole surface. No key, no rate signup, CORS open.
`;
}
