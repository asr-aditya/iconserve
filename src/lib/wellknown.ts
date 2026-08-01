import type { Env } from "../types";

// RFC 9727 API Catalog — application/linkset+json advertising our machine interfaces.
export function apiCatalog(origin: string) {
  return {
    linkset: [
      {
        anchor: `${origin}/`,
        "service-desc": [{ href: `${origin}/openapi.json`, type: "application/json" }],
        "service-doc": [
          { href: `${origin}/llms.txt`, type: "text/plain" },
          { href: `${origin}/llms-full.txt`, type: "text/plain" },
          { href: `${origin}/for-ai-agents`, type: "text/html" },
        ],
        status: [{ href: `${origin}/api/sets`, type: "application/json" }],
        related: [{ href: `${origin}/mcp`, title: "MCP server (streamable-http)" }],
      },
    ],
  };
}

// MCP Server Card (SEP-1649 / SEP-2127) — advertises the MCP endpoint at a well-known path.
export function mcpServerCard(origin: string) {
  return {
    $schema: "https://modelcontextprotocol.io/schemas/draft/server-card.json",
    serverInfo: {
      name: "iconserve",
      version: "0.1.0",
      description: "Search and fetch 10,000+ open-source icons (Lucide, Heroicons, Tabler, Simple Icons) as SVG or PNG.",
      websiteUrl: origin,
    },
    transport: { type: "streamable-http", endpoint: `${origin}/mcp` },
    capabilities: { tools: {} },
    tools: [
      { name: "search_icons", description: "Search icons by keyword or natural language." },
      { name: "get_icon", description: "Get one icon's SVG markup and hosted URL, with optional transforms." },
      { name: "list_sets", description: "List the available icon sets with counts and licenses." },
    ],
  };
}

// Markdown representation of the homepage, served on `Accept: text/markdown`.
export function homepageMarkdown(origin: string): string {
  return `# IconServe

Free open-source icons for humans and AI agents — 10,000+ icons (Lucide, Heroicons, Tabler, Simple Icons) as SVG or PNG at predictable URLs. No API key.

## Get an icon
- Best match: \`${origin}/i/{name}.svg\` — e.g. ${origin}/i/home.svg
- Specific set: \`${origin}/icons/{set}/{name}.svg\`
- Transforms: \`?color=%234f46e5&size=48&stroke=1.5&format=png\`

## Search
- \`GET ${origin}/api/search?q=notification+bell\` — keyword + semantic search

## For AI agents
- Docs in one file: ${origin}/llms.txt (or ${origin}/llms-full.txt)
- OpenAPI: ${origin}/openapi.json
- MCP server (streamable-http): ${origin}/mcp — tools: search_icons, get_icon, list_sets
- API catalog: ${origin}/.well-known/api-catalog
- Full guide: ${origin}/for-ai-agents

## Icon sets
Lucide (ISC), Heroicons (MIT), Tabler (MIT), Simple Icons (CC0). Each icon retains its original license.
`;
}
