/*
 * content/articles/*.md（Pages CMS「お知らせ・コラム」collection）を扱う
 * 共通ロジック。data/blog-index.json生成・blog/<slug>.html生成・
 * sitemap.xml更新の3スクリプトから読み込んで使う。
 *
 * Node.js標準モジュールのみに依存（外部npmパッケージなし）。
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ARTICLES_DIR = path.join(__dirname, "..", "..", "content", "articles");
const BLOG_DIR = path.join(__dirname, "..", "..", "blog");

const TYPE_LABELS = {
  news: "お知らせ",
  column: "コラム",
};

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const data = {};
  match[1].split(/\r?\n/).forEach(function (line) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) return;
    const key = kv[1];
    let value = kv[2].trim();
    if (
      (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
      (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
    ) {
      value = value.slice(1, -1);
    }
    if (value === "true") value = true;
    else if (value === "false") value = false;
    // YAMLのインラインリスト（例: related: [a, b]）を簡易対応
    else if (value.charAt(0) === "[" && value.charAt(value.length - 1) === "]") {
      value = value
        .slice(1, -1)
        .split(",")
        .map(function (v) {
          return v.trim().replace(/^["']|["']$/g, "");
        })
        .filter(Boolean);
    }
    data[key] = value;
  });

  // "related:" の下にYAMLブロックリスト（- item）が続く形式にも対応
  const blockListMatch = fmBlockList(match[1], "related");
  if (blockListMatch) data.related = blockListMatch;

  return { data: data, body: match[2] };
}

function fmBlockList(fmText, key) {
  const lines = fmText.split(/\r?\n/);
  const startIndex = lines.findIndex(function (l) {
    return new RegExp("^" + key + ":\\s*$").test(l);
  });
  if (startIndex === -1) return null;
  const items = [];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-\s*(.+)$/);
    if (!m) break;
    items.push(m[1].trim().replace(/^["']|["']$/g, ""));
  }
  return items.length ? items : null;
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

// 見出し・太字・リンクなど最低限のMarkdownをHTMLへ変換する。
// 外部npmパッケージ（marked等）は使わず、既存記事に登場する範囲の
// 記法（見出し#/##/###、**太字**、[リンク](url)、- 箇条書き、
// 単独行の画像![alt](url)）のみを対象にした簡易コンバータ。
function inlineMarkdown(escapedText) {
  return escapedText
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function toSiteImagePath(imgPath, depth) {
  if (!imgPath) return "";
  const cleaned = String(imgPath).replace(/^\/+/, "");
  const prefix = depth === "blog" ? "../" : "";
  return prefix + cleaned;
}

function markdownBodyToHtml(body, depth) {
  const blocks = String(body || "")
    .split(/\r?\n\s*\r?\n/)
    .map(function (b) {
      return b.trim();
    })
    .filter(Boolean);

  return blocks
    .map(function (block) {
      const imageOnly = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageOnly) {
        const alt = escapeHtml(imageOnly[1]);
        const src = toSiteImagePath(imageOnly[2], depth);
        return (
          '<div class="article-photo">\n  <img src="' +
          src +
          '" alt="' +
          alt +
          '">\n</div>'
        );
      }

      const lines = block.split(/\r?\n/).map(function (l) {
        return l.trim();
      });

      if (lines.every(function (l) { return /^-\s+/.test(l); })) {
        const items = lines
          .map(function (l) {
            return inlineMarkdown(escapeHtml(l.replace(/^-\s+/, "")));
          })
          .map(function (li) {
            return "  <li>" + li + "</li>";
          })
          .join("\n");
        return "<ul>\n" + items + "\n</ul>";
      }

      const h3 = block.match(/^###\s+(.*)$/);
      if (h3) return "<h3>" + inlineMarkdown(escapeHtml(h3[1])) + "</h3>";

      const h2 = block.match(/^##\s+(.*)$/);
      if (h2) return "<h2>" + inlineMarkdown(escapeHtml(h2[1])) + "</h2>";

      const h1 = block.match(/^#\s+(.*)$/);
      if (h1) return "<h2>" + inlineMarkdown(escapeHtml(h1[1])) + "</h2>";

      const paragraphText = lines.join(" ");
      return "      <p>\n        " + inlineMarkdown(escapeHtml(paragraphText)) + "\n      </p>";
    })
    .join("\n\n");
}

function loadArticles() {
  let filenames = [];
  try {
    filenames = fs.readdirSync(ARTICLES_DIR).filter(function (f) {
      return /\.md$/i.test(f);
    });
  } catch (err) {
    return [];
  }

  const articles = [];
  filenames.forEach(function (filename) {
    try {
      const filePath = path.join(ARTICLES_DIR, filename);
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = parseFrontmatter(raw);
      if (!parsed) {
        console.warn("[skip] " + filename + ": frontmatterの形式が不正です");
        return;
      }
      const data = parsed.data;
      const slug = filename.replace(/\.md$/i, "");

      if (typeof data.title !== "string" || !data.title) {
        console.warn("[skip] " + filename + ": titleがありません");
        return;
      }
      if (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        console.warn("[skip] " + filename + ": dateがYYYY-MM-DD形式ではありません");
        return;
      }

      articles.push({
        slug: data.slug && typeof data.slug === "string" ? data.slug : slug,
        filenameSlug: slug,
        data: data,
        body: parsed.body,
      });
    } catch (err) {
      console.warn("[skip] " + filename + ": 予期しないエラーのためスキップします (" + err.message + ")");
    }
  });

  return articles;
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

module.exports = {
  ARTICLES_DIR: ARTICLES_DIR,
  BLOG_DIR: BLOG_DIR,
  TYPE_LABELS: TYPE_LABELS,
  parseFrontmatter: parseFrontmatter,
  escapeHtml: escapeHtml,
  stripMarkdown: stripMarkdown,
  excerptFromMarkdown: excerptFromMarkdown,
  inlineMarkdown: inlineMarkdown,
  markdownBodyToHtml: markdownBodyToHtml,
  toSiteImagePath: toSiteImagePath,
  loadArticles: loadArticles,
  getLegacyArticleMeta: getLegacyArticleMeta,
};
