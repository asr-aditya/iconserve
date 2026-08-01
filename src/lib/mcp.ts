import type { Env } from "../types";
import { getCatalog } from "./store";
import { search } from "./search";
import { renderIcon } from "./icons";
import { svgUrl } from "./urls";

// Minimal stateless Streamable-HTTP MCP server (JSON-RPC 2.0 over POST).
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "search_icons",
    description:
      "Search for icons by keyword or natural language and get their names + ready-to-use SVG URLs. Use this first when you don't know the exact icon name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the icon should depict, e.g. 'shopping cart' or 'notification bell'." },
        limit: { type: "integer", description: "Max results (default 10).", default: 10 },
        set: { type: "string", description: "Optional: restrict to one set (lucide, heroicons, tabler, simple-icons)." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_icon",
    description:
      "Get one icon's SVG markup and a hosted URL, with optional color/size/stroke/style/format transforms.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Icon name, e.g. 'home', 'shopping-cart', 'github'." },
        set: { type: "string", description: "Optional set to pin (else best match is used)." },
        style: { type: "string", description: "Optional style, e.g. 'solid' or 'filled'." },
        color: { type: "string", description: "hex, css color, or 'currentColor'." },
        size: { type: "integer", description: "Pixel size 1..2048." },
        stroke: { type: "number", description: "Stroke width (line icons)." },
        format: { type: "string", enum: ["svg", "png"], description: "Output format (default svg)." },
      },
      required: ["name"],
    },
  },
  {
    name: "list_sets",
    description: "List the available icon sets with counts and licenses.",
    inputSchema: { type: "object", properties: {} },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
function toolText(text: string) {
  return { content: [{ type: "text", text }] };
}

async function callTool(env: Env, origin: string, name: string, args: any) {
  if (name === "search_icons") {
    const hits = await search(env, String(args?.query ?? ""), Math.min(Number(args?.limit) || 10, 50), args?.set);
    const results = hits.map((h) => ({
      id: h.entry.id,
      name: h.entry.name,
      set: h.entry.set,
      title: h.entry.title,
      styles: h.entry.styles,
      svg_url: svgUrl(origin, h.entry),
    }));
    return toolText(JSON.stringify({ query: args?.query, count: results.length, results }, null, 2));
  }

  if (name === "get_icon") {
    const res = await renderIcon(env, {
      name: String(args?.name ?? ""),
      set: args?.set,
      style: args?.style,
      color: args?.color,
      size: args?.size,
      stroke: args?.stroke,
      format: args?.format,
    });
    if (!res.ok) return { ...toolText(JSON.stringify({ error: res.error })), isError: true };
    if (res.format === "png") {
      return {
        content: [
          { type: "text", text: JSON.stringify({ id: res.entry.id, style: res.style, format: "png", size: args?.size || 256, url: svgUrl(origin, res.entry, args) }) },
        ],
      };
    }
    return toolText(
      JSON.stringify(
        { id: res.entry.id, set: res.entry.set, style: res.style, license: res.entry.license, url: svgUrl(origin, res.entry, args), svg: res.svg },
        null,
        2,
      ),
    );
  }

  if (name === "list_sets") {
    const catalog = await getCatalog(env);
    const counts: Record<string, { count: number; license: string }> = {};
    for (const e of catalog.entries) {
      counts[e.set] = counts[e.set] || { count: 0, license: e.license };
      counts[e.set].count++;
    }
    return toolText(JSON.stringify(counts, null, 2));
  }

  return { ...toolText(`unknown tool: ${name}`), isError: true };
}

export async function handleMcp(request: Request, env: Env, origin: string): Promise<Response> {
  if (request.method === "GET") {
    // No server-initiated stream in this stateless implementation.
    return new Response("MCP endpoint. POST JSON-RPC here.", { status: 200, headers: { "content-type": "text/plain" } });
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 200 });
  }

  const handle = async (msg: any) => {
    const { id, method, params } = msg || {};
    switch (method) {
      case "initialize":
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "iconserve", version: "0.1.0" },
          instructions: "Search icons with search_icons, then embed the returned svg_url or fetch markup with get_icon.",
        });
      case "notifications/initialized":
        return null; // notification, no response
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, { tools: TOOLS });
      case "tools/call":
        try {
          const out = await callTool(env, origin, params?.name, params?.arguments || {});
          return rpcResult(id, out);
        } catch (e: any) {
          return rpcError(id, -32603, `tool error: ${e?.message || e}`);
        }
      default:
        if (id === undefined) return null; // unknown notification
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  };

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter((x) => x !== null);
    return Response.json(out, { status: 200 });
  }
  const out = await handle(body);
  if (out === null) return new Response(null, { status: 202 });
  return Response.json(out, { status: 200 });
}
