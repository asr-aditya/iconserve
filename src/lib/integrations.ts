import { PAGE_CSS } from "./pages";

// Per-client "add IconServe's MCP server in one step" pages. These remove adoption
// friction (the launch posts link straight here) and rank for "iconserve <tool>".
const MCP_URL = "/mcp"; // resolved against origin below

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type Step = { title: string; code: string };
type Client = { slug: string; name: string; blurb: string; steps: (origin: string) => Step[]; docs?: string };

export const CLIENTS: Client[] = [
  {
    slug: "claude-code",
    name: "Claude Code",
    blurb: "Add IconServe to Claude Code (CLI) with one command.",
    steps: (o) => [{ title: "Run in your terminal", code: `claude mcp add --transport http iconserve ${o}${MCP_URL}` }],
    docs: "https://docs.claude.com/en/docs/claude-code/mcp",
  },
  {
    slug: "claude-desktop",
    name: "Claude Desktop",
    blurb: "Add IconServe to Claude Desktop via its config file.",
    steps: (o) => [
      {
        title: "Add to claude_desktop_config.json → mcpServers",
        code: `{
  "mcpServers": {
    "iconserve": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${o}${MCP_URL}"]
    }
  }
}`,
      },
      { title: "Then restart Claude Desktop", code: "# Quit and reopen Claude Desktop; IconServe's tools appear in the tools menu." },
    ],
    docs: "https://modelcontextprotocol.io/quickstart/user",
  },
  {
    slug: "cursor",
    name: "Cursor",
    blurb: "Add IconServe to Cursor as a remote MCP server.",
    steps: (o) => [
      {
        title: "Create .cursor/mcp.json in your project (or ~/.cursor/mcp.json)",
        code: `{
  "mcpServers": {
    "iconserve": { "url": "${o}${MCP_URL}" }
  }
}`,
      },
    ],
    docs: "https://docs.cursor.com/context/model-context-protocol",
  },
  {
    slug: "windsurf",
    name: "Windsurf",
    blurb: "Add IconServe to Windsurf's MCP config.",
    steps: (o) => [
      {
        title: "Add to ~/.codeium/windsurf/mcp_config.json",
        code: `{
  "mcpServers": {
    "iconserve": { "serverUrl": "${o}${MCP_URL}" }
  }
}`,
      },
    ],
    docs: "https://docs.windsurf.com/windsurf/mcp",
  },
  {
    slug: "cline",
    name: "Cline",
    blurb: "Add IconServe to Cline (VS Code) as a remote MCP server.",
    steps: (o) => [
      {
        title: "Cline → MCP Servers → Configure → add a remote server",
        code: `{
  "mcpServers": {
    "iconserve": { "url": "${o}${MCP_URL}", "transportType": "streamableHttp" }
  }
}`,
      },
    ],
    docs: "https://docs.cline.bot/mcp/configuring-mcp-servers",
  },
  {
    slug: "any-mcp-client",
    name: "Any MCP client",
    blurb: "IconServe is a standard remote MCP server (streamable HTTP).",
    steps: (o) => [
      { title: "Connect to the streamable-HTTP endpoint", code: `${o}${MCP_URL}` },
      { title: "Tools exposed", code: "search_icons(query, limit?, set?)\nget_icon(name, set?, style?, color?, size?, stroke?, format?)\nlist_sets()" },
    ],
    docs: "/for-ai-agents",
  },
];

// Agent frameworks — wire IconServe's HTTP API in as a tool your agent can call.
export const FRAMEWORKS: Client[] = [
  {
    slug: "openai-agents-sdk",
    name: "OpenAI Agents SDK",
    blurb: "Add an icon-finder tool to an OpenAI Agents SDK agent (Python).",
    steps: (o) => [
      {
        title: "Define a function tool that searches IconServe",
        code: `from agents import Agent, function_tool
import requests

@function_tool
def find_icon(query: str) -> str:
    """Find an icon by name or description; returns a ready-to-use SVG URL."""
    r = requests.get("${o}/api/search", params={"q": query, "limit": 1}).json()
    return r["results"][0]["svg_url"] if r["results"] else "no icon found"

agent = Agent(name="UI helper", tools=[find_icon])`,
      },
    ],
    docs: "https://openai.github.io/openai-agents-python/",
  },
  {
    slug: "langchain",
    name: "LangChain / LangGraph",
    blurb: "Give a LangChain agent an IconServe search tool (Python).",
    steps: (o) => [
      {
        title: "Define a @tool",
        code: `from langchain_core.tools import tool
import requests

@tool
def find_icon(query: str) -> str:
    """Search IconServe for an icon; returns a ready-to-use SVG URL."""
    r = requests.get("${o}/api/search", params={"q": query, "limit": 1}).json()
    return r["results"][0]["svg_url"] if r["results"] else "no icon found"

# add find_icon to your agent's tools list`,
      },
    ],
    docs: "https://python.langchain.com/docs/how_to/custom_tools/",
  },
  {
    slug: "vercel-ai-sdk",
    name: "Vercel AI SDK",
    blurb: "Add an IconServe tool to a Vercel AI SDK agent (TypeScript).",
    steps: (o) => [
      {
        title: "Define a tool()",
        code: `import { tool } from "ai";
import { z } from "zod";

export const findIcon = tool({
  description: "Find an icon by name or description; returns an SVG URL.",
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const r = await fetch(
      \`${o}/api/search?q=\${encodeURIComponent(query)}&limit=1\`,
    ).then((r) => r.json());
    return r.results[0]?.svg_url ?? "no icon found";
  },
});`,
      },
    ],
    docs: "https://sdk.vercel.ai/docs/foundations/tools",
  },
  {
    slug: "anthropic-tool-use",
    name: "Anthropic API (tool use)",
    blurb: "Define IconServe as a tool for Claude via the Anthropic API (Python).",
    steps: (o) => [
      {
        title: "Declare the tool + handle the call",
        code: `# tool definition passed to client.messages.create(tools=[...])
tool = {
    "name": "find_icon",
    "description": "Find an icon by name or description; returns an SVG URL.",
    "input_schema": {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    },
}

# when Claude calls the tool:
import requests
def find_icon(query: str) -> str:
    r = requests.get("${o}/api/search", params={"q": query, "limit": 1}).json()
    return r["results"][0]["svg_url"] if r["results"] else "no icon found"`,
      },
    ],
    docs: "https://docs.claude.com/en/docs/build-with-claude/tool-use",
  },
];

export const INTEGRATIONS: Client[] = [...CLIENTS, ...FRAMEWORKS];

function head(origin: string, title: string, desc: string, canonical: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article">
<style>${PAGE_CSS}
.client-list a{display:block;border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:8px 0;background:var(--card)}
.client-list a b{color:var(--fg)}.client-list a span{color:var(--muted);font-size:.88rem}
</style></head><body><div class="wrap">`;
}

export function renderIntegrationsIndex(origin: string): Response {
  const canonical = `${origin}/integrations`;
  const card = (c: Client) =>
    `<a href="${origin}/integrations/${c.slug}"><b>${esc(c.name)}</b><br><span>${esc(c.blurb)}</span></a>`;
  const clientCards = CLIENTS.map(card).join("\n");
  const frameworkCards = FRAMEWORKS.map(card).join("\n");
  const html = `${head(origin, "Add IconServe to your AI agent — MCP & framework integrations · IconServe", "Add IconServe (icons for agentic development) to Claude, Cursor, Windsurf, Cline, LangChain, OpenAI Agents SDK, or the Vercel AI SDK. No API key.", canonical)}
<nav><a href="${origin}/">IconServe</a> / Integrations</nav>
<h1>Add IconServe to your AI agent</h1>
<p class="lede" style="color:var(--muted)">IconServe is the icon library for agentic development — 10,000+ open-source icons, no API key. Wire it into your agent:</p>
<h2>MCP clients</h2>
<div class="client-list">${clientCards}</div>
<h2>Agent frameworks</h2>
<div class="client-list">${frameworkCards}</div>
<p style="margin-top:20px"><a href="${origin}/for-ai-agents">Or use the plain HTTP API / llms.txt →</a></p>
</div></body></html>`;
  return html2(html);
}

export function renderIntegrationPage(origin: string, slug: string): Response | null {
  const c = INTEGRATIONS.find((x) => x.slug === slug);
  if (!c) return null;
  const canonical = `${origin}/integrations/${c.slug}`;
  const steps = c
    .steps(origin)
    .map((s) => `<h2>${esc(s.title)}</h2><pre><code>${esc(s.code)}</code></pre>`)
    .join("\n");
  const html = `${head(origin, `Add IconServe to ${c.name} — free icon MCP server · IconServe`, `${c.blurb} 10,000+ open-source icons, no API key. Tools: search_icons, get_icon, list_sets.`, canonical)}
<nav><a href="${origin}/">IconServe</a> / <a href="${origin}/integrations">Integrations</a> / ${esc(c.name)}</nav>
<h1>Add IconServe to ${esc(c.name)}</h1>
<p style="color:var(--muted)">IconServe gives ${esc(c.name)} access to 10,000+ open-source icons (Lucide, Heroicons, Tabler, Simple Icons) as SVG or PNG — searchable by name or natural language. Free, no API key.</p>
${steps}
<h2>Try it</h2>
<p>Ask your agent: <em>"use iconserve to find a settings icon."</em> It will call <code>search_icons</code> and return ready-to-use SVG URLs.</p>
${c.docs ? `<p><a href="${c.docs.startsWith("http") ? c.docs : origin + c.docs}">${esc(c.name)} MCP docs →</a></p>` : ""}
<footer style="margin-top:32px;border-top:1px solid var(--line);padding-top:14px;color:var(--muted);font-size:.85rem">
<a href="${origin}/integrations">All integrations</a> · <a href="${origin}/for-ai-agents">HTTP API</a> · <a href="${origin}/llms.txt">llms.txt</a> · <a href="https://github.com/asr-aditya/iconserve">GitHub</a></footer>
</div></body></html>`;
  return html2(html);
}

function html2(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600", "access-control-allow-origin": "*" },
  });
}
