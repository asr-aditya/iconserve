import type { Env, CatalogEntry } from "../types";
import { getCatalog, getIcons, resolveBest } from "./store";
import { applyTransforms } from "./transform";
import { svgUrl } from "./urls";

export const SET_INFO: Record<string, { label: string; homepage: string; licenseUrl: string }> = {
  lucide: { label: "Lucide", homepage: "https://lucide.dev", licenseUrl: "https://opensource.org/license/isc-license-txt" },
  heroicons: { label: "Heroicons", homepage: "https://heroicons.com", licenseUrl: "https://opensource.org/license/mit" },
  tabler: { label: "Tabler", homepage: "https://tabler.io/icons", licenseUrl: "https://opensource.org/license/mit" },
  "simple-icons": { label: "Simple Icons", homepage: "https://simpleicons.org", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const PAGE_CSS = `
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

// Convenience: /icon/{name} (no set) redirects to the best-match canonical page.
export async function bestIconPageRedirect(env: Env, origin: string, name: string): Promise<Response | null> {
  const catalog = await getCatalog(env);
  const order = env.DEFAULT_SET_ORDER.split(",").map((s) => s.trim());
  const entry = resolveBest(catalog, name, order);
  if (!entry) return null;
  return Response.redirect(`${origin}/icon/${entry.set}/${entry.name}`, 302);
}
