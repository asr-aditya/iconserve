// One-shot deploy: create the R2 bucket (idempotent), push artifacts to remote R2,
// then deploy the Worker. Requires `wrangler login` first (or CLOUDFLARE_API_TOKEN).
import { execFileSync } from "node:child_process";

const BUCKET = "iconserve-icons";
const run = (args, opts = {}) => execFileSync("npx", ["wrangler", ...args], { stdio: "inherit", ...opts });

console.log("1/3  ensuring R2 bucket exists ...");
try {
  execFileSync("npx", ["wrangler", "r2", "bucket", "create", BUCKET], { stdio: "pipe" });
  console.log(`     created bucket "${BUCKET}".`);
} catch (e) {
  const msg = `${e.stdout || ""}${e.stderr || ""}`;
  if (/already (exists|owned)/i.test(msg)) {
    console.log(`     bucket "${BUCKET}" already exists — continuing.`);
  } else if (/enable R2/i.test(msg) || /10042/.test(msg)) {
    console.error(
      "\n✘ R2 is not enabled on this Cloudflare account.\n" +
        "  Enable it once here:  https://dash.cloudflare.com/  →  R2  →  \"Enable R2\"\n" +
        "  (Free tier: 10 GB storage, no egress fees. A payment method is required to\n" +
        "   activate, but nothing is charged under the free limits.)\n" +
        "  Then re-run:  npm run deploy\n",
    );
    process.exit(1);
  } else {
    console.error(msg);
    throw e;
  }
}

console.log("2/3  uploading packed artifacts to remote R2 ...");
run(["r2", "object", "put", `${BUCKET}/pack/icons.json`, "--file", "data/pack/icons.json", "--remote"]);
run(["r2", "object", "put", `${BUCKET}/pack/catalog.json`, "--file", "data/pack/catalog.json", "--remote"]);
run(["r2", "object", "put", `${BUCKET}/pack/embeddings.bin`, "--file", "data/pack/embeddings.bin", "--remote"]);
run(["r2", "object", "put", `${BUCKET}/pack/embed-index.json`, "--file", "data/pack/embed-index.json", "--remote"]);

console.log("3/3  deploying Worker ...");
run(["deploy"]);

console.log("\n✅ deployed. Your service is live at the workers.dev URL printed above.");
