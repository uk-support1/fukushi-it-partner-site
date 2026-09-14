#!/usr/bin/env node
"use strict";

// Reassigns published heroes deterministically. It keeps article content and
// publication metadata intact while making the visible article list unique by
// image bytes, not by filename.
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const lib = require("./lib/articles");
const images = require("./lib/image-library");
const { articleImageProfile } = require("./lib/image-semantics");
const { inlineAlt } = require("./article-writer");

function refreshHeroImages({ root = path.join(__dirname, "..") } = {}) {
  const articlesDir = path.join(root, "content", "articles");
  const candidates = images.discoverImages({ root, kind: "hero" });
  const articles = lib.loadArticles(articlesDir).filter(article => article.data.published === true)
    .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)) || b.slug.localeCompare(a.slug));
  const prior = images.usageHistory({ root, articlesDir, kind: "hero" });
  const duplicateHashes = new Set(prior.filter((use, index) => use.hash && prior.findIndex(other => other.hash === use.hash) !== index).map(use => use.hash));
  const history = [], usedHashes = new Set();
  let changed = 0;
  for (const article of articles) {
    const profile = articleImageProfile({ title: article.data.title, body: article.body, category: article.data.category_label });
    const selected = images.selectImage({ category: article.data.category_label, candidates, history,
      recentLimit: images.HERO_RECENT_ARTICLE_LIMIT, excludedHashes: usedHashes, profile });
    if (!selected) continue; // Empty library: preserve the safe legacy image.
    const data = { ...article.data, image: selected.path, image_alt: article.data.image_alt || inlineAlt(selected.category),
      image_role: "hero", image_category: selected.category, image_series: selected.series, image_hash: selected.hash };
    data.image_selection = profile;
    if (data.image !== article.data.image || data.image_hash !== article.data.image_hash || data.image_category !== article.data.image_category || data.image_series !== article.data.image_series) changed += 1;
    fs.writeFileSync(path.join(articlesDir, article.slug + ".md"), `---\n${YAML.stringify(data).trimEnd()}\n---\n\n${article.body.trim()}\n`, "utf8");
    history.push({ image: selected.path, hash: selected.hash, category: selected.category, series: selected.series, article: article.slug, date: String(article.data.date || "") });
    if (selected.hash) usedHashes.add(selected.hash);
  }
  return { published: articles.length, changed, duplicateHashes: duplicateHashes.size, candidates: candidates.length };
}

if (require.main === module) console.log(JSON.stringify(refreshHeroImages()));
module.exports = { refreshHeroImages };
