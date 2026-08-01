// Generate icon embeddings OFFLINE (no Cloudflare cost) using the same model
// Workers AI serves at query time: bge-small-en-v1.5 (384-dim).
// Outputs:
//   data/pack/embeddings.bin    Float32 matrix, N x 384, L2-normalized, row-major
//   data/pack/embed-index.json  [ "<set>/<name>", ... ] aligned with matrix rows
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "data", "pack");
const corpus = JSON.parse(readFileSync(join(OUT, "corpus.json"), "utf8"));
const ids = Object.keys(corpus);
const texts = ids.map((id) => corpus[id]);
console.log(`embedding ${ids.length} icons with Xenova/bge-small-en-v1.5 ...`);

const { pipeline } = await import("@xenova/transformers");
const extractor = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { quantized: true });

const DIM = 384;
const out = new Float32Array(ids.length * DIM);
const BATCH = 64;
let done = 0;

for (let i = 0; i < texts.length; i += BATCH) {
  const batch = texts.slice(i, i + BATCH);
  const res = await extractor(batch, { pooling: "mean", normalize: true });
  // res.data is Float32Array of shape [batch, DIM]
  out.set(res.data, i * DIM);
  done += batch.length;
  if (done % 1024 < BATCH) console.log(`  ${done}/${texts.length}`);
}

writeFileSync(join(OUT, "embeddings.bin"), Buffer.from(out.buffer));
writeFileSync(join(OUT, "embed-index.json"), JSON.stringify(ids));

console.log("----");
console.log(`vectors     : ${ids.length} x ${DIM}`);
console.log(`embeddings.bin : ${(out.byteLength / 1e6).toFixed(1)} MB`);
console.log(`wrote to    : ${OUT}`);
