import type { Env, CatalogEntry } from "../types";
import { getCatalog, getIcons, resolveBest } from "./store";
import { applyTransforms } from "./transform";
import { svgUrl } from "./urls";
import { markdown } from "./http";
import { discoveryLinkHeader } from "./wellknown";

export const SET_INFO: Record<string, { label: string; homepage: string; licenseUrl: string }> = {
  lucide: { label: "Lucide", homepage: "https://lucide.dev", licenseUrl: "https://opensource.org/license/isc-license-txt" },
  heroicons: { label: "Heroicons", homepage: "https://heroicons.com", licenseUrl: "https://opensource.org/license/mit" },
  tabler: { label: "Tabler", homepage: "https://tabler.io/icons", licenseUrl: "https://opensource.org/license/mit" },
  "simple-icons": { label: "Simple Icons", homepage: "https://simpleicons.org", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const PAGE_CSS = `
:root{--bg:#fff;--fg:#111418;--muted:#5b6572;--line:#e6e8eb;--card:#f7f8fa;--accent:#4f46e5;--code:#f2f3f5}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9aa4b2;--line:#232a33;--card:#161b22;--accent:#8b8bff;--code:#161b22}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:32px 20px 72px}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
nav{font-size:.85rem;color:var(--muted);margin-bottom:20px}
.hero{display:flex;gap:22px;align-items:center;border:1px solid var(--line);background:var(--card);border-radius:14px;padding:22px;margin-bottom:22px;flex-wrap:wrap}
.hero .art{width:96px;height:96px;flex:0 0 auto}.hero .art svg{width:96px;height:96px;color:var(--fg)}
.hero h1{margin:0 0 4px;font-size:1.5rem;letter-spacing:-.02em}.hero .sub{color:var(--muted);font-size:.92rem}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.pill{font-size:.72rem;background:var(--line);color:var(--muted);padding:3px 9px;border-radius:999px}
h2{font-size:1.05rem;margin:26px 0 8px}code{background:var(--code);padding:2px 6px;border-radius:6px;font:.86em ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--code);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow-x:auto;font-size:.83rem}pre code{background:none;padding:0}
.styles a,.rel a{display:inline-block;margin:0 8px 6px 0;padding:5px 11px;border:1px solid var(--line);border-radius:8px;font-size:.85rem}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:.83rem}
`;

export async function renderIconPage(env: Env, origin: string, set: string, name: string): Promise<Response | null> {
  const catalog = await getCatalog(env);
  const entry = catalog.byId.get(`${set}/${name}`);
  if (!entry) return null;

  const icons = await getIcons(env);
  const raw = icons[`${entry.set}/${entry.name}/${entry.defaultStyle}`];
  if (!raw) return null;
  const preview = applyTransforms(raw, { size: 96, color: null, stroke: null });

  const info = SET_INFO[entry.set];
  const url = svgUrl(origin, entry);
  const pngUrl = `${url}?format=png&size=128`;
  const pageUrl = `${origin}/icon/${entry.set}/${entry.name}`;
  const desc = `Free ${entry.title} icon from ${info?.label || entry.set} (${entry.license}). Download as SVG or PNG, recolor and resize via URL. ${entry.tags.slice(0, 6).join(", ")}`.trim();

  const related = (catalog.byName.get(entry.name) || []).filter((e) => e.set !== entry.set);

  const jsonld = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: `${entry.title} icon (${info?.label || entry.set})`,
    description: desc,
    contentUrl: url,
    thumbnailUrl: pngUrl,
    encodingFormat: "image/svg+xml",
    license: info?.licenseUrl,
    isAccessibleForFree: true,
    keywords: entry.tags.join(", "),
    creator: { "@type": "Organization", name: info?.label || entry.set, url: info?.homepage },
    mainEntityOfPage: pageUrl,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "IconServe", item: origin },
      { "@type": "ListItem", position: 2, name: info?.label || entry.set, item: `${origin}/?set=${entry.set}` },
      { "@type": "ListItem", position: 3, name: entry.title, item: pageUrl },
    ],
  };

  const stylesHtml = entry.styles
    .map((s) => `<a href="${url}?style=${s}">${s}</a>`)
    .join("");
  const relatedHtml = related.length
    ? `<h2>Same name in other sets</h2><div class="rel">${related
        .map((e) => `<a href="${origin}/icon/${e.set}/${e.name}">${e.set}</a>`)
        .join("")}</div>`
    : "";
  const tagsHtml = entry.tags.length
    ? `<div class="pills">${entry.tags.slice(0, 14).map((t) => `<a class="pill" href="${origin}/?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div>`
    : "";

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(entry.title)} icon — ${esc(info?.label || entry.set)} · IconServe</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${pageUrl}">
<link rel="alternate" type="text/markdown" href="${pageUrl}.md">
<meta property="og:title" content="${esc(entry.title)} icon (${esc(info?.label || entry.set)})">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${pngUrl}">
<meta property="og:type" content="website">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<style>${PAGE_CSS}</style></head><body><div class="wrap">
<nav><a href="${origin}/">IconServe</a> / <a href="${origin}/?set=${entry.set}">${esc(info?.label || entry.set)}</a> / ${esc(entry.title)}</nav>
<div class="hero">
  <div class="art">${preview}</div>
  <div>
    <h1>${esc(entry.title)}</h1>
    <div class="sub"><code>${esc(entry.name)}</code> · ${esc(info?.label || entry.set)} · ${esc(entry.license)} · styles: ${entry.styles.join(", ")}</div>
    ${tagsHtml}
  </div>
</div>

<h2>Direct URL</h2>
<pre><code>${esc(url)}</code></pre>

<h2>Use it</h2>
<pre><code>&lt;img src="${esc(url)}" alt="${esc(entry.title)}" width="24" height="24"&gt;

![${esc(entry.name)}](${esc(url)})

# recolor / resize / rasterize
${esc(url)}?color=%234f46e5&amp;size=48
${esc(pngUrl)}</code></pre>

<h2>Styles</h2><div class="styles">${stylesHtml}</div>

<h2>JSON &amp; search</h2>
<p><a href="${origin}/api/icon?name=${entry.name}&set=${entry.set}">JSON metadata</a> ·
   <a href="${origin}/api/search?q=${encodeURIComponent(entry.name)}">search “${esc(entry.name)}”</a> ·
   <a href="${origin}/llms.txt">llms.txt</a></p>

${relatedHtml}

<footer>Icon © ${esc(info?.label || entry.set)}, licensed ${esc(entry.license)}${entry.set === "simple-icons" ? " — brand trademark of its owner." : "."} Served by IconServe.</footer>
</div></body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
}

// SEO pillar page targeting the "icons for AI agents / icon API / MCP icon server" keyword cluster.
export function renderAgentsPage(origin: string): Response {
  const mcpUrl = `${origin}/mcp`;
  const faqs: [string, string][] = [
    [
      "Is there an icon API with no API key?",
      "Yes. IconServe is a free SVG icon API with no API key, no sign-up, and no rate-limit registration. Request any icon at a predictable URL such as " +
        `${origin}/i/home.svg and get back raw SVG (or PNG with ?format=png). CORS is open, so you can call it directly from a browser, a Worker, or an AI agent.`,
    ],
    [
      "How do I add IconServe as an MCP icon server to Claude or ChatGPT?",
      "IconServe runs a remote Model Context Protocol (MCP) server at " +
        mcpUrl +
        " over streamable HTTP. In Claude Code, run: claude mcp add --transport http iconserve " +
        mcpUrl +
        " . Any MCP-compatible client (Claude, Cursor, and others) can connect and call the search_icons, get_icon, and list_sets tools.",
    ],
    [
      "What is llms.txt and does IconServe have one?",
      "llms.txt is a plain-text file that describes a site's API in a way large language models can read in one request. IconServe serves the full API at " +
        `${origin}/llms.txt (and an expanded ${origin}/llms-full.txt), so an AI agent can learn every endpoint, parameter, and example without scraping HTML.`,
    ],
    [
      "Can AI agents search icons by natural language?",
      "Yes. The search endpoint combines keyword matching with semantic (embedding) search, so an agent can ask for vague concepts like “something to buy stuff with” and get shopping-cart icons back. Try " +
        `${origin}/api/search?q=notification+bell.`,
    ],
    [
      "Which open-source icon sets are included?",
      "IconServe aggregates 10,000+ icons from Lucide (ISC), Heroicons (MIT), Tabler (MIT), and Simple Icons (CC0) into one agent-readable catalog, each served at a predictable URL with its original license preserved.",
    ],
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  const faqHtml = faqs.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("\n");

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Icons for AI Agents — free SVG icon API, MCP server &amp; llms.txt · IconServe</title>
<meta name="description" content="A free SVG icon API for AI agents — no API key. 10,000+ open-source icons (Lucide, Heroicons, Tabler, Simple Icons) with an MCP icon server, llms.txt, and natural-language search. Works with ChatGPT, Claude, Gemini and Grok.">
<link rel="canonical" href="${origin}/for-ai-agents">
<link rel="alternate" type="text/markdown" href="${origin}/for-ai-agents.md">
<meta name="robots" content="index, follow">
<meta property="og:title" content="Icons for AI Agents — free SVG icon API, MCP server &amp; llms.txt">
<meta property="og:description" content="Free, agent-readable SVG/PNG icons. No API key. MCP server, llms.txt, semantic search. 10,000+ open-source icons.">
<meta property="og:type" content="article">
<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>
<style>${PAGE_CSS}
.lede{font-size:1.05rem;color:var(--muted)}.cta{display:inline-block;margin:14px 8px 0 0;padding:9px 16px;border-radius:9px;background:var(--accent);color:#fff;font-size:.9rem}.cta.alt{background:transparent;color:var(--accent);border:1px solid var(--line)}
h3{font-size:.98rem;margin:20px 0 4px}
</style></head><body><div class="wrap">
<nav><a href="${origin}/">IconServe</a> / Icons for AI agents</nav>

<h1>Icons for AI agents</h1>
<p class="lede">IconServe is the <strong>icon library for agentic development</strong> — a free, open-source <strong>SVG icon API</strong> your AI agents can search and embed. 10,000+ icons at predictable URLs &mdash; <strong>no API key</strong>, an <strong>MCP icon server</strong>, and an <strong>llms.txt</strong> so models like ChatGPT, Claude, Gemini and Grok can use it directly.</p>
<p>
  <a class="cta" href="${origin}/">Search 10,000+ icons</a>
  <a class="cta alt" href="${origin}/integrations">Add to your AI agent</a>
  <a class="cta alt" href="${origin}/llms.txt">Read the llms.txt</a>
</p>

<h2>Three ways an AI agent can get an icon</h2>
<p>Every method returns the same catalog of agent-readable icons &mdash; pick whichever fits your stack.</p>

<h3>1. Predictable URL (no API key)</h3>
<p>Fetch any icon as SVG or PNG. Recolor and resize with query parameters:</p>
<pre><code>${esc(origin)}/i/home.svg
${esc(origin)}/i/heart.svg?color=%23e11d48&amp;size=48
${esc(origin)}/i/bell.svg?format=png&amp;size=128</code></pre>

<h3>2. JSON API with natural-language search</h3>
<p>Semantic + keyword search returns names and ready-to-use SVG URLs:</p>
<pre><code>GET ${esc(origin)}/api/search?q=notification%20bell&amp;limit=3</code></pre>

<h3>3. MCP icon server</h3>
<p>A remote <strong>Model Context Protocol</strong> server over streamable HTTP, exposing <code>search_icons</code>, <code>get_icon</code>, and <code>list_sets</code>:</p>
<pre><code># Claude Code
claude mcp add --transport http iconserve ${esc(mcpUrl)}</code></pre>

<h2>Why it's built for agents, not just humans</h2>
<ul>
<li><strong>No API key, no sign-up</strong> &mdash; agents can call it the moment they discover it.</li>
<li><strong>Predictable, guessable URLs</strong> &mdash; <code>/i/{name}.svg</code> needs no lookup.</li>
<li><strong>llms.txt + OpenAPI</strong> &mdash; the whole API in one machine-readable file.</li>
<li><strong>Semantic search</strong> &mdash; find icons by meaning, not exact keywords.</li>
<li><strong>Open-source &amp; free</strong> &mdash; 10,000+ icons from Lucide, Heroicons, Tabler and Simple Icons.</li>
</ul>

<h2>Frequently asked questions</h2>
${faqHtml}

<footer>
  <a href="${origin}/">Home</a> &middot;
  <a href="${origin}/llms.txt">llms.txt</a> &middot;
  <a href="${origin}/openapi.json">OpenAPI</a> &middot;
  <a href="https://github.com/asr-aditya/iconserve">GitHub</a>
  <br>Free open-source icons for AI agents and websites.
</footer>
</div></body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}

// Markdown mirror of a per-icon page (Vercel Agent Readability: markdown mirrors).
export async function renderIconMarkdown(env: Env, origin: string, set: string, name: string): Promise<Response | null> {
  const catalog = await getCatalog(env);
  const entry = catalog.byId.get(`${set}/${name}`);
  if (!entry) return null;
  const info = SET_INFO[entry.set];
  const url = svgUrl(origin, entry);
  const pageUrl = `${origin}/icon/${entry.set}/${entry.name}`;
  const md = `---
title: ${entry.title} icon (${info?.label || entry.set})
description: Free ${entry.title} icon from ${info?.label || entry.set}, licensed ${entry.license}. SVG or PNG, no API key.
canonical: ${pageUrl}
---

# ${entry.title} icon

- **Name:** \`${entry.name}\`
- **Set:** ${info?.label || entry.set}
- **License:** ${entry.license}
- **Styles:** ${entry.styles.join(", ")}
- **Tags:** ${entry.tags.join(", ")}

## Direct URL

${url}

## Use it

\`\`\`html
<img src="${url}" alt="${entry.title}" width="24" height="24">
\`\`\`

- Recolor / resize: ${url}?color=%234f46e5&size=48
- PNG: ${url}?format=png&size=128

## JSON metadata

${origin}/api/icon?name=${entry.name}&set=${entry.set}
`;
  return markdown(md, discoveryLinkHeader(origin, [`<${pageUrl}>; rel="canonical"`]));
}

// Markdown mirror of the /for-ai-agents pillar page.
export function renderAgentsMarkdown(origin: string): Response {
  const pageUrl = `${origin}/for-ai-agents`;
  const md = `---
title: Icons for AI agents — free SVG icon API, MCP server & llms.txt
description: Free SVG icon API for AI agents. No API key. MCP icon server, llms.txt, semantic search. 10,000+ open-source icons.
canonical: ${pageUrl}
---

# Icons for AI agents

IconServe is the icon library for agentic development — a free, open-source SVG icon API your AI agents can search and embed. 10,000+ icons at predictable URLs — no API key, an MCP icon server, and an llms.txt so models like ChatGPT, Claude, Gemini and Grok can use it directly.

## Three ways an AI agent can get an icon

### 1. Predictable URL (no API key)

    ${origin}/i/home.svg
    ${origin}/i/heart.svg?color=%23e11d48&size=48
    ${origin}/i/bell.svg?format=png&size=128

### 2. JSON API with natural-language search

    GET ${origin}/api/search?q=notification%20bell&limit=3

### 3. MCP icon server

Remote Model Context Protocol server over streamable HTTP, exposing search_icons, get_icon, and list_sets:

    claude mcp add --transport http iconserve ${origin}/mcp

## Why it's built for agents

- No API key, no sign-up.
- Predictable, guessable URLs (\`/i/{name}.svg\`).
- llms.txt + OpenAPI: the whole API in one machine-readable file.
- Semantic search: find icons by meaning, not exact keywords.
- Open-source & free: Lucide, Heroicons, Tabler, Simple Icons.
`;
  return markdown(md, discoveryLinkHeader(origin, [`<${pageUrl}>; rel="canonical"`]));
}

// Convenience: /icon/{name} (no set) redirects to the best-match canonical page.
export async function bestIconPageRedirect(env: Env, origin: string, name: string): Promise<Response | null> {
  const catalog = await getCatalog(env);
  const order = env.DEFAULT_SET_ORDER.split(",").map((s) => s.trim());
  const entry = resolveBest(catalog, name, order);
  if (!entry) return null;
  return Response.redirect(`${origin}/icon/${entry.set}/${entry.name}`, 302);
}
