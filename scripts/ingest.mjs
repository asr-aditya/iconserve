// Ingest the aggregated icon sets from node_modules into three packed artifacts:
//   data/pack/icons.json      { "<set>/<name>/<style>": "<svg>" }
//   data/pack/catalog.json    [ { id, name, set, title, license, defaultStyle, styles, tags, aliases, ... } ]
//   data/pack/corpus.json     { "<set>/<name>": "search text" }  (consumed by embed.mjs)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SETS, svgNames, readSvg } from "./lib/sets.mjs";
import { normalizeSvg } from "./lib/svg.mjs";

const OUT = join(process.cwd(), "data", "pack");
mkdirSync(OUT, { recursive: true });

const humanize = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const icons = {}; // packed svg strings
const catalog = []; // metadata
const corpus = {}; // search text for embeddings

let totalSvgs = 0;

for (const set of SETS) {
  const getMeta = set.meta();
  const defaultStyleName = (set.styles.find((s) => s.default) || set.styles[0]).name;

  // union of icon names across this set's styles
  const names = new Map(); // name -> { style -> dir }
  for (const style of set.styles) {
    for (const name of svgNames(style.dir)) {
      if (!names.has(name)) names.set(name, {});
      names.get(name)[style.name] = style;
    }
  }

  for (const [name, styleMap] of names) {
    const availStyles = set.styles.map((s) => s.name).filter((n) => styleMap[n]);
    const meta = getMeta(name);
    let strokeWidth = null;

    for (const styleName of availStyles) {
      const style = styleMap[styleName];
      try {
        const raw = readSvg(style.dir, name);
        const norm = normalizeSvg(raw, { mode: style.mode });
        icons[`${set.key}/${name}/${styleName}`] = norm.svg;
        if (styleName === defaultStyleName && norm.strokeWidth) strokeWidth = norm.strokeWidth;
        totalSvgs++;
      } catch (e) {
        console.warn(`skip ${set.key}/${name}/${styleName}: ${e.message}`);
      }
    }
    if (!availStyles.length) continue;

    const id = `${set.key}/${name}`;
    const title = meta.title || humanize(name);
    const tags = [...new Set(meta.tags.map((t) => String(t).toLowerCase()))];
    const aliases = [...new Set(meta.aliases.map((a) => String(a).toLowerCase()))];

    catalog.push({
      id,
      name,
      set: set.key,
      title,
      license: set.license,
      defaultStyle: availStyles.includes(defaultStyleName) ? defaultStyleName : availStyles[0],
      styles: availStyles,
      strokeWidth,
      category: meta.category,
      tags,
      aliases,
    });

    corpus[id] = [humanize(name), title, tags.join(" "), aliases.join(" "), meta.category || "", set.label]
      .filter(Boolean)
      .join(". ")
      .toLowerCase();
  }
  console.log(`${set.label.padEnd(14)} ${names.size} icons`);
}

catalog.sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(join(OUT, "icons.json"), JSON.stringify(icons));
writeFileSync(join(OUT, "catalog.json"), JSON.stringify(catalog));
writeFileSync(join(OUT, "corpus.json"), JSON.stringify(corpus));

const sizeMB = (s) => (Buffer.byteLength(s) / 1e6).toFixed(1);
console.log("----");
console.log(`catalog entries : ${catalog.length}`);
console.log(`svg variants    : ${totalSvgs}`);
console.log(`icons.json      : ${sizeMB(JSON.stringify(icons))} MB`);
console.log(`catalog.json    : ${sizeMB(JSON.stringify(catalog))} MB`);
console.log(`wrote to        : ${OUT}`);
