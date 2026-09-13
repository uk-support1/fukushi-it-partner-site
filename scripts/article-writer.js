"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const lib = require("./lib/articles");
const imageLibrary = require("./lib/image-library");
const { validateArticle } = require("./article-generator");
const { CATEGORIES, TopicError } = require("./topic-selector");
const { safeOfficialUrl } = require("./latest-info");
const { selectBuhio } = require("./lib/buhio");

const IMAGE_BY_CATEGORY = {
  "Googleマップ／Googleビジネスプロフィール": {
    image: "assets/images/services/service-google-support.jpg",
    imageAlt: "Googleサービスの活用を支援するイメージ"
  },
  "AI活用": {
    image: "assets/images/services/service-ai-support.jpg",
    imageAlt: "福祉事業所でのAI活用を支援するイメージ"
  },
  "IT活用": {
    image: "assets/images/services/service-it-support.jpg",
    imageAlt: "福祉事業所のIT活用を支援するイメージ"
  },
  "業務効率化": {
    image: "assets/images/services/service-it-support.jpg",
    imageAlt: "福祉事業所の業務効率化を支援するイメージ"
  },
  "補助金活用": {
    image: "assets/images/services/service-subsidy-support.jpg",
    imageAlt: "福祉事業所の補助金活用を支援するイメージ"
  }
};
const DEFAULT_IMAGE = {
  image: "assets/images/services/service-homepage.jpg",
  imageAlt: "福祉事業所のホームページ活用を支援するイメージ"
};

function fail(code) { throw new TopicError(code); }

function validateDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    fail("INVALID_ARTICLE_DATE");
  }
}

function baseSlugFor(title, date) {
  validateDate(date);
  if (typeof title !== "string" || !title.trim()) fail("INVALID_ARTICLE_TITLE");
  const normalized = title.normalize("NFKC").trim();
  const digest = crypto.createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 12);
  return `article-${date}-${digest}`;
}

function articleImage(category, { root = path.join(__dirname, ".."), articlesDir = lib.ARTICLES_DIR, kind = "hero" } = {}) {
  const selected = imageLibrary.selectImage({ category,
    candidates: imageLibrary.discoverImages({ root, kind }),
    history: imageLibrary.usageHistory({ articlesDir }) });
  if (selected) return { image: selected.path, imageAlt: "", category: selected.category, series: selected.series };
  const fallback = IMAGE_BY_CATEGORY[category] || DEFAULT_IMAGE;
  return { ...fallback, category: imageLibrary.categoryFor(category), series: imageLibrary.seriesFor(fallback.image, imageLibrary.categoryFor(category)) };
}

function validateTopicForDraft(topic) {
  if (!topic || typeof topic !== "object" ||
      typeof topic.category !== "string" || !CATEGORIES.includes(topic.category)) {
    fail("INVALID_ARTICLE_CATEGORY");
  }
}

function existingSlugs(directory) {
  let entries;
  try {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("ARTICLE_DIRECTORY_INVALID");
    entries = fs.readdirSync(directory).filter(name => /\.md$/i.test(name));
  } catch (error) {
    if (error instanceof TopicError) throw error;
    fail("ARTICLE_DIRECTORY_INVALID");
  }
  const slugs = new Set();
  for (const filename of entries) {
    const filenameSlug = filename.replace(/\.md$/i, "");
    slugs.add(filenameSlug);
    try {
      const parsed = lib.parseFrontmatter(fs.readFileSync(path.join(directory, filename), "utf8"));
      if (typeof parsed.data.slug === "string" && parsed.data.slug) slugs.add(parsed.data.slug);
    } catch {
      // An invalid managed file makes collision checks unreliable, so do not write.
      fail("ARTICLE_DIRECTORY_SCAN_FAILED");
    }
  }
  return slugs;
}

function availableSlug(title, date, directory) {
  const base = baseSlugFor(title, date);
  const used = existingSlugs(directory);
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  fail("ARTICLE_SLUG_EXHAUSTED");
}

function sourceSection(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) return "";
  const lines = sources.map(source => {
    if (!source || typeof source !== "object" || !safeOfficialUrl(source.url) ||
        typeof source.source !== "string" || !source.source.trim() ||
        typeof source.title !== "string" || !source.title.trim()) fail("INVALID_ARTICLE_SOURCES");
    const label = `${source.source}｜${source.title}`.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();
    return `- [${label}](${source.url})`;
  });
  return `\n\n## 出典・参考情報\n\n${lines.join("\n")}`;
}

function buildArticleMarkdown({ article, topic, date, slug, sources = [], imageOptions } = {}) {
  validateTopicForDraft(topic);
  validateDate(date);
  const cleanArticle = validateArticle(JSON.stringify(article), topic);
  if (typeof slug !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(slug)) fail("INVALID_ARTICLE_SLUG");
  const image = articleImage(topic.category, imageOptions);
  const metadata = {
    type: "column",
    category_label: topic.category,
    title: cleanArticle.title,
    date,
    image: image.image,
    image_alt: image.imageAlt,
    image_role: "hero",
    image_category: image.category,
    image_series: image.series,
    published: false,
    description: cleanArticle.description,
    slug,
    buhio: selectBuhio(cleanArticle, cleanArticle.buhio),
    ...(cleanArticle.emphasis ? {emphasis:cleanArticle.emphasis} : {})
  };
  const markdown = `---\n${YAML.stringify(metadata).trimEnd()}\n---\n\n${cleanArticle.bodyMarkdown}${sourceSection(sources)}\n`;
  const parsed = lib.parseFrontmatter(markdown);
  if (parsed.data.slug !== slug || parsed.data.published !== false || !parsed.body.trim()) {
    fail("INVALID_ARTICLE_MARKDOWN");
  }
  return { markdown, metadata };
}

function saveArticleDraft({ article, topic, date, sources = [], directory = lib.ARTICLES_DIR, imageRoot, imageKind = "hero" }) {
  validateTopicForDraft(topic);
  for (let attempt = 0; attempt < 9999; attempt += 1) {
    const slug = availableSlug(article && article.title, date, directory);
    const filename = `${slug}.md`;
    const filePath = path.join(directory, filename);
    const built = buildArticleMarkdown({ article, topic, date, slug, sources,
      imageOptions: { root: imageRoot || path.join(__dirname, ".."), articlesDir: directory, kind: imageKind } });
    try {
      fs.writeFileSync(filePath, built.markdown, { encoding: "utf8", flag: "wx" });
      return { slug, filename, filePath, metadata: built.metadata };
    } catch (error) {
      if (error && error.code === "EEXIST") continue;
      fail("ARTICLE_SAVE_FAILED");
    }
  }
  fail("ARTICLE_SLUG_EXHAUSTED");
}

module.exports = {
  IMAGE_BY_CATEGORY,
  DEFAULT_IMAGE,
  baseSlugFor,
  articleImage,
  availableSlug,
  sourceSection,
  buildArticleMarkdown,
  saveArticleDraft
};
