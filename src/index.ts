import type { Env } from "./types";
import { json, text, svgResponse, pngResponse, notFound, badRequest, preflight } from "./lib/http";
import { renderIcon } from "./lib/icons";
import { search } from "./lib/search";
import { getCatalog } from "./lib/store";
import { svgUrl } from "./lib/urls";
import { llmsTxt, openApi } from "./lib/docs";
import { handleMcp } from "./lib/mcp";
import { robotsTxt, sitemapXml, llmsFullTxt } from "./lib/seo";
import { renderIconPage, bestIconPageRedirect, renderAgentsPage } from "./lib/pages";
import { apiCatalog, mcpServerCard, homepageMarkdown } from "./lib/wellknown";

const stripExt = (s: string) => s.replace(/\.(svg|png)$/i, "");

function iconParams(url: URL, format?: string) {
  const q = url.searchParams;
  return {
    style: q.get("style"),
    color: q.get("color"),
    size: q.get("size"),
    stroke: q.get("stroke"),
    format: format || q.get("format"),
  };
}

async function serveIcon(env: Env, res: Awaited<ReturnType<typeof renderIcon>>): Promise<Response> {
  if (!res.ok) return json({ error: res.error }, res.status);
  return res.format === "png" ? pngResponse(res.png) : svgResponse(res.svg);
}

// Edge-cache immutable icon responses keyed by full URL.
async function cachedIcon(request: Request, ctx: ExecutionContext, produce: () => Promise<Response>): Promise<Response> {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const resp = await produce();
  if (resp.status === 200) ctx.waitUntil(cache.put(request, resp.clone()));
  return resp;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname;

    if (request.method === "OPTIONS") return preflight();

    try {
      // ---- MCP ----
      if (path === "/mcp" || path === "/mcp/") {
        return await handleMcp(request, env, origin);
      }

      // ---- Discovery docs ----
      if (path === "/llms.txt") return text(await llmsTxt(env, origin));
      if (path === "/llms-full.txt") return text(await llmsFullTxt(env, origin));
      if (path === "/openapi.json") return json(openApi(origin));
      if (path === "/robots.txt") return text(robotsTxt(origin));

      // ---- Well-known agent-discovery endpoints ----
      if (path === "/.well-known/api-catalog")
        return json(apiCatalog(origin), 200, { "content-type": "application/linkset+json; charset=utf-8" });
      if (path === "/.well-known/mcp/server-card.json") return json(mcpServerCard(origin));

      // IndexNow ownership key file — served at /{key}.txt for Bing/Yandex verification.
      if (env.INDEXNOW_KEY && path === `/${env.INDEXNOW_KEY}.txt`)
        return text(env.INDEXNOW_KEY);
      if (path === "/sitemap.xml")
        return new Response(await sitemapXml(env, origin), {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
        });

      // ---- SEO pillar page ----
      if (path === "/for-ai-agents") return renderAgentsPage(origin);

      // ---- Per-icon HTML pages (crawlable, structured data) ----
      if (path.startsWith("/icon/")) {
        const rest = path.slice("/icon/".length).replace(/\/$/, "");
        const slash = rest.indexOf("/");
        if (slash === -1) {
          const r = await bestIconPageRedirect(env, origin, decodeURIComponent(rest));
          return r || notFound(`icon not found: ${rest}`);
        }
        const set = decodeURIComponent(rest.slice(0, slash));
        const name = decodeURIComponent(rest.slice(slash + 1));
        const page = await renderIconPage(env, origin, set, name);
        return page || notFound(`icon not found: ${set}/${name}`);
      }

      // ---- Raw images: best match ----  /i/{name}.svg|.png
      if (path.startsWith("/i/")) {
        const name = stripExt(decodeURIComponent(path.slice(3)));
        if (!name) return badRequest("missing icon name");
        const fmt = path.endsWith(".png") ? "png" : undefined;
        return cachedIcon(request, ctx, async () =>
          serveIcon(env, await renderIcon(env, { name, ...iconParams(url, fmt) })),
        );
      }

      // ---- Raw images: specific set ----  /icons/{set}/{name}.svg|.png
      if (path.startsWith("/icons/")) {
        const rest = path.slice("/icons/".length);
        const slash = rest.indexOf("/");
        if (slash === -1) return badRequest("expected /icons/{set}/{name}.svg");
        const set = decodeURIComponent(rest.slice(0, slash));
        const name = stripExt(decodeURIComponent(rest.slice(slash + 1)));
        if (!name) return badRequest("missing icon name");
        const fmt = path.endsWith(".png") ? "png" : undefined;
        return cachedIcon(request, ctx, async () =>
          serveIcon(env, await renderIcon(env, { set, name, ...iconParams(url, fmt) })),
        );
      }

      // ---- JSON API ----
      if (path === "/api/search") {
        const q = url.searchParams.get("q") || "";
        if (!q.trim()) return badRequest("missing query param: q");
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 100);
        const set = url.searchParams.get("set") || undefined;
        const hits = await search(env, q, limit, set);
        return json({
          query: q,
          count: hits.length,
          results: hits.map((h) => ({
            id: h.entry.id,
            name: h.entry.name,
            set: h.entry.set,
            title: h.entry.title,
            styles: h.entry.styles,
            tags: h.entry.tags.slice(0, 8),
            svg_url: svgUrl(origin, h.entry),
          })),
        });
      }

      if (path === "/api/icon") {
        const name = url.searchParams.get("name");
        if (!name) return badRequest("missing query param: name");
        const res = await renderIcon(env, {
          name,
          set: url.searchParams.get("set"),
          ...iconParams(url),
        });
        if (!res.ok) return json({ error: res.error }, res.status);
        const base = { id: res.entry.id, name: res.entry.name, set: res.entry.set, title: res.entry.title, license: res.entry.license, style: res.style, styles: res.entry.styles, tags: res.entry.tags, svg_url: svgUrl(origin, res.entry) };
        if (res.format === "png") return json({ ...base, format: "png", note: "request format=svg to get markup inline" });
        return json({ ...base, format: "svg", svg: res.svg });
      }

      if (path === "/api/sets") {
        const catalog = await getCatalog(env);
        const map: Record<string, { count: number; license: string; styles: Set<string> }> = {};
        for (const e of catalog.entries) {
          const m = (map[e.set] = map[e.set] || { count: 0, license: e.license, styles: new Set<string>() });
          m.count++;
          for (const s of e.styles) m.styles.add(s);
        }
        return json({
          sets: Object.entries(map).map(([set, m]) => ({ set, count: m.count, license: m.license, styles: [...m.styles] })),
          total: catalog.entries.length,
        });
      }

      if (path === "/api/manifest") {
        const catalog = await getCatalog(env);
        return json({
          total: catalog.entries.length,
          icons: catalog.entries.map((e) => ({ id: e.id, name: e.name, set: e.set, styles: e.styles, tags: e.tags })),
        });
      }

      // ---- Landing page: markdown negotiation + agent-discovery Link headers ----
      if (path === "/" || path === "/index.html") {
        const accept = request.headers.get("accept") || "";
        if (accept.includes("text/markdown"))
          return text(homepageMarkdown(origin), 200, "text/markdown; charset=utf-8");
        const res = await env.ASSETS.fetch(request);
        const headers = new Headers(res.headers);
        headers.set(
          "link",
          [
            `<${origin}/.well-known/api-catalog>; rel="api-catalog"`,
            `<${origin}/openapi.json>; rel="service-desc"`,
            `<${origin}/llms.txt>; rel="service-doc"`,
            `<${origin}/mcp>; rel="related"; title="MCP server"`,
          ].join(", "),
        );
        return new Response(res.body, { status: res.status, headers });
      }

      // ---- Static assets ----
      return env.ASSETS.fetch(request);
    } catch (err: any) {
      return json({ error: "internal_error", detail: String(err?.message || err) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
