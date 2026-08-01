// Upload the packed artifacts to R2 (local miniflare store and/or remote).
//   node scripts/upload.mjs           -> local (for `wrangler dev`)
//   node scripts/upload.mjs --remote  -> remote R2 bucket (for deploy)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BUCKET = "iconserve-icons";
const OUT = join(process.cwd(), "data", "pack");
const remote = process.argv.includes("--remote");
const scope = remote ? "--remote" : "--local";

const files = [
  ["pack/icons.json", "icons.json"],
  ["pack/catalog.json", "catalog.json"],
  ["pack/embeddings.bin", "embeddings.bin"],
  ["pack/embed-index.json", "embed-index.json"],
];

for (const [key, file] of files) {
  const path = join(OUT, file);
  if (!existsSync(path)) {
    console.log(`skip ${key} (missing ${file}${file.startsWith("embed") ? " — run npm run embed" : ""})`);
    continue;
  }
  console.log(`put ${scope} ${BUCKET}/${key}  <- ${file}`);
  execFileSync(
    "npx",
    ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", path, scope],
    { stdio: "inherit" },
  );
}
console.log("done.");
