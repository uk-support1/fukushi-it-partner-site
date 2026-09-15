"use strict";

// Image selection is deliberately filesystem based: adding an image below
// assets/images/blog-library/{hero,inline} makes it available on the next run.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const lib = require("./articles");
const semantics = require("./image-semantics");

const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const RECENT_ARTICLE_LIMIT = 10;
const HERO_RECENT_ARTICLE_LIMIT = 20;
const CATEGORIES = ["welfare", "recruit", "ai", "dx", "web", "seo", "subsidy", "security"];
const NEAR_CATEGORIES = {
  web: ["seo", "dx"], ai: ["dx"], welfare: ["recruit"],
  subsidy: ["welfare", "dx"], security: ["dx"]
};
const JAPANESE_CATEGORIES = {
  "AI活用": "ai", "IT活用": "dx", "業務効率化": "dx", "補助金活用": "subsidy",
  "採用": "recruit", "ホームページ制作": "web", "Googleマップ／Googleビジネスプロフィール": "seo"
};

function normalizePath(value) { return String(value || "").replace(/\\/g, "/").replace(/^\/+/, ""); }

function categoryFor(value) {
  const text = String(value || "").toLowerCase();
  if (JAPANESE_CATEGORIES[value]) return JAPANESE_CATEGORIES[value];
  return CATEGORIES.find(category => new RegExp("(?:^|[^a-z])" + category + "(?:[^a-z]|$)").test(text)) || "general";
}

function seriesFor(filePath, category) {
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase()
    .replace(/(?:^|[-_])(?:hero|inline)(?=[-_]|$)/g, "-")
    .replace(new RegExp("(?:^|[-_])" + category + "(?=[-_]|$)", "g"), "-")
    .replace(/[-_]?\d+$/, "").replace(/[-_]+/g, "-").replace(/^-|-$/g, "");
  return base || category;
}

function imageHash(filePath) {
  try { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
  catch { return null; }
}

function imageHashForPath(root, imagePath) {
  const relative = normalizePath(imagePath);
  if (!relative || !root) return null;
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) return null;
  return imageHash(absolute);
}

function walkImages(directory, root) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walkImages(absolute, root));
    else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const relative = normalizePath(path.relative(root, absolute));
      const category = categoryFor(relative);
      // Calculated once here and carried through selection, including renamed duplicates.
      found.push({ path: relative, category, series: seriesFor(relative, category), hash: imageHash(absolute) });
    }
  }
  return found;
}

function discoverImages({ root, kind = "hero", catalog: useCatalog = true } = {}) {
  if (!root) throw new Error("IMAGE_LIBRARY_ROOT_REQUIRED");
  let catalog = new Map();
  if (useCatalog) try {
    const source = JSON.parse(fs.readFileSync(path.join(root, "data", "image-library.json"), "utf8"));
    catalog = new Map((source.images || []).map(item => [item.path, item]));
  } catch { /* New files remain eligible with their inferred path metadata. */ }
  return walkImages(path.join(root, "assets", "images", "blog-library", kind), root)
    .map(candidate => ({ ...candidate, ...(catalog.get(candidate.path) || { tags: [candidate.category], themes: [candidate.category], scene: candidate.category, technology_level: "none" }) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function usageHistory({ root = path.join(__dirname, "..", ".."), articlesDir = lib.ARTICLES_DIR, kind = "hero" } = {}) {
  if (!fs.existsSync(articlesDir)) return [];
  const entries = [];
  for (const filename of fs.readdirSync(articlesDir).filter(name => /\.md$/i.test(name))) {
    try {
      const parsed = lib.parseFrontmatter(fs.readFileSync(path.join(articlesDir, filename), "utf8"));
      const prefix = kind === "hero" ? "image" : kind + "_image";
      if (!parsed.data[prefix]) continue;
      const image = normalizePath(parsed.data[prefix]);
      entries.push({ image, hash: parsed.data[prefix + "_hash"] || imageHashForPath(root, image), category: parsed.data[prefix + "_category"] ||
        categoryFor(parsed.data.category_label), series: parsed.data[prefix + "_series"] ||
        seriesFor(image, categoryFor(parsed.data[prefix + "_category"] || parsed.data.category_label)),
        article: parsed.data.slug || filename.replace(/\.md$/i, ""), date: String(parsed.data.date || "") });
    } catch { /* Invalid unrelated Markdown must not stop a publication. */ }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.article.localeCompare(a.article));
}

function sameImage(candidate, use) {
  return Boolean(candidate && use && candidate.hash && use.hash)
    ? candidate.hash === use.hash
    : candidate.path === use.image;
}

function selectImage({ category, candidates, history = [], recentLimit = RECENT_ARTICLE_LIMIT, excludedHashes = new Set(), profile = null } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const semanticSafe = profile ? candidates.filter(candidate => !semantics.isExcluded(candidate, profile)) : candidates;
  const safeCandidates = semanticSafe.length ? semanticSafe : candidates;
  const usable = safeCandidates.filter(candidate => !candidate.hash || !excludedHashes.has(candidate.hash));
  // Only relax page-level exclusions after every distinct image has been tried.
  const pool = usable.length ? usable : candidates;
  const wanted = categoryFor(category);
  const recent = history.slice(0, recentLimit);
  const latest = history[0];
  if (profile) {
    const scores = new Map(pool.map(candidate => [candidate, semantics.scoreImage(candidate, profile)]));
    const meaningful = pool.filter(candidate => scores.get(candidate) > 0);
    const semanticPool = meaningful.length ? meaningful : pool;
    const recentFree = semanticPool.filter(candidate => !recent.some(use => sameImage(candidate, use)));
    let eligible = recentFree.length ? recentFree : semanticPool;
    const withoutLatest = eligible.filter(candidate => !latest || !sameImage(candidate, latest));
    if (withoutLatest.length) eligible = withoutLatest;
    const withoutLatestSeries = eligible.filter(candidate => !latest || candidate.series !== latest.series);
    if (withoutLatestSeries.length) eligible = withoutLatestSeries;
    const categoryRank = candidate => candidate.category === wanted ? 0 : ((NEAR_CATEGORIES[wanted] || []).includes(candidate.category) ? 1 : 2);
    const lastUse = candidate => history.findIndex(use => sameImage(candidate, use));
    return eligible.slice().sort((a, b) => scores.get(b) - scores.get(a) || categoryRank(a) - categoryRank(b) ||
      (lastUse(a) < 0 ? 0 : 1) - (lastUse(b) < 0 ? 0 : 1) || lastUse(b) - lastUse(a) || a.path.localeCompare(b.path))[0];
  }
  const exact = pool.filter(candidate => candidate.category === wanted);
  const nearby = pool.filter(candidate => (NEAR_CATEGORIES[wanted] || []).includes(candidate.category));
  const unused = list => list.filter(candidate => !recent.some(use => sameImage(candidate, use)));
  // Prefer exact-category images, but let nearby categories fill a depleted
  // exact pool before reusing a recent image.
  let eligible = unused(exact);
  if (!eligible.length) eligible = unused(nearby);
  if (!eligible.length) eligible = unused(pool);
  if (!eligible.length) eligible = exact.length ? exact : (nearby.length ? nearby : pool);
  // A consecutive duplicate is never selected while a different image exists.
  const withoutLatest = eligible.filter(candidate => !latest || !sameImage(candidate, latest));
  if (withoutLatest.length) eligible = withoutLatest;
  const withoutLatestSeries = eligible.filter(candidate => !latest || candidate.series !== latest.series);
  if (withoutLatestSeries.length) eligible = withoutLatestSeries;
  const lastUse = candidate => history.findIndex(use => sameImage(candidate, use));
  return eligible.slice().sort((a, b) => {
    const aUse = lastUse(a), bUse = lastUse(b);
    const aUnused = aUse < 0 ? 0 : 1, bUnused = bUse < 0 ? 0 : 1;
    return aUnused - bUnused || bUse - aUse || a.path.localeCompare(b.path);
  })[0];
}

module.exports = { RECENT_ARTICLE_LIMIT, HERO_RECENT_ARTICLE_LIMIT, categoryFor, seriesFor, imageHash, imageHashForPath, discoverImages, usageHistory, selectImage, sameImage };
