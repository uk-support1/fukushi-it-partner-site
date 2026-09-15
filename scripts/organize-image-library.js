#!/usr/bin/env node
"use strict";

// Renames every library file to its stable role/category/sequence form and
// updates every repository reference in the same pass.
const fs = require("fs");
const path = require("path");
const images = require("./lib/image-library");

const CATEGORIES = ["welfare", "web", "recruit", "ai", "dx", "seo", "subsidy", "security"];
const INCOMING_CATEGORIES = [
  [/20260915-021\d+/, "ai"], [/20260915-022[0-5]\d+/, "welfare"],
  [/20260915-022[6-9]\d+/, "seo"], [/20260915-023\d+/, "subsidy"],
  [/20260915-024\d+/, "security"], [/情報セキュリティ/, "security"]
];

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function incomingCategory(file) {
  return INCOMING_CATEGORIES.find(([pattern]) => pattern.test(file))?.[1] || "welfare";
}

function semanticCategory(metadata, fallback) {
  const theme = metadata?.themes?.[0];
  const map = { digital: "dx", welfare: "welfare", recruit: "recruit", ai: "ai", web: "web", seo: "seo", subsidy: "subsidy", security: "security" };
  return map[theme] || fallback;
}

function organizeImageLibrary({ root = path.join(__dirname, "..") } = {}) {
  const catalogFile = path.join(root, "data", "image-library.json");
  const catalog = JSON.parse(fs.readFileSync(catalogFile, "utf8"));
  const byPath = new Map(catalog.images.map(item => [item.path, item]));
  const mappings = [];
  for (const kind of ["hero", "inline"]) {
    const directory = path.join(root, "assets", "images", "blog-library", kind);
    const records = walk(directory).filter(file => /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file)).map(file => {
      const relative = path.relative(root, file).replace(/\\/g, "/");
      const old = byPath.get(relative);
      const category = old ? semanticCategory(old, old.category) : (path.basename(file).startsWith("incoming-") ? incomingCategory(path.basename(file)) : images.categoryFor(relative));
      return { file, relative, category, metadata: old };
    });
    for (const category of CATEGORIES) {
      const selected = records.filter(record => record.category === category).sort((a, b) => a.relative.localeCompare(b.relative));
      selected.forEach((record, index) => {
        const extension = path.extname(record.file).toLowerCase();
        const nextName = `${kind}-${category}-${String(index + 1).padStart(3, "0")}${extension}`;
        const nextRelative = `assets/images/blog-library/${kind}/${nextName}`;
        mappings.push({ ...record, nextRelative, nextFile: path.join(directory, nextName) });
      });
    }
  }
  const changed = mappings.filter(mapping => mapping.relative !== mapping.nextRelative);
  changed.forEach((mapping, index) => {
    mapping.temporary = path.join(path.dirname(mapping.file), `.__image-library-${index}.tmp`);
    fs.renameSync(mapping.file, mapping.temporary);
  });
  changed.forEach(mapping => fs.renameSync(mapping.temporary, mapping.nextFile));

  const replacements = changed.map(mapping => [mapping.relative, mapping.nextRelative]);
  let updatedFiles = 0;
  for (const file of walk(root).filter(file => /\.(?:md|html|json|js|css)$/i.test(file) && !file.includes(`${path.sep}node_modules${path.sep}`))) {
    let value = fs.readFileSync(file, "utf8"), next = value;
    replacements.forEach(([from], index) => { next = next.split(from).join(`__IMAGE_LIBRARY_${index}__`); });
    replacements.forEach(([, to], index) => { next = next.split(`__IMAGE_LIBRARY_${index}__`).join(to); });
    if (next !== value) { fs.writeFileSync(file, next, "utf8"); updatedFiles++; }
  }
  const metadata = catalog.images.map(item => {
    const mapping = mappings.find(entry => entry.relative === item.path);
    return mapping ? { ...item, path: mapping.nextRelative, category: mapping.category } : item;
  });
  fs.writeFileSync(catalogFile, JSON.stringify({ ...catalog, images: metadata }, null, 2) + "\n", "utf8");
  return { hero: mappings.filter(item => item.nextRelative.includes("/hero/")).length,
    inline: mappings.filter(item => item.nextRelative.includes("/inline/")).length,
    renamedHero: changed.filter(item => item.nextRelative.includes("/hero/")).length,
    renamedInline: changed.filter(item => item.nextRelative.includes("/inline/")).length, updatedFiles };
}

if (require.main === module) console.log(JSON.stringify(organizeImageLibrary()));
module.exports = { organizeImageLibrary, incomingCategory, semanticCategory };
