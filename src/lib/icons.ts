import type { Env, CatalogEntry } from "../types";
import { getCatalog, getIcons, resolveBest } from "./store";
import {
  applyTransforms,
  rasterize,
  sanitizeColor,
  clampSize,
  clampStroke,
} from "./transform";

export interface IconRequest {
  set?: string | null;
  name: string;
  style?: string | null;
  color?: string | null;
  size?: string | number | null;
  stroke?: string | number | null;
  format?: string | null;
}

export type IconResult =
  | { ok: true; entry: CatalogEntry; style: string; format: "svg"; svg: string }
  | { ok: true; entry: CatalogEntry; style: string; format: "png"; png: Uint8Array }
  | { ok: false; status: number; error: string };

export async function renderIcon(env: Env, req: IconRequest): Promise<IconResult> {
  const order = env.DEFAULT_SET_ORDER.split(",").map((s) => s.trim());
  const catalog = await getCatalog(env);

  const entry = req.set
    ? catalog.byId.get(`${req.set}/${req.name}`) || null
    : resolveBest(catalog, req.name, order);
  if (!entry) return { ok: false, status: 404, error: `icon not found: ${req.set ? req.set + "/" : ""}${req.name}` };

  const style = req.style && entry.styles.includes(req.style) ? req.style : entry.defaultStyle;

  const icons = await getIcons(env);
  const raw = icons[`${entry.set}/${entry.name}/${style}`];
  if (!raw) return { ok: false, status: 404, error: `variant not found: ${entry.id}/${style}` };

  let color: string | null = null;
  if (req.color) {
    color = sanitizeColor(String(req.color));
    if (!color) return { ok: false, status: 400, error: `invalid color: ${req.color}` };
  }
  const size = req.size != null && req.size !== "" ? clampSize(Number(req.size)) : null;
  if (req.size != null && req.size !== "" && size == null)
    return { ok: false, status: 400, error: `invalid size: ${req.size}` };
  const stroke = req.stroke != null && req.stroke !== "" ? clampStroke(Number(req.stroke)) : null;
  if (req.stroke != null && req.stroke !== "" && stroke == null)
    return { ok: false, status: 400, error: `invalid stroke: ${req.stroke}` };

  const svg = applyTransforms(raw, { color, size, stroke });

  if ((req.format || "svg").toLowerCase() === "png") {
    const png = await rasterize(svg, size || 256);
    return { ok: true, entry, style, format: "png", png };
  }
  return { ok: true, entry, style, format: "svg", svg };
}
