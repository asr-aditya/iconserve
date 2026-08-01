// Configuration + loaders for each aggregated icon set, reading from node_modules.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const NM = join(process.cwd(), "node_modules");
const readJson = (rel) => JSON.parse(readFileSync(join(NM, rel), "utf8"));

const svgNames = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".svg"))
        .map((f) => f.slice(0, -4))
    : [];

// Official simple-icons slug algorithm (title -> filename).
function siSlug(title) {
  return title
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/\./g, "dot")
    .replace(/&/g, "and")
    .replace(/đ/g, "d")
    .replace(/ħ/g, "h")
    .replace(/ı/g, "i")
    .replace(/ĸ/g, "k")
    .replace(/ŀ/g, "l")
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/þ/g, "th")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export const SETS = [
  {
    key: "lucide",
    label: "Lucide",
    license: "ISC",
    homepage: "https://lucide.dev",
    styles: [{ name: "default", dir: join(NM, "lucide-static/icons"), mode: "stroke", default: true }],
    meta() {
      const tags = readJson("lucide-static/tags.json");
      return (name) => ({ tags: tags[name] || [], aliases: [], category: null, title: null });
    },
  },
  {
    key: "heroicons",
    label: "Heroicons",
    license: "MIT",
    homepage: "https://heroicons.com",
    styles: [
      { name: "outline", dir: join(NM, "heroicons/24/outline"), mode: "stroke", default: true },
      { name: "solid", dir: join(NM, "heroicons/24/solid"), mode: "fill" },
    ],
    meta() {
      return () => ({ tags: [], aliases: [], category: null, title: null });
    },
  },
  {
    key: "tabler",
    label: "Tabler",
    license: "MIT",
    homepage: "https://tabler.io/icons",
    styles: [
      { name: "outline", dir: join(NM, "@tabler/icons/icons/outline"), mode: "stroke", default: true },
      { name: "filled", dir: join(NM, "@tabler/icons/icons/filled"), mode: "fill" },
    ],
    meta() {
      const m = readJson("@tabler/icons/icons.json");
      return (name) => {
        const e = m[name];
        return {
          tags: e?.tags || [],
          aliases: [],
          category: e?.category || null,
          title: null,
        };
      };
    },
  },
  {
    key: "simple-icons",
    label: "Simple Icons",
    license: "CC0-1.0",
    homepage: "https://simpleicons.org",
    styles: [{ name: "default", dir: join(NM, "simple-icons/icons"), mode: "fill", default: true }],
    meta() {
      const data = readJson("simple-icons/_data/simple-icons.json");
      const arr = Array.isArray(data) ? data : data.icons || [];
      const bySlug = new Map();
      for (const e of arr) {
        const slug = e.slug || siSlug(e.title);
        const aliases = [];
        if (e.aliases) {
          for (const k of ["aka", "old", "dup"]) {
            const v = e.aliases[k];
            if (Array.isArray(v)) aliases.push(...v);
            else if (v && typeof v === "object") aliases.push(...v.map((x) => x.title || x));
          }
        }
        bySlug.set(slug, { title: e.title, aliases });
      }
      return (name) => {
        const e = bySlug.get(name);
        return {
          tags: [],
          aliases: e?.aliases || [],
          category: "brand",
          title: e?.title || null,
        };
      };
    },
  },
];

export function readSvg(dir, name) {
  return readFileSync(join(dir, `${name}.svg`), "utf8");
}

export { svgNames };
