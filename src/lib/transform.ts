import { initWasm, Resvg } from "@resvg/resvg-wasm";
// Wrangler compiles imported .wasm into a WebAssembly.Module binding.
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

export interface TransformOpts {
  color?: string | null;
  size?: number | null;
  stroke?: number | null;
}

// Accept hex (#rgb/#rrggbb/#rrggbbaa), CSS color keywords, and the sentinel "currentColor".
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const KEYWORD = /^[a-z]{1,32}$/i;

export function sanitizeColor(input: string): string | null {
  const c = input.trim();
  if (c.toLowerCase() === "currentcolor") return "currentColor";
  if (HEX.test(c)) return c;
  if (KEYWORD.test(c)) return c.toLowerCase(); // e.g. red, tomato, rebeccapurple
  return null;
}

export function clampSize(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(2048, Math.round(n)));
}

export function clampStroke(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(20, n));
}

export function applyTransforms(svg: string, opts: TransformOpts): string {
  let out = svg;

  if (opts.color) {
    // All canonical SVGs drive color through currentColor.
    out = out.replace(/currentColor/g, opts.color);
  }

  if (opts.stroke != null) {
    // Only the root tag carries stroke-width in our canonical form.
    out = out.replace(/(<svg\b[^>]*?)\sstroke-width="[^"]*"/, `$1 stroke-width="${opts.stroke}"`);
  }

  if (opts.size != null) {
    out = out.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/, `$1 width="${opts.size}"`);
    out = out.replace(/(<svg\b[^>]*?)\sheight="[^"]*"/, `$1 height="${opts.size}"`);
  }

  return out;
}

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) wasmReady = initWasm(resvgWasm as WebAssembly.Module);
  return wasmReady;
}

export async function rasterize(svg: string, size: number): Promise<Uint8Array> {
  await ensureWasm();
  const r = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  return r.render().asPng();
}
