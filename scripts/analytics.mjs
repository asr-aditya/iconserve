#!/usr/bin/env node
// Query the IconServe Analytics Engine dataset (agent/human traffic + MCP funnel).
//
// Needs a Cloudflare API token with "Account Analytics: Read" permission:
//   CLOUDFLARE_API_TOKEN=... [CLOUDFLARE_ACCOUNT_ID=...] npm run analytics [-- <days>]
//
// Create a token at https://dash.cloudflare.com/profile/api-tokens
// (Custom token -> Permissions: Account · Account Analytics · Read).

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "297ea7e53852547dc74bae89787cf30b";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const DATASET = "iconserve_events";
const DAYS = Number(process.argv[2]) || 7;

if (!TOKEN) {
  console.error(
    "Missing CLOUDFLARE_API_TOKEN.\n" +
      "Create one at https://dash.cloudflare.com/profile/api-tokens with\n" +
      "  Account · Account Analytics · Read\n" +
      "then run:  CLOUDFLARE_API_TOKEN=xxxx npm run analytics",
  );
  process.exit(1);
}

const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/analytics_engine/sql`;

async function q(sql) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "text/plain" },
    body: sql,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text).data || [];
  } catch {
    throw new Error(`Non-JSON response: ${text.slice(0, 300)}`);
  }
}

function table(rows, cols) {
  if (!rows.length) {
    console.log("  (no data yet)");
    return;
  }
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (vals) => "  " + vals.map((v, i) => String(v).padEnd(widths[i])).join("  ");
  console.log(line(cols));
  console.log("  " + widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) console.log(line(cols.map((c) => r[c] ?? "")));
}

const WINDOW = `timestamp > NOW() - INTERVAL '${DAYS}' DAY`;
// SUM(_sample_interval) reverses Analytics Engine's adaptive sampling into an estimated true count.

async function main() {
  console.log(`\n=== IconServe traffic — last ${DAYS} day(s) ===\n`);

  console.log("Visitors by kind:");
  table(
    await q(`SELECT blob1 AS kind, SUM(_sample_interval) AS hits FROM ${DATASET} WHERE ${WINDOW} GROUP BY kind ORDER BY hits DESC`),
    ["kind", "hits"],
  );

  console.log("\nAgents / bots by family:");
  table(
    await q(`SELECT blob2 AS family, SUM(_sample_interval) AS hits FROM ${DATASET} WHERE ${WINDOW} AND blob1 IN ('agent','bot') GROUP BY family ORDER BY hits DESC`),
    ["family", "hits"],
  );

  console.log("\nTraffic by route:");
  table(
    await q(`SELECT blob3 AS route, SUM(_sample_interval) AS hits FROM ${DATASET} WHERE ${WINDOW} AND blob3 != 'mcp-rpc' GROUP BY route ORDER BY hits DESC`),
    ["route", "hits"],
  );

  console.log("\nMCP funnel (method):");
  table(
    await q(`SELECT blob8 AS method, SUM(_sample_interval) AS calls FROM ${DATASET} WHERE ${WINDOW} AND blob3 = 'mcp-rpc' GROUP BY method ORDER BY calls DESC`),
    ["method", "calls"],
  );

  console.log("\nMCP tool calls:");
  table(
    await q(`SELECT blob9 AS tool, SUM(_sample_interval) AS calls FROM ${DATASET} WHERE ${WINDOW} AND blob3 = 'mcp-rpc' AND blob9 != '' GROUP BY tool ORDER BY calls DESC`),
    ["tool", "calls"],
  );

  console.log("\nTop referers (who links to us):");
  table(
    await q(`SELECT blob1 AS kind, SUM(_sample_interval) AS hits FROM ${DATASET} WHERE ${WINDOW} AND blob6 = '1' GROUP BY kind ORDER BY hits DESC`),
    ["kind", "hits"],
  );
  console.log("");
}

main().catch((e) => {
  console.error("analytics error:", e.message);
  process.exit(1);
});
