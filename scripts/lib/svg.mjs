// Regex-based normalizer for the machine-generated SVGs shipped by the icon sets.
// Produces a clean canonical <svg> whose color is driven by `currentColor`, so the
// serve-time transform layer can uniformly recolor/resize/re-stroke any icon.

const COMMENT = /<!--[\s\S]*?-->/g;
const STRIP_ATTRS = /\s+(?:class|aria-hidden|data-slot|role|focusable)="[^"]*"/g;
const TITLE_TAG = /<title>[\s\S]*?<\/title>/g;

function getAttr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`, "i"));
  return m ? m[1] : null;
}

/**
 * @param {string} raw  raw SVG file contents
 * @param {{mode:'stroke'|'fill', strokeWidth?:number}} opts
 * @returns {{svg:string, viewBox:string, strokeWidth:number|null}}
 */
export function normalizeSvg(raw, opts) {
  let s = raw.replace(COMMENT, "").trim();

  const open = s.match(/<svg[\s\S]*?>/i);
  if (!open) throw new Error("no <svg> root found");
  const openTag = open[0];

  const viewBox = getAttr(openTag, "viewBox") || "0 0 24 24";
  const origStroke = getAttr(openTag, "stroke-width");

  // inner content between root open tag and closing </svg>
  let inner = s.slice(open.index + openTag.length).replace(/<\/svg>\s*$/i, "");
  inner = inner.replace(STRIP_ATTRS, "").replace(TITLE_TAG, "").trim();

  let root;
  let strokeWidth = null;
  if (opts.mode === "stroke") {
    strokeWidth = Number(origStroke ?? opts.strokeWidth ?? 2);
    root =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="24" height="24" ` +
      `fill="none" stroke="currentColor" stroke-width="${strokeWidth}" ` +
      `stroke-linecap="round" stroke-linejoin="round">`;
  } else {
    root =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="24" height="24" ` +
      `fill="currentColor">`;
  }

  return { svg: `${root}${inner}</svg>`, viewBox, strokeWidth };
}
