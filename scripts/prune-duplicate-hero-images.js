#!/usr/bin/env node
"use strict";

// Removes only byte-identical hero files. The default mode is a read-only
// report; pass --apply to update tracked references/catalog data and delete
// redundant files after every replacement has succeeded.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const child = require("child_process");

const IMAGE_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const CANONICAL_PATTERN = /^hero-(?:welfare|web|recruit|ai|dx|seo|subsidy|security|general)-\d{3}\.(?:avif|gif|jpe?g|png|webp)$/i;
const TEXT_PATTERN = /\.(?:css|html|js|json|md|txt|xml|ya?ml)$/i;

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function duplicateGroups(heroDir) {
  const byHash = new Map();
  for (const name of fs.readdirSync(heroDir).filter(name => IMAGE_PATTERN.test(name)).sort()) {
    const hash = sha256(path.join(heroDir, name));
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(name);
  }
  return [...byHash].filter(([, names]) => names.length > 1).map(([hash, names]) => ({ hash, names }));
}

function chooseSurvivor(names) {
  return names.slice().sort((a, b) => Number(!CANONICAL_PATTERN.test(a)) - Number(!CANONICAL_PATTERN.test(b)) || a.localeCompare(b))[0];
}

function trackedTextFiles(root) {
  return child.execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString("utf8").split("\0")
    .filter(relative => relative && TEXT_PATTERN.test(relative) && relative !== "data/image-library.json")
    .map(relative => path.join(root, relative)).filter(file => fs.existsSync(file));
}

function pruneDuplicateHeroes({ root = path.join(__dirname, ".."), apply = false } = {}) {
  const heroDir = path.join(root, "assets", "images", "blog-library", "hero");
  const catalogPath = path.join(root, "data", "image-library.json");
  const groups = duplicateGroups(heroDir);
  const replacements = new Map();
  for (const group of groups) {
    group.survivor = chooseSurvivor(group.names);
    group.removed = group.names.filter(name => name !== group.survivor);
    for (const name of group.removed) replacements.set(
      `assets/images/blog-library/hero/${name}`,
      `assets/images/blog-library/hero/${group.survivor}`
    );
  }
  const report = { groups: groups.length, removed: replacements.size,
    survivors: fs.readdirSync(heroDir).filter(name => IMAGE_PATTERN.test(name)).length - replacements.size,
    referenceRewrites: 0, details: groups };
  if (!apply || replacements.size === 0) return report;

  // Update complete path tokens in tracked source/public files first.
  const token = /assets\/images\/blog-library\/hero\/[^\s"'`)<>]+/g;
  for (const file of trackedTextFiles(root)) {
    const before = fs.readFileSync(file, "utf8");
    const after = before.replace(token, value => {
      const trailing = value.match(/[),.;:]+$/)?.[0] || "";
      const clean = trailing ? value.slice(0, -trailing.length) : value;
      const replacement = replacements.get(clean);
      if (!replacement) return value;
      report.referenceRewrites += 1;
      return replacement + trailing;
    });
    if (after !== before) fs.writeFileSync(file, after, "utf8");
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  catalog.images = catalog.images.filter(item => !replacements.has(item.path));
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");

  // Delete only after references and catalog entries have been updated.
  const resolvedHero = path.resolve(heroDir) + path.sep;
  for (const imagePath of replacements.keys()) {
    const absolute = path.resolve(root, imagePath);
    if (!absolute.startsWith(resolvedHero) || !fs.existsSync(absolute)) throw new Error(`UNSAFE_DUPLICATE_PATH:${imagePath}`);
    fs.unlinkSync(absolute);
  }
  const remaining = duplicateGroups(heroDir);
  if (remaining.length) throw new Error(`DUPLICATES_REMAIN:${remaining.length}`);
  return report;
}

if (require.main === module) {
  const result = pruneDuplicateHeroes({ apply: process.argv.includes("--apply") });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { duplicateGroups, chooseSurvivor, pruneDuplicateHeroes };
