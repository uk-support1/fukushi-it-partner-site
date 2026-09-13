"use strict";

// Image selection is deliberately filesystem based: adding an image below
// assets/images/blog-library/{hero,inline} makes it available on the next run.
const fs = require("fs");
const path = require("path");
const lib = require("./articles");

const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const RECENT_ARTICLE_LIMIT = 10;
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

function walkImages(directory, root) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walkImages(absolute, root));
    else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const relative = normalizePath(path.relative(root, absolute));
      const category = categoryFor(relative);
      found.push({ path: relative, category, series: seriesFor(relative, category) });
    }
  }
  return found;
}

function discoverImages({ root, kind = "hero" } = {}) {
  if (!root) throw new Error("IMAGE_LIBRARY_ROOT_REQUIRED");
  return walkImages(path.join(root, "assets", "images", "blog-library", kind), root)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function usageHistory({ articlesDir = lib.ARTICLES_DIR } = {}) {
  if (!fs.existsSync(articlesDir)) return [];
  const entries = [];
  for (const filename of fs.readdirSync(articlesDir).filter(name => /\.md$/i.test(name))) {
    try {
      const parsed = lib.parseFrontmatter(fs.readFileSync(path.join(articlesDir, filename), "utf8"));
      if (!parsed.data.image) continue;
      entries.push({ image: normalizePath(parsed.data.image), category: parsed.data.image_category ||
        categoryFor(parsed.data.category_label), series: parsed.data.image_series ||
        seriesFor(parsed.data.image, categoryFor(parsed.data.image_category || parsed.data.category_label)),
        article: parsed.data.slug || filename.replace(/\.md$/i, ""), date: String(parsed.data.date || "") });
    } catch { /* Invalid unrelated Markdown must not stop a publication. */ }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.article.localeCompare(a.article));
}

function selectImage({ category, candidates, history = [] } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const wanted = categoryFor(category);
  const exact = candidates.filter(candidate => candidate.category === wanted);
  const nearby = candidates.filter(candidate => (NEAR_CATEGORIES[wanted] || []).includes(candidate.category));
  const recent = history.slice(0, RECENT_ARTICLE_LIMIT);
  const latest = history[0];
  const unused = list => list.filter(candidate => !recent.some(use => use.image === candidate.path));
  // Prefer exact-category images, but let nearby categories fill a depleted
  // exact pool before reusing a recent image.
  let eligible = unused(exact);
  if (!eligible.length) eligible = unused(nearby);
  if (!eligible.length) eligible = unused(candidates);
  if (!eligible.length) eligible = exact.length ? exact : (nearby.length ? nearby : candidates);
  const withoutLatest = eligible.filter(candidate => !latest || candidate.path !== latest.image);
  if (withoutLatest.length) eligible = withoutLatest;
  const withoutLatestSeries = eligible.filter(candidate => !latest || candidate.series !== latest.series);
  if (withoutLatestSeries.length) eligible = withoutLatestSeries;
  const lastUse = candidate => history.findIndex(use => use.image === candidate.path);
  return eligible.slice().sort((a, b) => {
    const aUse = lastUse(a), bUse = lastUse(b);
    const aUnused = aUse < 0 ? 0 : 1, bUnused = bUse < 0 ? 0 : 1;
    return aUnused - bUnused || bUse - aUse || a.path.localeCompare(b.path);
  })[0];
}

module.exports = { RECENT_ARTICLE_LIMIT, categoryFor, seriesFor, discoverImages, usageHistory, selectImage };
