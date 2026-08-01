# IconServe — Handoff / Next Steps

Self-contained handoff so any new session (or person) can pick up. Last updated 2026-08-01.

## 🎯 Current goal
**Get 10 real external agents to use IconServe, spending $0.**
- "Real external agent" = a distinct external client that makes an MCP `tools/call` or fetches icons,
  **excluding** `family=claude-code` (our own dev connection), `kind=bot`, and monitors.
- Measure with: `npm run analytics` → look at **MCP tool calls** and **Visitors by kind/family**.
- Current status: ~0 real external agents. The product is fully built, discoverable, and zero-friction to
  install; what's missing is **distribution** (telling people it exists). Do NOT fake traffic.

## Live facts
- **Live:** https://iconserve.icons-for-agents.workers.dev
- **Repo:** https://github.com/asr-aditya/iconserve (public) · local `~/arctan/agent-builder`
- **MCP endpoint:** `https://iconserve.icons-for-agents.workers.dev/mcp` (streamable-HTTP; tools: `search_icons`, `get_icon`, `list_sets`)
- **CF account:** `297ea7e53852547dc74bae89787cf30b`, workers.dev subdomain `icons-for-agents`
- Stack: Cloudflare Worker + R2 (`iconserve-icons`) + Workers AI + Analytics Engine (`iconserve_events`). All free tier.

## What is ALREADY done (don't rebuild)
- Core: 10,137 icons, SVG/PNG transforms, keyword+semantic search, JSON API, MCP server.
- Discovery/SEO: `llms.txt` + `llms-full.txt`, OpenAPI, robots.txt (AI bots allowed + Content-Signals),
  `sitemap.xml` + `sitemap.md`, per-icon HTML pages + `.md` markdown mirrors, `/for-ai-agents` pillar page,
  JSON-LD, RFC 8288 Link headers, `AGENTS.md`.
- Agent-readiness: `/.well-known/api-catalog`, `/.well-known/mcp/server-card.json`,
  `/.well-known/agent-skills/index.json` (+ SKILL.md files), WebMCP on the homepage.
  Scores: isitagentready.com = **71 (Level 5 Agent-Native)**; agent-ready.dev = **74** / llms.txt **100**.
- Distribution done: GitHub (public, topics), **official MCP registry** (`server.json`), **Smithery** (live).
  PulseMCP/mcp.so/Glama auto-ingest from the official registry (~1 week).
- Search: Google Search Console verified + sitemap submitted (homepage **indexed**); Bing Webmaster verified
  + sitemap; **IndexNow** live (`npm run indexnow`) — all URLs submitted.
- Analytics: Analytics Engine instrumentation (agent/human/bot classification, route, MCP funnel, raw UA,
  `?ref=` campaign tag). Query with `npm run analytics [days]` (needs a CF API token, see below).
- **Integration pages** (zero-friction install): `/integrations` + `/integrations/{claude-code,claude-desktop,cursor,windsurf,cline,any-mcp-client}`.

## ▶️ IMMEDIATE NEXT STEP: distribution (the only thing between us and 10 agents)
Full post drafts were written this session (regenerate if lost). Post these FREE, spaced over a few days,
engage with every comment. Each links to a `?ref=`-tagged URL so `npm run analytics` shows attribution.

| # | Channel | Where | ref tag | Status |
|---|---------|-------|---------|--------|
| 1 | r/mcp | reddit.com/r/mcp/submit (text) | reddit-mcp | ⬜ user to post |
| 2 | Show HN | news.ycombinator.com/submit | hn | ⬜ user to post |
| 3 | r/ClaudeAI | reddit.com/r/ClaudeAI/submit | reddit-claude | ⬜ user to post |
| 4 | X/Twitter | x.com/compose/post | x | ⬜ user to post |
| 5 | awesome-mcp-servers | github.com/punkpeye/awesome-mcp-servers (PR) | — | ⬜ user to PR |
| 6 | dev.to article | dev.to/new | devto | ⬜ user to post |
| 7 | r/LocalLLaMA, MCP Discords | (secondary) | reddit-localllama / discord | ⬜ optional |

Claude can draft/redraft all post text (tailored per channel). Claude CANNOT post (needs user's accounts) and must not fake traffic.

## After posting — measure
```bash
npm run analytics 1        # Campaign attribution table = which post drove clicks;
                           # MCP tool calls (excluding claude-code) = the real goal metric
```
Double down on whichever `?ref=` converts.

## Remaining supporting levers (after posts)
- **Custom domain** — biggest structural lever. Unlocks DNS-AID (agent-readiness), fixes workers.dev SEO
  penalty, ranks for its own name, enables branded icon URLs (each embedded `<img>` = a backlink). ~$12/yr.
- More MCP registries needing manual submit: **LobeHub**, **PopularAiTools**, **Cursor directory**.
- Backlinks/content: guides, "IconServe + <tool>" tutorials.

## Key commands
```bash
npm run deploy        # build data + upload R2 + deploy (idempotent)
npx wrangler deploy   # deploy Worker only (R2 data unchanged) — faster
npm run indexnow      # ping Bing/Yandex (all URLs, or pass paths)
npm run analytics     # traffic report (needs CF API token)
```

## Gotchas / non-obvious things (learned this session)
- **Analytics token:** `npm run analytics` needs `CLOUDFLARE_API_TOKEN` with *Account · Account Analytics ·
  Read*. It's the USER's secret in their shell — Claude cannot/should not handle it; the user runs the query.
- **Analytics Engine latency:** ~30–60s before new events are queryable. Classification happens at
  write-time, so history does NOT re-classify when the classifier is updated.
- **`run_worker_first = true`** in wrangler.toml is REQUIRED — otherwise `/` is served straight from the
  asset layer and bypasses the Worker (no Link header / markdown negotiation / request logging for the homepage).
- **Deploy auth is occasionally flaky** (transient `Authentication error [code: 10000]`); just retry. If a
  stale `CLOUDFLARE_API_TOKEN` is exported, use `env -u CLOUDFLARE_API_TOKEN npx wrangler deploy`.
- **Edge propagation** after deploy is uneven for ~10–20s across colos; verify with a cache-busting query.
- **workers.dev penalty:** shared subdomain → weak SEO + Google is cautious ranking it even for its own name.
- **`indexed ≠ ranking`:** homepage is indexed on Google but won't rank for queries until it has authority
  (backlinks + time). This is expected; the launch posts are what build that.
- The big "unknown" traffic bucket was our OWN Claude Code MCP client polling `/mcp` (~510 hits) — infra
  noise, not demand. Real demand = external `tools/call`.
