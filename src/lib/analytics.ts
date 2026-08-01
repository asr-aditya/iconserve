import type { Env } from "../types";

// Classify a request's User-Agent into a coarse kind + a named family, so we can
// measure agent vs human traffic and which agents/crawlers actually reach us.
const AGENT_UAS: [RegExp, string][] = [
  [/gptbot|oai-searchbot|chatgpt-user/i, "chatgpt"],
  [/claude(bot|-user|-searchbot)|anthropic/i, "claude"],
  [/perplexity/i, "perplexity"],
  [/google-extended|googleother|gemini/i, "google"],
  [/bingbot|bingpreview/i, "bing"],
  [/applebot/i, "apple"],
  [/ccbot/i, "commoncrawl"],
  [/bytespider/i, "bytedance"],
  [/amazonbot/i, "amazon"],
  [/meta-externalagent|facebookexternalhit/i, "meta"],
  [/cohere-ai/i, "cohere"],
  [/duckassist|duckduckbot/i, "duckduckgo"],
  [/youbot/i, "you"],
];
const SCRIPT_UA = /python-requests|python-httpx|aiohttp|node-fetch|undici|axios|go-http-client|okhttp|curl|wget|libwww|java\/|ruby|scrapy|postman|insomnia/i;
const BROWSER_UA = /mozilla|applewebkit|chrome|safari|firefox|edg\/|gecko/i;

export function classifyUA(ua: string): { kind: string; family: string } {
  if (!ua) return { kind: "unknown", family: "none" };
  for (const [re, family] of AGENT_UAS) if (re.test(ua)) return { kind: "agent", family };
  if (SCRIPT_UA.test(ua)) return { kind: "agent", family: "script" };
  if (BROWSER_UA.test(ua)) return { kind: "human", family: "browser" };
  return { kind: "bot", family: "unknown" };
}

export function routeType(path: string): string {
  if (path === "/" || path === "/index.html" || path === "/index.md") return "landing";
  if (path === "/mcp" || path === "/mcp/") return "mcp";
  if (path.startsWith("/i/") || path.startsWith("/icons/")) return "icon-asset";
  if (path.startsWith("/icon/")) return path.endsWith(".md") ? "icon-md" : "icon-page";
  if (path.startsWith("/api/search")) return "search";
  if (path.startsWith("/api/")) return "api";
  if (path === "/for-ai-agents" || path === "/for-ai-agents.md") return "pillar";
  if (path === "/llms.txt" || path === "/llms-full.txt") return "llms";
  if (path.startsWith("/.well-known")) return "wellknown";
  if (path === "/AGENTS.md") return "agents-md";
  if (path === "/sitemap.xml" || path === "/sitemap.md") return "sitemap";
  if (path === "/robots.txt") return "robots";
  return "other";
}

// Fixed blob/double schema (referenced as blob1..blobN / double1 in SQL queries):
//   blob1 kind, blob2 family, blob3 routeType, blob4 httpMethod, blob5 country,
//   blob6 hasReferer, blob7 path, blob8 mcpMethod, blob9 toolName,
//   blob10 rawUserAgent (truncated); double1 status.
export function logRequest(env: Env, request: Request, url: URL, status: number): void {
  if (!env.ANALYTICS) return;
  try {
    const ua = request.headers.get("user-agent") || "";
    const { kind, family } = classifyUA(ua);
    const country = (request as any).cf?.country || "XX";
    env.ANALYTICS.writeDataPoint({
      indexes: [kind],
      blobs: [kind, family, routeType(url.pathname), request.method, country, request.headers.get("referer") ? "1" : "0", url.pathname.slice(0, 96), "", "", ua.slice(0, 160)],
      doubles: [status],
    });
  } catch {
    /* analytics must never break a request */
  }
}

// MCP-level funnel event: which JSON-RPC method + tool an agent actually invoked.
// Lets us see tools/list (discovered) vs tools/call (used), i.e. the drop-off.
export function logMcp(env: Env, request: Request, method: string, toolName: string): void {
  if (!env.ANALYTICS) return;
  try {
    const ua = request.headers.get("user-agent") || "";
    const { kind, family } = classifyUA(ua);
    const country = (request as any).cf?.country || "XX";
    env.ANALYTICS.writeDataPoint({
      indexes: [kind],
      blobs: [kind, family, "mcp-rpc", request.method, country, "0", "/mcp", method || "", toolName || "", ua.slice(0, 160)],
      doubles: [1],
    });
  } catch {
    /* ignore */
  }
}
