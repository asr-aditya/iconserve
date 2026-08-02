import type { Env } from "../types";
import { getCatalog } from "./store";

export async function llmsTxt(env: Env, origin: string): Promise<string> {
  const catalog = await getCatalog(env);
  const sets = [...new Set(catalog.entries.map((e) => e.set))];
  const total = catalog.entries.length;

  return `# IconServe — icons for agentic development

> The icon library for agentic development: ${total.toLocaleString()} open-source icons (${sets.join(", ")}) your AI agents can search and embed as SVG or PNG.
> Every icon is reachable at a predictable URL. Recolor, resize, and re-stroke via query params.
> No API key. CORS is open. Responses are cacheable and immutable.

## Fastest path (embed an icon directly)

Put this URL in an <img>, markdown image, or fetch it:

  ${origin}/i/{name}.svg

Examples:
  ${origin}/i/home.svg
  ${origin}/i/shopping-cart.svg?color=%23e11d48&size=48
  ${origin}/i/github.svg?color=white          (brand icon)
  ${origin}/i/heart.svg?stroke=1.5&color=crimson

If you are not sure of the exact icon name, SEARCH FIRST (see below) — do not guess.

## Naming

- Names are lowercase, hyphenated: "shopping-cart", "arrow-right", "chevron-down".
- /i/{name} returns the best match across all sets (priority: ${env.DEFAULT_SET_ORDER}).
- To pin a specific set: /icons/{set}/{name}.svg  e.g. ${origin}/icons/lucide/house.svg
- Sets: ${sets.join(", ")}. Brand/logo icons (companies, tools) are in "simple-icons".

## Query parameters (work on any icon URL)

- color=<hex|css-color|currentColor>   e.g. color=%23ff0000, color=red, color=currentColor
- size=<1..2048>                       pixel width/height, e.g. size=64
- stroke=<0..20>                       stroke width, line icons only, e.g. stroke=1.5
- style=<style>                        e.g. style=solid (heroicons), style=filled (tabler)
- format=svg|png                       png rasterizes server-side, e.g. format=png&size=128

## Search (use this to find the right icon)

GET ${origin}/api/search?q=<query>&limit=<n>&set=<optional>
  -> JSON: { query, count, results: [ { id, name, set, title, svg_url, styles, tags } ] }
  Combines keyword + semantic search, so vague queries work ("thing to buy stuff" -> shopping-cart).

Example:
  ${origin}/api/search?q=notification%20bell&limit=5

## JSON API

- GET /api/search?q=&limit=&set=      search icons
- GET /api/icon?name=&set=&style=     one icon as JSON (includes raw svg + metadata + urls)
- GET /api/sets                       list icon sets, counts, licenses
- GET /api/manifest                   full catalog (names, sets, tags) — large

## MCP server (for MCP-capable agents)

Streamable-HTTP MCP endpoint:  ${origin}/mcp
Tools: search_icons(query, limit?, set?), get_icon(name, set?, style?, color?, size?, stroke?, format?), list_sets()

## Per-icon pages

Every icon has a crawlable HTML page with preview, usage, and JSON-LD structured data:
  ${origin}/icon/{set}/{name}   e.g. ${origin}/icon/lucide/house

## Machine docs

- [OpenAPI](${origin}/openapi.json): full REST spec (OpenAPI 3.1).
- [llms-full.txt](${origin}/llms-full.txt): expanded docs with set inventory and a worked example.
- [Sitemap](${origin}/sitemap.xml): all ${total.toLocaleString()} icon pages (and [sitemap.md](${origin}/sitemap.md)).
- [Robots](${origin}/robots.txt): crawl rules (AI bots welcome).
- [API catalog](${origin}/.well-known/api-catalog): RFC 9727 linkset.
- [MCP server card](${origin}/.well-known/mcp/server-card.json): MCP discovery.
- [Agent skills](${origin}/.well-known/agent-skills/index.json): skill discovery index.
- [AGENTS.md](${origin}/AGENTS.md): agent-oriented project guide.

## Licensing

Icons are redistributed under their original permissive licenses (Lucide: ISC, Heroicons: MIT,
Tabler: MIT, Simple Icons: CC0). Brand icons from Simple Icons represent third-party trademarks
owned by their respective companies; use them per each brand's guidelines.
`;
}

export function openApi(origin: string): unknown {
  return {
    openapi: "3.1.0",
    info: {
      title: "IconServe",
      version: "0.1.0",
      description: "Static open-source icons (Lucide, Heroicons, Tabler, Simple Icons) as SVG/PNG for AI agents.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/search": {
        get: {
          operationId: "searchIcons",
          summary: "Search icons by keyword or natural language.",
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string" }, description: "Search query." },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "set", in: "query", schema: { type: "string" }, description: "Restrict to one set." },
          ],
          responses: { "200": { description: "Ranked matches." } },
        },
      },
      "/api/icon": {
        get: {
          operationId: "getIcon",
          summary: "Get one icon as JSON (svg markup + metadata + URLs).",
          parameters: [
            { name: "name", in: "query", required: true, schema: { type: "string" } },
            { name: "set", in: "query", schema: { type: "string" } },
            { name: "style", in: "query", schema: { type: "string" } },
            { name: "color", in: "query", schema: { type: "string" } },
            { name: "size", in: "query", schema: { type: "integer" } },
            { name: "stroke", in: "query", schema: { type: "number" } },
          ],
          responses: { "200": { description: "Icon JSON." }, "404": { description: "Not found." } },
        },
      },
      "/icons/{set}/{name}.svg": {
        get: {
          operationId: "getIconSvg",
          summary: "Raw SVG for a specific set. Supports color/size/stroke/style/format query params.",
          parameters: [
            { name: "set", in: "path", required: true, schema: { type: "string" } },
            { name: "name", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: { "200": { description: "SVG (or PNG with format=png)." } },
        },
      },
      "/i/{name}.svg": {
        get: {
          operationId: "getBestIconSvg",
          summary: "Raw SVG best-match across all sets. Supports color/size/stroke/format query params.",
          parameters: [{ name: "name", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "SVG (or PNG with format=png)." } },
        },
      },
      "/api/sets": { get: { operationId: "listSets", summary: "List sets, counts, licenses.", responses: { "200": { description: "OK" } } } },
    },
  };
}
