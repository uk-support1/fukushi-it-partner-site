"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const YAML = require("yaml");
const images = require("../scripts/lib/image-library");
const { saveArticleDraft } = require("../scripts/article-writer");
const { refreshInlineImages } = require("../scripts/refresh-inline-images");
const { refreshHeroImages } = require("../scripts/refresh-hero-images");
const { chooseSurvivor, pruneDuplicateHeroes } = require("../scripts/prune-duplicate-hero-images");
const { buildBlogIndex } = require("../scripts/generate-blog");
const { articleImageProfile } = require("../scripts/lib/image-semantics");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-images-"));
  const articles = path.join(root, "content", "articles");
  fs.mkdirSync(articles, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, articles };
}
function image(root, name, kind = "hero") {
  const file = path.join(root, "assets", "images", "blog-library", kind, name);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "image");
}
function article(directory, slug, date, imagePath, category = "web", body = "body") {
  fs.writeFileSync(path.join(directory, slug + ".md"), "---\n" + YAML.stringify({
    type: "column", title: slug, date, slug, image: imagePath, image_category: category, image_role: "hero", published: true
  }).trimEnd() + "\n---\n\n" + body + "\n");
}

test("discovers new hero files, derives categories and records Markdown image history", t => {
  const value = fixture(t);
  image(value.root, "nested/hero-ai-02.webp"); image(value.root, "seo-05.webp");
  article(value.articles, "published-post", "2026-09-12", "assets/images/blog-library/hero/seo-05.webp", "seo");
  assert.deepEqual(images.discoverImages({ root: value.root }).map(item => [item.path, item.category]), [
    ["assets/images/blog-library/hero/nested/hero-ai-02.webp", "ai"],
    ["assets/images/blog-library/hero/seo-05.webp", "seo"]
  ]);
  const history = images.usageHistory({ root: value.root, articlesDir: value.articles })[0];
  assert.deepEqual({ image: history.image, category: history.category, series: history.series, article: history.article, date: history.date }, {
    image: "assets/images/blog-library/hero/seo-05.webp", category: "seo", series: "seo", article: "published-post", date: "2026-09-12"
  });
  assert.equal(history.hash, images.discoverImages({ root: value.root })[1].hash);
});

test("recognizes every supported category from conventional hero filenames", () => {
  for (const category of ["ai", "dx", "web", "seo", "subsidy", "security", "recruit", "welfare", "general"]) {
    assert.equal(images.categoryFor("hero-" + category + "-01.webp"), category);
  }
});

test("the committed hero library is preferred over legacy fallback images", () => {
  const candidates = images.discoverImages({ root: path.resolve(__dirname, "..") });
  assert.equal(candidates.length, 86);
  assert.deepEqual(candidates.reduce((counts, candidate) => {
    counts[candidate.category] = (counts[candidate.category] || 0) + 1;
    return counts;
  }, {}), { ai: 9, dx: 8, general: 14, recruit: 9, security: 7, seo: 8, subsidy: 10, web: 6, welfare: 15 });
  for (const candidate of candidates) {
    assert.match(path.basename(candidate.path), /^hero-(welfare|recruit|ai|dx|web|seo|subsidy|security|general)-\d{3}\.(?:png|jpe?g|webp)$/);
    assert.ok(candidate.hash && candidate.tags.length && candidate.scene && candidate.themes.length && typeof candidate.has_person === "boolean");
  }
  assert.match(images.selectImage({ category: "補助金活用", candidates, history: [] }).path, /hero\/hero-subsidy-\d{3}/);
  assert.match(images.selectImage({ category: "AI活用", candidates, history: [] }).path, /hero\/hero-ai-\d{3}/);
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

test("SHA-256 treats renamed byte-identical heroes as one image and refreshes published cards uniquely", t => {
  const value = fixture(t);
  image(value.root, "hero-welfare-01.webp"); image(value.root, "hero-welfare-copy.webp");
  fs.writeFileSync(path.join(value.root, "assets/images/blog-library/hero/hero-recruit-01.webp"), "different");
  fs.mkdirSync(path.join(value.root, "assets/images/services"), { recursive: true });
  fs.writeFileSync(path.join(value.root, "assets/images/services/service-homepage.jpg"), "legacy");
  article(value.articles, "new", "2026-09-12", "assets/images/services/service-homepage.jpg", "welfare");
  article(value.articles, "old", "2026-09-11", "assets/images/services/service-homepage.jpg", "recruit");
  const candidates = images.discoverImages({ root: value.root });
  const duplicate = candidates.filter(candidate => candidate.path.includes("welfare"));
  const distinct = candidates.find(candidate => candidate.path.includes("recruit"));
  assert.equal(duplicate[0].hash, duplicate[1].hash);
  assert.equal(images.selectImage({ category: "welfare", candidates, history: [{ image: duplicate[0].path, hash: duplicate[0].hash }], recentLimit: 20 }).hash, distinct.hash);
  const result = refreshHeroImages({ root: value.root });
  assert.deepEqual(result, { published: 2, changed: 2, duplicateHashes: 1, candidates: 3 });
  const assigned = images.usageHistory({ root: value.root, articlesDir: value.articles });
  assert.notEqual(assigned[0].hash, assigned[1].hash);
});

test("blog index uses the Markdown hero without reselecting it", t => {
  const value = fixture(t);
  image(value.root, "hero-welfare-01.webp"); image(value.root, "hero-welfare-copy.webp");
  fs.writeFileSync(path.join(value.root, "assets/images/blog-library/hero/hero-recruit-01.webp"), "different");
  const published = [
    { slug: "new", body: "本文", data: { published: true, date: "2026-09-12", category_label: "福祉", title: "new", image: "same.jpg" } },
    { slug: "old", body: "本文", data: { published: true, date: "2026-09-11", category_label: "採用", title: "old", image: "same.jpg" } }
  ];
  const index = buildBlogIndex(published, value.root);
  assert.deepEqual(index.map(entry => entry.image), ["same.jpg", "same.jpg"]);
  assert.deepEqual(index.map(entry => entry.object_position), ["50% 50%", "50% 50%"]);
});

test("semantic profiles exclude unrelated strong themes and still choose a matching unused image", () => {
  const candidates = [
    { path: "welfare.png", category: "welfare", series: "support", hash: "a", tags: ["福祉", "支援", "相談"], scene: "福祉支援", themes: ["welfare"], technology_level: "none" },
    { path: "ai.png", category: "ai", series: "ai", hash: "b", tags: ["AI", "PC"], scene: "AI活用", themes: ["ai"], technology_level: "strong" },
    { path: "subsidy.png", category: "subsidy", series: "planning", hash: "c", tags: ["補助金", "申請"], scene: "申請計画", themes: ["subsidy"], technology_level: "none" },
    { path: "recruit.png", category: "recruit", series: "interview", hash: "d", tags: ["採用", "面談"], scene: "採用面談", themes: ["recruit"], technology_level: "none" },
    { path: "dx.png", category: "dx", series: "workflow", hash: "e", tags: ["PC", "Web", "デジタル"], scene: "PC作業", themes: ["digital"], technology_level: "strong" }
  ];
  const welfare = articleImageProfile({ title: "就労移行支援事業所で利用者に安心を伝えるホームページ", body: "利用者と家族への情報提供を整えます", category: "ホームページ制作" });
  assert.equal(images.selectImage({ category: "ホームページ制作", candidates, profile: welfare }).path, "welfare.png");
  const subsidy = articleImageProfile({ title: "補助金の申請準備", body: "申請書と予算を確認します", category: "補助金活用" });
  assert.equal(images.selectImage({ category: "補助金活用", candidates, profile: subsidy }).path, "subsidy.png");
  const recruit = articleImageProfile({ title: "採用面談の準備", body: "応募者と職員の面談", category: "採用" });
  assert.equal(images.selectImage({ category: "採用", candidates, profile: recruit, excludedHashes: new Set(["d"]) }).path, "welfare.png");
  const web = articleImageProfile({ title: "Webサイトの技術改善", body: "PCでデジタルなサイト制作を行う", category: "IT活用" });
  assert.equal(images.selectImage({ category: "IT活用", candidates, profile: web }).path, "dx.png");
});

test("SEO and strong Web heroes are excluded unless the article subject calls for them", () => {
  const candidates = [
    { path: "general.png", category: "general", series: "office", hash: "g", tags: ["一般事務"], scene: "一般的な事務作業", themes: ["general"], technology_level: "none" },
    { path: "seo.png", category: "seo", series: "analytics", hash: "s", tags: ["SEO", "検索", "アクセス分析"], scene: "検索・アクセス分析", themes: ["seo", "web"], technology_level: "moderate" },
    { path: "web.png", category: "web", series: "website", hash: "w", tags: ["Web", "ホームページ"], scene: "Webサイト活用", themes: ["web", "digital"], technology_level: "moderate" }
  ];
  const welfare = articleImageProfile({ title: "福祉施設での生活支援と相談", body: "利用者と家族を職員が支えます", category: "福祉" });
  assert.equal(images.selectImage({ category: "welfare", candidates, profile: welfare }).path, "general.png");
  const seo = articleImageProfile({ title: "SEOとアクセス分析で検索順位を改善する", body: "キーワードと集客を確認します", category: "ホームページ制作" });
  assert.equal(images.selectImage({ category: "web", candidates, profile: seo }).path, "seo.png");
  const web = articleImageProfile({ title: "Webサイト制作でスマホ表示を整える", body: "ホームページのフォームを更新します", category: "ホームページ制作" });
  assert.equal(images.selectImage({ category: "web", candidates, profile: web }).path, "web.png");
});

test("an existing image filename and alt text never change the article meaning profile", () => {
  const profile = articleImageProfile({ title: "福祉施設での生活支援", body:
    "利用者への相談支援です。\n\n![AIとクラウド](assets/images/blog-library/inline/inline-ai-001.png)", category: "福祉" });
  assert.equal(profile.themes.includes("ai"), false);
  assert.equal(profile.themes.includes("digital"), false);
  assert.equal(profile.themes.includes("welfare"), true);
});

test("the committed image catalog covers every hero with stored semantic metadata", () => {
  const catalog = require("../data/image-library.json").images;
  const heroes = catalog.filter(item => item.path.includes("/hero/"));
  assert.equal(heroes.length, 86);
  for (const item of heroes) assert.ok(item.path && item.category && item.scene && item.tags.length && item.themes.length);
  const publishedImages = new Set(require("../data/blog-index.json").map(item => item.image));
  const focused = heroes.filter(item => publishedImages.has(item.path));
  assert.equal(focused.length, 19);
  for (const item of focused) assert.match(item.object_position, /^(?:100|\d{1,2})% (?:100|\d{1,2})%$/);
  assert.equal(images.normalizeObjectPosition("125% 50%"), "50% 50%");
  assert.equal(images.normalizeObjectPosition("35% 40%"), "35% 40%");
});

test("the committed hero library has no byte-identical files and dedupe prefers canonical names", () => {
  const root = path.resolve(__dirname, "..");
  assert.equal(chooseSurvivor(["copy.png", "hero-general-009.png", "hero-general-010.png"]), "hero-general-009.png");
  assert.deepEqual(pruneDuplicateHeroes({ root }), {
    groups: 0, removed: 0, survivors: 86, referenceRewrites: 0, details: []
  });
});

test("the committed inline library is content-classified, cataloged, semantic-safe, and avoids recent hashes", () => {
  const root = path.resolve(__dirname, "..");
  const candidates = images.discoverImages({ root, kind: "inline" });
  assert.equal(candidates.length, 90);
  assert.deepEqual(candidates.reduce((counts, candidate) => { counts[candidate.category] = (counts[candidate.category] || 0) + 1; return counts; }, {}),
    { ai: 11, dx: 5, general: 10, recruit: 2, security: 9, seo: 13, subsidy: 13, web: 12, welfare: 15 });
  for (const candidate of candidates) {
    assert.match(path.basename(candidate.path), /^inline-(welfare|recruit|ai|dx|web|seo|subsidy|security|general)-\d{3}\.(?:png|jpe?g|webp)$/);
    assert.ok(candidate.hash && candidate.tags.length && candidate.scene && candidate.technology_level && typeof candidate.has_person === "boolean");
  }
  const categoryExpectations = {
    "inline-ai-001.png": ["ai", "AI活用", "strong"],
    "inline-dx-001.png": ["dx", "デジタル業務", "strong"],
    "inline-seo-001.png": ["seo", "検索・アクセス分析", "moderate"],
    "inline-subsidy-001.png": ["subsidy", "補助金の申請準備", "none"],
    "inline-security-001.png": ["security", "ログインと情報保護を含む業務風景", "strong"],
    "inline-recruit-001.png": ["recruit", "採用活動", "none"],
    "inline-welfare-001.png": ["welfare", "福祉支援", "none"],
    "inline-web-001.png": ["web", "Webサイト活用", "moderate"],
    "inline-general-001.png": ["general", "一般的なPC作業", "none"]
  };
  for (const [name, [category, scene, level]] of Object.entries(categoryExpectations)) {
    const candidate = candidates.find(item => path.basename(item.path) === name);
    assert.deepEqual([candidate.category, candidate.scene, candidate.technology_level], [category, scene, level]);
  }
  const welfare = articleImageProfile({ title: "福祉事業所で利用者と家族に安心を伝える", body: "支援の相談と情報提供を紹介します", category: "ホームページ制作" });
  const selected = images.selectImage({ category: "ホームページ制作", candidates, profile: welfare, recentLimit: 10 });
  assert.equal(selected.category, "welfare");
  const repeated = images.selectImage({ category: "ホームページ制作", candidates, profile: welfare,
    history: [{ image: selected.path, hash: selected.hash, series: selected.series }], recentLimit: 10 });
  assert.notEqual(repeated.hash, selected.hash);
});

test("published heroes are hash-unique and the latest ten inline images are hash-unique", () => {
  const root = path.resolve(__dirname, "..");
  const articlesDir = path.join(root, "content", "articles");
  const published = new Set(require("../scripts/lib/articles").loadArticles(articlesDir)
    .filter(article => article.data.published === true).map(article => article.slug));
  const heroes = images.usageHistory({ root, articlesDir, kind: "hero" }).filter(item => published.has(item.article));
  const inline = images.usageHistory({ root, articlesDir, kind: "inline" }).filter(item => published.has(item.article));
  assert.equal(heroes.length, 19);
  assert.equal(new Set(heroes.map(item => item.hash)).size, heroes.length);
  assert.equal(inline.length, 19);
  assert.equal(new Set(inline.slice(0, 10).map(item => item.hash)).size, 10);
});

test("general inline images are used only when no semantically matched safe image exists", () => {
  const general = { path: "general.png", category: "general", series: "office", hash: "general",
    tags: ["一般事務", "書類確認", "オフィス"], scene: "一般的な事務作業", themes: ["general"], technology_level: "none" };
  const welfare = { path: "welfare.png", category: "welfare", series: "support", hash: "welfare",
    tags: ["福祉", "支援", "利用者"], scene: "福祉支援", themes: ["welfare"], technology_level: "none" };
  const ai = { path: "ai.png", category: "ai", series: "ai", hash: "ai",
    tags: ["AI", "生成AI"], scene: "AI活用", themes: ["ai"], technology_level: "strong" };
  const profile = articleImageProfile({ title: "福祉事業所で利用者を支える方法", body: "職員による相談と支援を紹介します", category: "福祉" });
  assert.equal(images.selectImage({ category: "welfare", candidates: [general, welfare, ai], profile }).path, "welfare.png");
  assert.equal(images.selectImage({ category: "welfare", candidates: [general, ai], profile }).path, "general.png");
});

test("strong topic and semantic matches outrank an unrelated unused inline image", () => {
  const recruit = { path: "recruit.png", category: "recruit", series: "interview", hash: "recruit",
    tags: ["採用", "面談", "職員"], scene: "採用面談", themes: ["recruit"], technology_level: "none" };
  const welfare = { path: "welfare.png", category: "welfare", series: "support", hash: "welfare",
    tags: ["福祉", "支援", "職員"], scene: "福祉支援", themes: ["welfare"], technology_level: "none" };
  const profile = articleImageProfile({ title: "福祉事業所の採用面談を改善する", body: "応募者と職員の面談を紹介します", category: "採用" });
  const selected = images.selectImage({ category: "recruit", candidates: [recruit, welfare], profile,
    history: [{ image: recruit.path, hash: recruit.hash, series: recruit.series }] });
  assert.equal(selected.path, "recruit.png");
});

test("inline image styling remains fluid for narrow screens", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "assets", "css", "style.css"), "utf8");
  assert.match(css, /\.article-inline-image\s*\{[\s\S]*width:\s*min\(100%,\s*880px\)[\s\S]*object-fit:\s*cover/);
});

test("new drafts insert one early-middle inline image and record separate inline history", t => {
  const value = fixture(t);
  image(value.root, "hero-recruit-01.webp", "inline"); image(value.root, "hero-recruit-02.webp", "inline");
  const topic = { title: "採用ページの改善", category: "採用", target: "福祉事業所", keyword: "採用", reason: "確認", angle: "改善", service: "支援" };
  const body = "## 最初の確認\n\n" + "本文".repeat(250) + "\n\n## 次の確認\n\n" + "本文".repeat(250) + "\n\n## まとめ\n\n" + "本文".repeat(250);
  const saved = saveArticleDraft({ article: { title: topic.title, description: "説明".repeat(20), bodyMarkdown: body }, topic, date: "2026-09-13", directory: value.articles, imageRoot: value.root });
  const parsed = require("../scripts/lib/articles").parseFrontmatter(fs.readFileSync(saved.filePath, "utf8"));
  assert.equal(parsed.data.inline_image, "assets/images/blog-library/inline/hero-recruit-01.webp");
  assert.equal((parsed.body.match(/hero-recruit-01\.webp/g) || []).length, 1);
  assert.equal(images.usageHistory({ articlesDir: value.articles, kind: "inline" })[0].image, parsed.data.inline_image);
});

test("published Markdown receives one inline image when the library is available, otherwise remains unchanged", t => {
  const value = fixture(t);
  article(value.articles, "published-post", "2026-09-12", "assets/images/hero.png", "welfare", "## 前半\n\n本文\n\n## 後半\n\n本文");
  const initial = fs.readFileSync(path.join(value.articles, "published-post.md"), "utf8");
  assert.deepEqual(refreshInlineImages({ root: value.root }), { published: 1, changed: 0 });
  assert.equal(fs.readFileSync(path.join(value.articles, "published-post.md"), "utf8"), initial);
  image(value.root, "hero-welfare-01.webp", "inline");
  assert.deepEqual(refreshInlineImages({ root: value.root }), { published: 1, changed: 1 });
  const updated = require("../scripts/lib/articles").parseFrontmatter(fs.readFileSync(path.join(value.articles, "published-post.md"), "utf8"));
  assert.equal(updated.data.inline_image, "assets/images/blog-library/inline/hero-welfare-01.webp");
  assert.match(updated.body, /hero-welfare-01\.webp/);
  assert.ok(updated.data.inline_image_hash);
  assert.ok(updated.data.inline_image_selection);
});

test("bulk inline refresh avoids consecutive reuse after category candidates are exhausted", t => {
  const value = fixture(t);
  image(value.root, "inline-recruit-001.webp", "inline");
  image(value.root, "inline-recruit-002.webp", "inline");
  fs.writeFileSync(path.join(value.root, "assets/images/blog-library/inline/inline-recruit-002.webp"), "different");
  const body = "## 前半\n\n本文\n\n## 後半\n\n本文";
  article(value.articles, "newest", "2026-09-12", "assets/images/hero.png", "採用", body);
  article(value.articles, "middle", "2026-09-11", "assets/images/hero.png", "採用", body);
  article(value.articles, "oldest", "2026-09-10", "assets/images/hero.png", "採用", body);
  assert.deepEqual(refreshInlineImages({ root: value.root, force: true }), { published: 3, changed: 3 });
  const assigned = images.usageHistory({ root: value.root, articlesDir: value.articles, kind: "inline" });
  assert.equal(new Set(assigned.map(item => item.hash)).size, 2);
  assert.notEqual(assigned[0].hash, assigned[1].hash);
  assert.notEqual(assigned[1].hash, assigned[2].hash);
  assert.deepEqual(refreshInlineImages({ root: value.root, force: true }), { published: 3, changed: 0 });
});
