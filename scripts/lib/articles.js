/*
 * content/articles/*.md（Pages CMS「お知らせ・コラム」collection）を扱う
 * 共通ロジック。data/blog-index.json生成・blog/<slug>.html生成・
 * sitemap.xml更新の3スクリプトから読み込んで使う。
 *
 * YAML解析はyamlパッケージを使用（npm ciで導入）。
 */

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

const ARTICLES_DIR = path.join(__dirname, "..", "..", "content", "articles");
const BLOG_DIR = path.join(__dirname, "..", "..", "blog");

const TYPE_LABELS = {
  news: "お知らせ",
  column: "コラム",
};

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("Missing YAML frontmatter");
  const doc = YAML.parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors.map(e => e.message).join("; "));
  const data = doc.toJS({ maxAliasCount: 50 });
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid article metadata");
  return { data, body: match[2] };
}

// Preserve explicitly supplied descriptions; only blank descriptions use body text.
function descriptionOf(data, body) {
  if (typeof data.description === "string" && data.description.trim()) return data.description;
  return excerptFromMarkdown(String(body || "").replace(/<[^>]*>/g, ""), 120);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, function (c) {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c
    );
  });
}

function stripMarkdown(md) {
  return String(md || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\r?\n+/g, " ")
    .trim();
}

function excerptFromMarkdown(md, len) {
  const text = stripMarkdown(md);
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function truncate(text, len) {
  const t = String(text || "").trim();
  return t.length > len ? t.slice(0, len) + "…" : t;
}

// 一覧・関連記事カードに表示する抜粋を決める優先順位。
// 1. excerpt（個別指定、上級者向け・通常は空欄）
// 2. description（SEO用説明文）
// 3. 本文冒頭からの自動生成
function excerptOf(data, body, len) {
  if (data.excerpt && String(data.excerpt).trim()) {
    // 個別指定（上級者向け）の抜粋は、既存の挙動を維持するため
    // 文字数を切り詰めずそのまま使う。
    return String(data.excerpt).trim();
  }
  if (data.description && String(data.description).trim()) {
    return truncate(data.description, len);
  }
  return excerptFromMarkdown(body, len);
}

// Compatibility helper for callers that supply HTML-escaped inline text.
// Full article rendering uses the token parser in markdown.js.
function inlineMarkdown(escapedText) {
  return escapedText
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/==([^=]+)==/g, '<span style="color: var(--orange-600);">$1</span>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function toSiteImagePath(imgPath, depth) {
  if (!imgPath) return "";
  const cleaned = String(imgPath).replace(/^\/+/, "");
  const prefix = depth === "blog" ? "../" : "";
  return prefix + cleaned;
}

const { markdownBodyToHtml } = require("./markdown");

function loadArticles(directory = ARTICLES_DIR) {
  // Validate every managed article before any generated file is written/deleted.
  return fs.readdirSync(directory).filter(f => /\.md$/i.test(f)).map(filename => {
    const parsed = parseFrontmatter(fs.readFileSync(path.join(directory, filename), "utf8"));
    const data = parsed.data;
    const slug = filename.replace(/\.md$/i, "");
    // A custom slug must match its source filename: never delete another page.
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(slug) || (data.slug != null && data.slug !== slug)) {
      throw new Error(filename + ": unsafe or mismatched slug");
    }
    if (data.published == null) data.published = false;
    if (typeof data.published !== "boolean") throw new Error(filename + ": published must be boolean");
    if (typeof data.title !== "string" || !data.title.trim()) throw new Error(filename + ": title is required");
    if (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
        !Number.isFinite(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0,10) !== data.date) {
      throw new Error(filename + ": date must be a valid YYYY-MM-DD date");
    }
    if (data.description != null && typeof data.description !== "string") throw new Error(filename + ": description must be text");
    if (data.published && (!TYPE_LABELS[data.type] || typeof data.image !== "string" || !data.image.trim() || !parsed.body.trim())) {
      throw new Error(filename + ": published articles require type, image and body");
    }
    if (data.related != null && (!Array.isArray(data.related) || data.related.some(s => typeof s !== "string"))) {
      throw new Error(filename + ": related must be a list of slugs");
    }
    return { slug, filenameSlug: slug, data, body: parsed.body };
  });
}

// content/articlesにまだ移行していない、既存の手書きblog/<slug>.htmlから
// 「関連記事」表示用の最低限のメタ情報（タイトル・日付・サムネイル・
// カテゴリ表示）を抽出するフォールバック。段階移行の間、移行済み記事と
// 未移行の既存記事が互いにリンクし合えるようにするためのもの。
// blog.htmlの一覧カードで使われている「抜粋」文言を、記事同士の
// 「関連記事」表示で再利用するための一覧（サイト全体で同一の抜粋文が
// 使い回されている既存の実装慣習に合わせるため）。
let blogHtmlExcerptCache = null;
function getBlogHtmlExcerpts() {
  if (blogHtmlExcerptCache) return blogHtmlExcerptCache;
  blogHtmlExcerptCache = {};
  let html;
  try {
    html = fs.readFileSync(path.join(BLOG_DIR, "..", "blog.html"), "utf8");
  } catch (err) {
    return blogHtmlExcerptCache;
  }
  const cardRe =
    /href="blog\/([a-zA-Z0-9-]+)\.html">[\s\S]*?<p class="excerpt">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    blogHtmlExcerptCache[m[1]] = m[2].trim();
  }
  return blogHtmlExcerptCache;
}

function getLegacyArticleMeta(slug) {
  const filePath = path.join(BLOG_DIR, slug + ".html");
  let html;
  try {
    html = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    return null;
  }

  const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/);
  const date = html.match(/<span class="blog-date">([^<]*)<\/span>/);
  const category = html.match(/<span class="category-badge">([^<]*)<\/span>/);
  const eyecatchImg = html.match(
    /<div class="article-eyecatch">\s*<img src="([^"]+)" alt="([^"]*)"/
  );
  const description = html.match(/<meta name="description" content="([^"]*)"/);
  const blogExcerpts = getBlogHtmlExcerpts();

  if (!h1) return null;

  return {
    slug: slug,
    title: h1[1].replace(/<[^>]+>/g, "").trim(),
    dateDisplay: date ? date[1].trim() : "",
    categoryLabel: category ? category[1].trim() : "",
    image: eyecatchImg ? eyecatchImg[1].replace(/^\.\.\//, "") : "",
    imageAlt: eyecatchImg ? eyecatchImg[2] : "",
    excerpt:
      blogExcerpts[slug] ||
      (description ? excerptFromMarkdown(description[1], 80) : ""),
    legacy: true,
  };
}

// バッジ等に表示するカテゴリ文言。category_labelが指定されていれば
// それを優先し、無ければtypeから既定のラベルを解決する。
function categoryLabelOf(data) {
  return (data && (data.category_label || TYPE_LABELS[data.type] || data.type)) || "";
}

module.exports = {
  ARTICLES_DIR: ARTICLES_DIR,
  BLOG_DIR: BLOG_DIR,
  TYPE_LABELS: TYPE_LABELS,
  parseFrontmatter: parseFrontmatter,
  descriptionOf: descriptionOf,
  escapeHtml: escapeHtml,
  stripMarkdown: stripMarkdown,
  excerptFromMarkdown: excerptFromMarkdown,
  excerptOf: excerptOf,
  inlineMarkdown: inlineMarkdown,
  markdownBodyToHtml: markdownBodyToHtml,
  toSiteImagePath: toSiteImagePath,
  loadArticles: loadArticles,
  getLegacyArticleMeta: getLegacyArticleMeta,
  categoryLabelOf: categoryLabelOf,
};
