"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const YAML = require("yaml");
const images = require("../scripts/lib/image-library");
const { saveArticleDraft } = require("../scripts/article-writer");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-images-"));
  const articles = path.join(root, "content", "articles");
  fs.mkdirSync(articles, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, articles };
}
function image(root, name) {
  const file = path.join(root, "assets", "images", "blog-library", "hero", name);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "image");
}
function article(directory, slug, date, imagePath, category = "web") {
  fs.writeFileSync(path.join(directory, slug + ".md"), "---\n" + YAML.stringify({
    title: slug, date, slug, image: imagePath, image_category: category, image_role: "hero", published: true
  }).trimEnd() + "\n---\n\nbody\n");
}

test("discovers new hero files, derives categories and records Markdown image history", t => {
  const value = fixture(t);
  image(value.root, "nested/hero-ai-02.webp"); image(value.root, "seo-05.webp");
  article(value.articles, "published-post", "2026-09-12", "assets/images/blog-library/hero/seo-05.webp", "seo");
  assert.deepEqual(images.discoverImages({ root: value.root }).map(item => [item.path, item.category]), [
    ["assets/images/blog-library/hero/nested/hero-ai-02.webp", "ai"],
    ["assets/images/blog-library/hero/seo-05.webp", "seo"]
  ]);
  assert.deepEqual(images.usageHistory({ articlesDir: value.articles })[0], {
    image: "assets/images/blog-library/hero/seo-05.webp", category: "seo", series: "seo", article: "published-post", date: "2026-09-12"
  });
});

test("prefers category matches, avoids the latest ten and never repeats the latest image when another exists", () => {
  const candidates = ["hero-web-01.webp", "hero-web-02.webp", "hero-seo-01.webp"].map(file => ({
    path: "assets/images/blog-library/hero/" + file, category: images.categoryFor(file), series: images.seriesFor(file, images.categoryFor(file))
  }));
  const history = [
    { image: candidates[0].path, category: "web", series: candidates[0].series, article: "newest", date: "2026-09-12" },
    { image: candidates[1].path, category: "web", series: candidates[1].series, article: "older", date: "2026-09-11" }
  ];
  assert.equal(images.selectImage({ category: "ホームページ制作", candidates, history }).path, candidates[2].path);
  const eleven = Array.from({ length: 11 }, (_, index) => ({ image: candidates[index % 2].path, article: "a" + index, date: "2026-09-" + String(30 - index).padStart(2, "0") }));
  assert.equal(images.selectImage({ category: "web", candidates: candidates.slice(0, 2), history: eleven }).path, candidates[1].path);
});

test("reuses the oldest eligible candidate only after exhaustion and falls back when the library is empty", t => {
  const candidates = ["hero-ai-01.webp", "hero-ai-02.webp"].map(file => ({ path: file, category: "ai", series: file }));
  const history = [{ image: "hero-ai-02.webp", article: "latest", date: "2026-09-12" }, { image: "hero-ai-01.webp", article: "old", date: "2026-01-01" }];
  assert.equal(images.selectImage({ category: "ai", candidates, history }).path, "hero-ai-01.webp");
  const value = fixture(t);
  const topic = { title: "AI画像の選び方", category: "AI活用", target: "福祉事業所", keyword: "AI", reason: "画像選択の確認", angle: "画像を分散する", service: "IT支援" }, articleData = { title: "AI画像の選び方", description: "説明".repeat(20), bodyMarkdown: "## 一つ目\n\n" + "本文".repeat(250) + "\n\n## 二つ目\n\n" + "本文".repeat(250) + "\n\n## 三つ目\n\n" + "本文".repeat(250) };
  const saved = saveArticleDraft({ article: articleData, topic, date: "2026-09-13", directory: value.articles, imageRoot: value.root });
  assert.match(fs.readFileSync(saved.filePath, "utf8"), /assets\/images\/services\/service-ai-support\.jpg/);
});
