import type { CatalogEntry } from "../types";

// Build a hosted SVG/PNG URL for an icon, echoing any transform params.
export function svgUrl(origin: string, entry: CatalogEntry, opts?: any): string {
  const qs = new URLSearchParams();
  if (opts?.color) qs.set("color", String(opts.color));
  if (opts?.size) qs.set("size", String(opts.size));
  if (opts?.stroke != null && opts.stroke !== "") qs.set("stroke", String(opts.stroke));
  if (opts?.style) qs.set("style", String(opts.style));
  if (opts?.format && String(opts.format).toLowerCase() === "png") qs.set("format", "png");
  const q = qs.toString();
  return `${origin}/icons/${entry.set}/${entry.name}.svg${q ? "?" + q : ""}`;
}
