"use strict";

// Adds one tracked inline image to published Markdown articles. It is safe to
// rerun: articles with inline_image are left exactly as they are.
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const lib = require("./lib/articles");
const { inlineImage, insertInlineImage } = require("./article-writer");

function refreshInlineImages({ root = path.join(__dirname, "..") } = {}) {
  const articlesDir = path.join(root, "content", "articles");
  const articles = lib.loadArticles(articlesDir).filter(article => article.data.published === true)
    .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)) || b.slug.localeCompare(a.slug));
  let changed = 0;
  for (const article of articles) {
    if (article.data.inline_image) continue;
    const image = inlineImage(article.data.category_label, { root, articlesDir,
      content: { title: article.data.title, body: article.body } });
    if (!image) continue;
    const body = insertInlineImage(article.body, image);
    if (body === article.body) continue;
    const data = { ...article.data, inline_image: image.image,
      inline_image_alt: require("./article-writer").inlineAlt(image.category),
      inline_image_category: image.category, inline_image_series: image.series,
      ...(image.hash ? { inline_image_hash: image.hash } : {}),
      inline_image_selection: image.profile };
    fs.writeFileSync(path.join(articlesDir, article.slug + ".md"),
      `---\n${YAML.stringify(data).trimEnd()}\n---\n\n${body.trim()}\n`, "utf8");
    changed += 1;
  }
  return { published: articles.length, changed };
}

if (require.main === module) console.log(JSON.stringify(refreshInlineImages()));
module.exports = { refreshInlineImages };
