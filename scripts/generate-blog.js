#!/usr/bin/env node
/*
 * Pages CMSの「お知らせ・コラム」collection（content/articles/*.md）から、
 *   ① data/blog-index.json      … 一覧用データ（published:trueのみ、新しい順）
 *   ② blog/<slug>.html          … 記事詳細ページ（既存記事と同じURL・同じCSS構造）
 *   ③ sitemap.xml               … 固定ページ＋記事URLを反映
 * をまとめて生成する。
 *
 * 生成対象のblog/<slug>.htmlは、content/articles/<slug>.mdが存在する
 * 記事のみ（＝Pages CMSへ移行済みの記事のみ）。まだ移行していない
 * 既存の手書きblog/*.htmlには一切触れない。
 *
 * Node.js標準モジュールのみに依存（外部npmパッケージなし）。
 * 実行例: node scripts/generate-blog.js
 */

"use strict";

const fs = require("fs");
const path = require("path");
const lib = require("./lib/articles");

const ROOT = path.join(__dirname, "..");
const BLOG_INDEX_FILE = path.join(ROOT, "data", "blog-index.json");
const BLOG_DIR = path.join(ROOT, "blog");
const SITEMAP_FILE = path.join(ROOT, "sitemap.xml");

// sitemap.xmlの固定ページ（現在のsitemap.xmlの記事URL以外の部分をそのまま維持）
const STATIC_PAGES = [
  "https://fukushi-it-partner.com/",
  "https://fukushi-it-partner.com/services.html",
  "https://fukushi-it-partner.com/works.html",
  "https://fukushi-it-partner.com/flow.html",
  "https://fukushi-it-partner.com/homepage-plan.html",
  "https://fukushi-it-partner.com/blog.html",
];
const STATIC_PAGES_AFTER_ARTICLES = [
  "https://fukushi-it-partner.com/profile.html",
  "https://fukushi-it-partner.com/contact.html",
  "https://fukushi-it-partner.com/privacy.html",
];

function formatDateDisplay(isoDate) {
  return String(isoDate || "").split("-").join(".");
}

function buildRelatedCardHtml(slug, articlesBySlug) {
  const cms = articlesBySlug[slug];
  let title, dateDisplay, categoryLabel, image, imageAlt, excerpt;

  if (cms) {
    title = cms.data.title;
    dateDisplay = formatDateDisplay(cms.data.date);
    categoryLabel =
      cms.data.category_label || lib.TYPE_LABELS[cms.data.type] || cms.data.type || "";
    image = cms.data.image;
    imageAlt = cms.data.image_alt || "";
    excerpt =
      cms.data.excerpt && String(cms.data.excerpt).trim()
        ? cms.data.excerpt
        : lib.excerptFromMarkdown(cms.body, 60);
  } else {
    const legacy = lib.getLegacyArticleMeta(slug);
    if (!legacy) {
      console.warn("[warn] 関連記事 " + slug + " が見つかりません（スキップ）");
      return "";
    }
    title = legacy.title;
    dateDisplay = legacy.dateDisplay;
    categoryLabel = legacy.categoryLabel;
    image = legacy.image;
    imageAlt = legacy.imageAlt;
    excerpt = legacy.excerpt;
  }

  const imgSrc = lib.toSiteImagePath(image, "blog");

  return (
    '        <a class="blog-list-item reveal" href="' +
    slug +
    '.html">\n' +
    '          <div class="blog-list-thumb">\n' +
    '            <img src="' +
    imgSrc +
    '" alt="' +
    lib.escapeHtml(imageAlt) +
    '">\n' +
    "          </div>\n" +
    '          <div class="blog-list-body">\n' +
    '            <div class="meta-row">\n' +
    '              <span class="category-badge">' +
    lib.escapeHtml(categoryLabel) +
    "</span>\n" +
    '              <span class="blog-date">' +
    lib.escapeHtml(dateDisplay) +
    "</span>\n" +
    "            </div>\n" +
    "            <h3>" +
    lib.escapeHtml(title) +
    "</h3>\n" +
    '            <p class="excerpt">' +
    lib.escapeHtml(excerpt) +
    "</p>\n" +
    '            <span class="read-more">続きを読む</span>\n' +
    "          </div>\n" +
    "        </a>"
  );
}

function renderArticlePage(article, articlesBySlug) {
  const data = article.data;
  const slug = article.slug;
  const categoryLabel =
    data.category_label || lib.TYPE_LABELS[data.type] || data.type || "";
  const dateDisplay = formatDateDisplay(data.date);
  const imageSrc = lib.toSiteImagePath(data.image, "blog");
  const bodyHtml = lib.markdownBodyToHtml(article.body, "blog");
  const description = lib.escapeHtml(data.description || "");
  const title = lib.escapeHtml(data.title);

  const related = Array.isArray(data.related) ? data.related : [];
  const relatedHtml = related
    .map(function (relSlug) {
      return buildRelatedCardHtml(relSlug, articlesBySlug);
    })
    .filter(Boolean)
    .join("\n\n");

  return (
    "<!DOCTYPE html>\n" +
    '<html lang="ja">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    "<title>" +
    title +
    "｜福祉ITパートナー</title>\n" +
    '<meta name="description" content="' +
    description +
    '">\n' +
    '<link rel="canonical" href="https://fukushi-it-partner.com/blog/' +
    slug +
    '.html">\n' +
    "\n" +
    '<meta property="og:type" content="article">\n' +
    '<meta property="og:title" content="' +
    title +
    '">\n' +
    '<meta property="og:description" content="' +
    description +
    '">\n' +
    '<meta property="og:url" content="https://fukushi-it-partner.com/blog/' +
    slug +
    '.html">\n' +
    '<meta property="og:site_name" content="福祉ITパートナー">\n' +
    '<meta property="og:image" content="' +
    imageSrc +
    '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    "\n" +
    '<link rel="icon" href="../favicon.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon-32x32.png">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="../assets/images/favicon-16x16.png">\n' +
    '<link rel="icon" type="image/png" sizes="192x192" href="../assets/images/android-chrome-192x192.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="../assets/images/apple-touch-icon.png">\n' +
    '<link rel="manifest" href="../site.webmanifest">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="../assets/css/style.css">\n' +
    '<script src="../assets/js/ga4.js"></script>\n' +
    "</head>\n" +
    "<body>\n" +
    "\n" +
    '<header class="site-header">\n' +
    '  <div class="nav-bar">\n' +
    '    <a href="../index.html" class="brand">\n' +
    '      <img src="../assets/images/logo-mark.png" alt="福祉ITパートナー ロゴ" class="brand-logo">\n' +
    '      <span class="brand-text">\n' +
    '        <span class="brand-name">福祉ITパートナー</span>\n' +
    '        <span class="brand-sub">上原健太</span>\n' +
    "      </span>\n" +
    "    </a>\n" +
    "    <nav>\n" +
    '      <ul class="nav-links">\n' +
    '        <li><a href="../index.html">HOME</a></li>\n' +
    '        <li><a href="../services.html">サービス</a></li>\n' +
    '        <li><a href="../works.html">制作実績</a></li>\n' +
    '        <li><a href="../flow.html">制作までの流れ</a></li>\n' +
    '        <li><a href="../blog.html" class="active">ブログ</a></li>\n' +
    '        <li><a href="../profile.html">プロフィール</a></li>\n' +
    '        <li><a href="../contact.html">お問い合わせ</a></li>\n' +
    '        <li class="nav-cta-mobile">\n' +
    '          <a href="../contact.html#google-form-embed" class="btn btn-primary js-consult-link">無料相談はこちら</a>\n' +
    "        </li>\n" +
    "      </ul>\n" +
    "    </nav>\n" +
    '    <div class="nav-cta">\n' +
    '      <a href="../contact.html#google-form-embed" class="btn btn-primary js-consult-link">無料相談はこちら</a>\n' +
    "    </div>\n" +
    '    <button class="nav-toggle" aria-label="メニューを開く">\n' +
    "      <span></span><span></span><span></span>\n" +
    "    </button>\n" +
    "  </div>\n" +
    "</header>\n" +
    "\n" +
    "<main>\n" +
    "  <section>\n" +
    '    <div class="container blog-article reveal">\n' +
    '      <a href="../blog.html" class="back-link">← ブログ一覧へ戻る</a>\n' +
    "      <h1>" +
    title +
    "</h1>\n" +
    '      <div class="meta-row">\n' +
    '        <span class="category-badge">' +
    lib.escapeHtml(categoryLabel) +
    "</span>\n" +
    '        <span class="blog-date"><time datetime="' +
    lib.escapeHtml(data.date) +
    '">' +
    lib.escapeHtml(dateDisplay) +
    "</time></span>\n" +
    "      </div>\n" +
    "\n" +
    '      <div class="article-eyecatch">\n' +
    '        <img src="' +
    imageSrc +
    '" alt="' +
    lib.escapeHtml(data.image_alt || "") +
    '">\n' +
    "      </div>\n" +
    "\n" +
    bodyHtml +
    "\n" +
    "    </div>\n" +
    "  </section>\n" +
    "\n" +
    "  <!-- 関連記事：content/articles/" +
    slug +
    ".md のrelatedフィールドから自動生成 -->\n" +
    '  <section style="background: var(--cream-100);">\n' +
    '    <div class="container">\n' +
    '      <h2 class="section-title" style="margin-bottom: 24px;">関連記事</h2>\n' +
    '      <div class="blog-list">\n' +
    "\n" +
    relatedHtml +
    "\n" +
    "\n" +
    "      </div>\n" +
    "    </div>\n" +
    "  </section>\n" +
    "\n" +
    '  <section class="cta-section">\n' +
    '    <div class="container reveal">\n' +
    "      <h2>" +
    lib.escapeHtml(data.cta_heading || "まずはお気軽にご相談ください。") +
    "</h2>\n" +
    '      <div class="btn-group">\n' +
    '        <a href="../contact.html#google-form-embed" class="btn btn-accent js-consult-link">' +
    lib.escapeHtml(data.cta_button_text || "無料相談はこちら") +
    "</a>\n" +
    "      </div>\n" +
    "    </div>\n" +
    "  </section>\n" +
    "</main>\n" +
    "\n" +
    '<footer class="site-footer">\n' +
    '  <div class="container">\n' +
    '    <div class="footer-grid">\n' +
    '      <div class="footer-brand">\n' +
    '        <img src="../assets/images/logo.png" alt="福祉ITパートナー ロゴ" class="footer-logo">\n' +
    '        <span class="brand-name">福祉ITパートナー</span>\n' +
    "        <p>福祉の現場に、ITという安心を。<br>福祉事業所・団体のホームページ制作・IT支援を行っています。</p>\n" +
    "      </div>\n" +
    '      <div class="footer-col">\n' +
    "        <h4>サイトメニュー</h4>\n" +
    "        <ul>\n" +
    '          <li><a href="../index.html">HOME</a></li>\n' +
    '          <li><a href="../services.html">サービス</a></li>\n' +
    '          <li><a href="../works.html">制作実績</a></li>\n' +
    '          <li><a href="../blog.html">ブログ</a></li>\n' +
    '          <li><a href="../profile.html">プロフィール</a></li>\n' +
    '          <li><a href="../contact.html">お問い合わせ</a></li>\n' +
    "        </ul>\n" +
    "      </div>\n" +
    '      <div class="footer-col">\n' +
    "        <h4>お問い合わせ</h4>\n" +
    "        <ul>\n" +
    '          <li><a href="../contact.html#google-form-embed" class="js-consult-link">無料相談はこちら</a></li>\n' +
    '          <li><a href="../privacy.html">プライバシーポリシー</a></li>\n' +
    '          <li><a href="https://www.youtube.com/channel/UCO008bmCPVaEV-tFV1ApXMg" target="_blank" rel="noopener noreferrer">YouTube｜ぶひおの3分福祉</a></li>\n' +
    "        </ul>\n" +
    "      </div>\n" +
    "    </div>\n" +
    '    <div class="footer-bottom">\n' +
    "      &copy; 2026 福祉ITパートナー｜上原健太\n" +
    "    </div>\n" +
    "  </div>\n" +
    "</footer>\n" +
    "\n" +
    '<script src="../assets/js/main.js"></script>\n' +
    "</body>\n" +
    "</html>\n"
  );
}

function buildBlogIndex(publishedArticles) {
  return publishedArticles
    .slice()
    .sort(function (a, b) {
      return String(b.data.date).localeCompare(String(a.data.date));
    })
    .map(function (a) {
      return {
        type: a.data.type || "",
        title: a.data.title,
        date: a.data.date,
        image: a.data.image || null,
        image_alt: a.data.image_alt || "",
        description: a.data.description || "",
        excerpt:
          a.data.excerpt && String(a.data.excerpt).trim()
            ? a.data.excerpt
            : lib.excerptFromMarkdown(a.body, 80),
        slug: a.slug,
      };
    });
}

function buildSitemap(publishedArticles) {
  const cmsSlugs = {};
  publishedArticles.forEach(function (a) {
    cmsSlugs[a.slug] = true;
  });

  // content/articlesへまだ移行していない既存の手書きblog/*.htmlも
  // 引き続きsitemapへ含める（移行途中でURLが漏れないようにするため）
  let legacyFiles = [];
  try {
    legacyFiles = fs
      .readdirSync(BLOG_DIR)
      .filter(function (f) {
        return /\.html$/i.test(f);
      })
      .map(function (f) {
        return f.replace(/\.html$/i, "");
      })
      .filter(function (slug) {
        return !cmsSlugs[slug];
      });
  } catch (err) {
    legacyFiles = [];
  }

  const articleUrls = publishedArticles
    .slice()
    .sort(function (a, b) {
      return String(b.data.date).localeCompare(String(a.data.date));
    })
    .map(function (a) {
      return "https://fukushi-it-partner.com/blog/" + a.slug + ".html";
    })
    .concat(
      legacyFiles.sort().map(function (slug) {
        return "https://fukushi-it-partner.com/blog/" + slug + ".html";
      })
    );

  const allUrls = STATIC_PAGES.concat(articleUrls, STATIC_PAGES_AFTER_ARTICLES);

  const body = allUrls
    .map(function (loc) {
      return "  <url>\n    <loc>" + loc + "</loc>\n  </url>";
    })
    .join("\n");

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    "\n</urlset>\n"
  );
}

function main() {
  const articles = lib.loadArticles();
  const published = articles.filter(function (a) {
    return a.data.published === true;
  });

  const articlesBySlug = {};
  articles.forEach(function (a) {
    articlesBySlug[a.slug] = a;
  });

  // ① data/blog-index.json
  fs.mkdirSync(path.dirname(BLOG_INDEX_FILE), { recursive: true });
  fs.writeFileSync(
    BLOG_INDEX_FILE,
    JSON.stringify(buildBlogIndex(published), null, 2) + "\n",
    "utf8"
  );
  console.log("generated " + BLOG_INDEX_FILE + " (" + published.length + " article(s))");

  // ② blog/<slug>.html（content/articlesへ移行済みの記事のみ）
  published.forEach(function (article) {
    const outPath = path.join(BLOG_DIR, article.slug + ".html");
    const html = renderArticlePage(article, articlesBySlug);
    fs.writeFileSync(outPath, html, "utf8");
    console.log("generated " + outPath);
  });

  // ③ sitemap.xml
  fs.writeFileSync(SITEMAP_FILE, buildSitemap(published), "utf8");
  console.log("updated " + SITEMAP_FILE);
}

main();
