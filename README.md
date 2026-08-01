# IconServe

A free, agent-readable service that aggregates **10,000+ open-source icons** — [Lucide](https://lucide.dev),
[Heroicons](https://heroicons.com), [Tabler](https://tabler.io/icons), and [Simple Icons](https://simpleicons.org) —
and serves them as **SVG or PNG** at predictable URLs, with keyword + semantic search, an `llms.txt`, and an MCP server.

Runs entirely within the **Cloudflare free tier** (Workers + R2 + Workers AI).

## How an agent uses it

| Need | Do this |
|---|---|
| Embed an icon you know the name of | `GET /i/{name}.svg` (best match) or `/icons/{set}/{name}.svg` |
| Find the right icon | `GET /api/search?q=shopping+cart` → names + ready URLs |
| Read the whole API in one shot | `GET /llms.txt` (or `/llms-full.txt`) |
| Native tool calls | MCP server at `/mcp` (`search_icons`, `get_icon`, `list_sets`) |
| OpenAPI | `GET /openapi.json` |

### Discoverability surfaces (for crawling/browsing agents)

- `GET /icon/{set}/{name}` — crawlable HTML page per icon (preview, usage, JSON-LD `ImageObject` + breadcrumb). `/icon/{name}` 302-redirects to the best match.
- `GET /sitemap.xml` — every icon page (~10k URLs).
- `GET /robots.txt` — explicitly **allows** AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, …) and points to the sitemap.
- Landing page carries `WebSite`+`SearchAction` and `WebAPI` JSON-LD and Open Graph tags.
- **IndexNow**: key file served at `/{INDEXNOW_KEY}.txt`; `npm run indexnow` pings Bing/Yandex to crawl new or changed URLs instantly (pass paths to submit a subset, e.g. `npm run indexnow /icon/lucide/house`).

### Transforms (query params on any icon URL)

- `color=` hex / CSS color / `currentColor` — e.g. `?color=%23e11d48`
- `size=` `1..2048` px
- `stroke=` `0..20` (line icons)
- `style=` e.g. `solid` (Heroicons), `filled` (Tabler)
- `format=` `svg` | `png`

Example: `/i/shopping-cart.svg?color=crimson&size=48&stroke=1.5`

## Architecture

```
Build (offline, on your machine — no Cloudflare cost)
  scripts/ingest.mjs  → data/pack/icons.json  (id → normalized SVG, currentColor-driven)
                        data/pack/catalog.json (names, tags, aliases, license, styles)
                        data/pack/corpus.json  (search text per icon)
  scripts/embed.mjs   → data/pack/embeddings.bin  (10k × 384, bge-small-en-v1.5)
                        data/pack/embed-index.json

Cloudflare
  R2 (ICONS)   holds the 4 packed artifacts; loaded once per isolate into memory
  Workers AI   embeds ONLY the query string at search time (same 384-dim model)
  Worker       routing, color/size/stroke transforms, PNG (resvg-wasm), search, MCP, docs
  Assets       public/index.html landing page
```

Semantic search = keyword ranking **fused** (reciprocal-rank fusion) with cosine similarity over the
in-memory embeddings. No Vectorize, no per-vector billing, no dimension cap. If `embeddings.bin` is
absent, search gracefully falls back to keyword-only.

## Local development

```bash
npm install
npm run build:data     # ingest + embed  (embed downloads a ~40MB model once)
npm run upload:r2      # push artifacts into the LOCAL R2 store
npm run dev            # http://localhost:8787
```

> In `wrangler dev --local` the Workers AI binding is offline, so search runs keyword-only locally.
> Semantic search activates once deployed (or when running against the remote AI binding).

## Deploy (Cloudflare free tier)

```bash
wrangler login         # one-time, opens a browser
npm run deploy         # creates the R2 bucket, uploads artifacts, deploys the Worker
```

`npm run deploy` runs [`scripts/deploy.mjs`](scripts/deploy.mjs): it creates the `iconserve-icons`
bucket (idempotent), uploads the four artifacts to **remote** R2, then `wrangler deploy`.

## Adding / updating icon sets

Edit [`scripts/lib/sets.mjs`](scripts/lib/sets.mjs), then re-run `npm run build:data && npm run upload:r2`
(local) or `npm run deploy` (remote). Set priority for `/i/{name}` best-match is `DEFAULT_SET_ORDER` in
[`wrangler.toml`](wrangler.toml).

## Licensing

Icons are redistributed under their original permissive licenses: Lucide (ISC), Heroicons (MIT),
Tabler (MIT), Simple Icons (CC0). Brand marks from Simple Icons are trademarks of their respective
owners — use them per each brand's guidelines.
