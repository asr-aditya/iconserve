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

// ---- Agent Skills Discovery (agentskills.io RFC v0.2.0) ----

type Skill = { name: string; description: string; md: string };

export function agentSkills(origin: string): Skill[] {
  return [
    {
      name: "find-and-embed-icons",
      description: "Find an open-source icon by keyword or natural language and embed it as SVG or PNG using IconServe.",
      md: `---
name: find-and-embed-icons
description: Find an open-source icon and embed it as SVG or PNG using IconServe.
---

# Find and embed icons with IconServe

IconServe serves 10,000+ open-source icons (Lucide, Heroicons, Tabler, Simple Icons) as SVG or PNG at predictable URLs. No API key.

## Steps
1. If you don't know the exact name, search first:
   GET ${origin}/api/search?q=notification%20bell&limit=3
   Use results[0].name.
2. Embed the icon by URL:
   ${origin}/i/{name}.svg
3. Optional transforms (query params): color (URL-encoded hex), size (px), stroke, style, format=png.
   Example: ${origin}/i/bell.svg?color=%234f46e5&size=24

## Notes
- CORS is open; call directly from a browser or agent.
- Pin a set: ${origin}/icons/{set}/{name}.svg (sets: lucide, heroicons, tabler, simple-icons).
- Each icon keeps its original open-source license.
`,
    },
    {
      name: "use-iconserve-mcp",
      description: "Connect to the IconServe MCP server to search and fetch icons as native tool calls.",
      md: `---
name: use-iconserve-mcp
description: Connect to the IconServe MCP server to search and fetch icons as native tool calls.
---

# Use the IconServe MCP server

IconServe exposes a remote Model Context Protocol server over streamable HTTP.

## Endpoint
${origin}/mcp

## Add to Claude Code
claude mcp add --transport http iconserve ${origin}/mcp

## Tools
- search_icons(query, limit?, set?) — search by keyword or natural language.
- get_icon(name, set?, style?, color?, size?, stroke?, format?) — get SVG markup + hosted URL.
- list_sets() — list icon sets with counts and licenses.
`,
    },
  ];
}

export function findSkill(origin: string, name: string): Skill | undefined {
  return agentSkills(origin).find((s) => s.name === name);
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function agentSkillsIndex(origin: string) {
  const skills = agentSkills(origin);
  const entries = await Promise.all(
    skills.map(async (s) => ({
      name: s.name,
      type: "skill-md" as const,
      description: s.description,
      url: `${origin}/.well-known/agent-skills/${s.name}/SKILL.md`,
      digest: `sha256:${await sha256Hex(s.md)}`,
    })),
  );
  return { $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json", skills: entries };
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
