#!/usr/bin/env node
/*
 * 「お役立ち講座」（content/courses/*.md）から、
 *   ① data/course-index.json   … 一覧用データ（published:trueのみ、新しい順）
 *   ② course/<slug>.html       … 講座記事詳細ページ
 *   ③ course.html              … 講座トップ・一覧ページ
 *   ④ sitemap.xml              … 既存のブログURLを含む形で再生成（後述）
 * を生成する。
 *
 * 既存ブログ（content/articles / scripts/lib/markdown.js）の生成処理・
 * テンプレート・Daily Blog自動化ロジックには変更を加えない。
 *
 * sitemap.xmlについてのみ、scripts/generate-blog.js が既に export している
 * buildSitemap()（お役立ち講座のURLをdata/course-index.jsonから読み取って
 * 追加できるよう拡張済み。course-index.jsonが無い場合は従来と完全に同じ
 * 出力になる）をそのまま呼び出して再生成する。generate-blog.yml側が先に
 * 実行された場合・generate-course.yml側が先に実行された場合のどちらでも、
 * 常に同じ関数で組み立てるため、ブログURL・講座URLのどちらも欠落しない。
 *
 * 第2段階でもまだ行わないもの：
 *   - Daily Blog / Gemini自動生成との連携
 *   - カテゴリ別アイキャッチの自動生成
 *
 * 実行例: node scripts/generate-course.js
 */

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { escapeHtml, toSiteImagePath, loadArticles: loadBlogArticles } = require("./lib/articles");
const { buildSitemap } = require("./generate-blog");
const { courseBodyToHtml } = require("./lib/course-markdown");

const ROOT = path.join(__dirname, "..");
const COURSES_DIR = path.join(ROOT, "content", "courses");
const COURSE_INDEX_FILE = path.join(ROOT, "data", "course-index.json");
const COURSE_DIR = path.join(ROOT, "course");
const COURSE_HTML_FILE = path.join(ROOT, "course.html");

const CATEGORIES = [
  "ホームページ・Web制作",
  "SEO・集客",
  "AI・IT活用",
  "Googleマップ・SNS・広報",
];

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error("Missing YAML frontmatter");
  const doc = YAML.parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error(doc.errors.map((e) => e.message).join("; "));
  const data = doc.toJS({ maxAliasCount: 50 });
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid course metadata");
  return { data, body: match[2] };
}

function loadCourses(directory = COURSES_DIR) {
  fs.mkdirSync(directory, { recursive: true });
  return fs
    .readdirSync(directory)
    .filter((f) => /\.md$/i.test(f))
    .map((filename) => {
      const parsed = parseFrontmatter(fs.readFileSync(path.join(directory, filename), "utf8"));
      const data = parsed.data;
      const slug = filename.replace(/\.md$/i, "");
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(slug) || (data.slug != null && data.slug !== slug)) {
        throw new Error(filename + ": unsafe or mismatched slug");
      }
      if (data.published == null) data.published = false;
      if (typeof data.published !== "boolean") throw new Error(filename + ": published must be boolean");
      if (typeof data.title !== "string" || !data.title.trim()) throw new Error(filename + ": title is required");
      if (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        throw new Error(filename + ": date must be a YYYY-MM-DD date");
      }
      if (data.published) {
        if (typeof data.image !== "string" || !data.image.trim()) throw new Error(filename + ": published courses require image");
        if (!parsed.body.trim()) throw new Error(filename + ": published courses require body");
        if (typeof data.category_label !== "string" || !data.category_label.trim()) {
          throw new Error(filename + ": published courses require category_label");
        }
      }
      return { slug, data, body: parsed.body };
    });
}

function formatDateDisplay(isoDate) {
  return String(isoDate || "").split("-").join(".");
}

function excerptFromText(text, len) {
  const plain = String(text || "")
    .replace(/\[[A-Z]+(?:\s+[a-zA-Z]+="[^"]*")?\]/g, "")
    .replace(/\[\/[A-Z]+\]/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\r?\n+/g, " ")
    .trim();
  return plain.length > len ? plain.slice(0, len) + "…" : plain;
}

function descriptionOf(data, body) {
  if (typeof data.description === "string" && data.description.trim()) return data.description;
  return excerptFromText(body, 120);
}

function siteHead({ title, description, canonicalPath, ogImage, depth }) {
  const prefix = depth === "course" ? "../" : "";
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="ja">\n' +
    "<head>\n" +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    "<title>" + escapeHtml(title) + "</title>\n" +
    '<meta name="description" content="' + escapeHtml(description) + '">\n' +
    '<link rel="canonical" href="https://fukushi-it-partner.com' + canonicalPath + '">\n' +
    "\n" +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">\n' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">\n' +
    '<meta property="og:url" content="https://fukushi-it-partner.com' + canonicalPath + '">\n' +
    '<meta property="og:site_name" content="福祉ITパートナー">\n' +
    '<meta property="og:image" content="' + escapeHtml(ogImage) + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    "\n" +
    '<link rel="icon" href="' + prefix + 'favicon.ico" sizes="any">\n' +
    '<link rel="icon" type="image/png" sizes="32x32" href="' + prefix + 'assets/images/favicon-32x32.png">\n' +
    '<link rel="icon" type="image/png" sizes="16x16" href="' + prefix + 'assets/images/favicon-16x16.png">\n' +
    '<link rel="icon" type="image/png" sizes="192x192" href="' + prefix + 'assets/images/android-chrome-192x192.png">\n' +
    '<link rel="apple-touch-icon" sizes="180x180" href="' + prefix + 'assets/images/apple-touch-icon.png">\n' +
    '<link rel="manifest" href="' + prefix + 'site.webmanifest">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="' + prefix + 'assets/css/style.css">\n' +
    '<link rel="stylesheet" href="' + prefix + 'assets/css/course.css">\n' +
    '<script src="' + prefix + 'assets/js/ga4.js"></script>\n' +
    "</head>\n"
  );
}

function siteHeader(depth) {
  const prefix = depth === "course" ? "../" : "";
  return (
    "<body>\n\n" +
    '<header class="site-header">\n' +
    '  <div class="nav-bar">\n' +
    '    <a href="' + prefix + 'index.html" class="brand">\n' +
    '      <img src="' + prefix + 'assets/images/logo-mark.png" alt="福祉ITパートナー ロゴ" class="brand-logo">\n' +
    '      <span class="brand-text">\n' +
    '        <span class="brand-name">福祉ITパートナー</span>\n' +
    '        <span class="brand-sub">上原健太</span>\n' +
    "      </span>\n" +
    "    </a>\n" +
    "    <nav>\n" +
    '      <ul class="nav-links">\n' +
    '        <li><a href="' + prefix + 'index.html">HOME</a></li>\n' +
    '        <li><a href="' + prefix + 'index.html#services">サービス</a></li>\n' +
    '        <li><a href="' + prefix + 'works.html">制作実績</a></li>\n' +
    '        <li><a href="' + prefix + 'flow.html">制作までの流れ</a></li>\n' +
    '        <li><a href="' + prefix + 'course.html" class="active">お役立ち講座</a></li>\n' +
    '        <li><a href="' + prefix + 'blog.html">ブログ</a></li>\n' +
    '        <li><a href="' + prefix + 'profile.html">プロフィール</a></li>\n' +
    '        <li><a href="' + prefix + 'contact.html">お問い合わせ</a></li>\n' +
    '        <li class="nav-cta-mobile">\n' +
    '          <a href="' + prefix + 'contact.html#google-form-embed" class="btn btn-primary js-consult-link">無料相談はこちら</a>\n' +
    "        </li>\n" +
    "      </ul>\n" +
    "    </nav>\n" +
    '    <div class="nav-cta">\n' +
    '      <a href="' + prefix + 'contact.html#google-form-embed" class="btn btn-primary js-consult-link">無料相談はこちら</a>\n' +
    "    </div>\n" +
    '    <button class="nav-toggle" aria-label="メニューを開く">\n' +
    "      <span></span><span></span><span></span>\n" +
    "    </button>\n" +
    "  </div>\n" +
    "</header>\n\n"
  );
}

function siteFooter(depth) {
  const prefix = depth === "course" ? "../" : "";
  return (
    '<footer class="site-footer">\n' +
    '  <div class="container">\n' +
    '    <div class="footer-grid">\n' +
    '      <div class="footer-brand">\n' +
    '        <img src="' + prefix + 'assets/images/logo.png" alt="福祉ITパートナー ロゴ" class="footer-logo">\n' +
    '        <span class="brand-name">福祉ITパートナー</span>\n' +
    "        <p>福祉の現場に、ITという安心を。<br>福祉事業所・団体のホームページ制作・IT支援を行っています。</p>\n" +
    "      </div>\n" +
    '      <div class="footer-col">\n' +
    "        <h4>サイトメニュー</h4>\n" +
    "        <ul>\n" +
    '          <li><a href="' + prefix + 'index.html">HOME</a></li>\n' +
    '          <li><a href="' + prefix + 'index.html#services">サービス</a></li>\n' +
    '          <li><a href="' + prefix + 'works.html">制作実績</a></li>\n' +
    '          <li><a href="' + prefix + 'course.html">お役立ち講座</a></li>\n' +
    '          <li><a href="' + prefix + 'blog.html">ブログ</a></li>\n' +
    '          <li><a href="' + prefix + 'profile.html">プロフィール</a></li>\n' +
    '          <li><a href="' + prefix + 'contact.html">お問い合わせ</a></li>\n' +
    "        </ul>\n" +
    "      </div>\n" +
    '      <div class="footer-col">\n' +
    "        <h4>お問い合わせ</h4>\n" +
    "        <ul>\n" +
    '          <li><a href="' + prefix + 'contact.html#google-form-embed" class="js-consult-link">無料相談はこちら</a></li>\n' +
    '          <li><a href="' + prefix + 'privacy.html">プライバシーポリシー</a></li>\n' +
    '          <li><a href="https://www.youtube.com/channel/UCO008bmCPVaEV-tFV1ApXMg" target="_blank" rel="noopener noreferrer">YouTube｜ぶひおの3分福祉</a></li>\n' +
    "        </ul>\n" +
    "      </div>\n" +
    "    </div>\n" +
    '    <div class="footer-bottom">\n' +
    "      &copy; 2026 福祉ITパートナー｜上原健太\n" +
    "    </div>\n" +
    "  </div>\n" +
    "</footer>\n\n" +
    '<script src="' + prefix + 'assets/js/main.js"></script>\n' +
    (depth === "course" ? '<script src="../assets/js/course-toc.js"></script>\n' : '<script src="assets/js/course-toc.js"></script>\n') +
    "</body>\n</html>\n"
  );
}

function buildTocHtml(headings) {
  if (!headings.length) return "";
  const items = headings
    .map((h) => {
      const cls = h.level === 3 ? "course-toc-h3" : "course-toc-h2";
      return '        <li class="' + cls + '"><a href="#' + h.id + '">' + escapeHtml(h.text) + "</a></li>";
    })
    .join("\n");
  return (
    '      <nav class="course-toc" aria-label="目次">\n' +
    '        <p class="course-toc-title">目次</p>\n' +
    "        <ol>\n" +
    items +
    "\n        </ol>\n" +
    "      </nav>\n"
  );
}

function renderCoursePage(course) {
  const data = course.data;
  const slug = course.slug;
  const dateDisplay = formatDateDisplay(data.date);
  const imageSrc = toSiteImagePath(data.image, "blog"); // "blog" depth = 1階層下からの相対パス（course/も同じ深さ）
  const { html: bodyHtml, headings } = courseBodyToHtml(course.body, "course");
  const description = descriptionOf(data, course.body);
  const title = data.title + "｜お役立ち講座｜福祉ITパートナー";

  return (
    siteHead({
      title,
      description,
      canonicalPath: "/course/" + slug + ".html",
      ogImage: imageSrc,
      depth: "course",
    }) +
    siteHeader("course") +
    "<main>\n" +
    "  <section>\n" +
    '    <div class="container course-article reveal">\n' +
    '      <a href="../course.html" class="back-link">← お役立ち講座一覧へ戻る</a>\n' +
    '      <div class="meta-row">\n' +
    '        <span class="category-badge">' + escapeHtml(data.category_label) + "</span>\n" +
    '        <span class="blog-date"><time datetime="' + escapeHtml(data.date) + '">' + escapeHtml(dateDisplay) + "</time></span>\n" +
    "      </div>\n" +
    "      <h1>" + escapeHtml(data.title) + "</h1>\n" +
    "\n" +
    '      <div class="article-eyecatch">\n' +
    '        <img src="' + imageSrc + '" alt="' + escapeHtml(data.image_alt || "") + '">\n' +
    "      </div>\n" +
    "\n" +
    buildTocHtml(headings) +
    "\n" +
    '      <div class="course-body">\n' +
    bodyHtml +
    "      </div>\n" +
    "\n" +
    "    </div>\n" +
    "  </section>\n" +
    "\n" +
    '  <section class="cta-section">\n' +
    '    <div class="container reveal">\n' +
    "      <h2>まずはお気軽にご相談ください。</h2>\n" +
    '      <div class="btn-group">\n' +
    '        <a href="../contact.html#google-form-embed" class="btn btn-accent js-consult-link">無料相談はこちら</a>\n' +
    "      </div>\n" +
    "    </div>\n" +
    "  </section>\n" +
    "</main>\n\n" +
    siteFooter("course")
  );
}

function buildCourseIndex(publishedCourses) {
  return publishedCourses
    .slice()
    .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)))
    .map((c) => ({
      title: c.data.title,
      date: c.data.date,
      category_label: c.data.category_label,
      image: c.data.image || null,
      image_alt: c.data.image_alt || "",
      description: descriptionOf(c.data, c.body),
      excerpt: excerptFromText(c.body, 80),
      slug: c.slug,
    }));
}

function buildCourseCardHtml(entry) {
  return (
    '        <a class="blog-list-item reveal" href="course/' + entry.slug + '.html">\n' +
    '          <div class="blog-list-thumb">\n' +
    '            <img src="' + toSiteImagePath(entry.image, "root") + '" alt="' + escapeHtml(entry.image_alt) + '">\n' +
    "          </div>\n" +
    '          <div class="blog-list-body">\n' +
    '            <div class="meta-row">\n' +
    '              <span class="category-badge">' + escapeHtml(entry.category_label) + "</span>\n" +
    '              <span class="blog-date">' + escapeHtml(formatDateDisplay(entry.date)) + "</span>\n" +
    "            </div>\n" +
    "            <h3>" + escapeHtml(entry.title) + "</h3>\n" +
    '            <p class="excerpt">' + escapeHtml(entry.excerpt) + "</p>\n" +
    '            <span class="read-more">続きを読む</span>\n' +
    "          </div>\n" +
    "        </a>"
  );
}

function buildCourseTopHtml(courseIndex) {
  const cards = courseIndex.map(buildCourseCardHtml).join("\n\n");
  const categoryBadges = CATEGORIES.map((c) => '<li class="course-category-badge">' + escapeHtml(c) + "</li>").join("\n            ");

  return (
    siteHead({
      title: "福祉事業所のお役立ち講座｜福祉ITパートナー",
      description:
        "福祉事業所の経営者・管理者、これから福祉事業を始める方向けに、Web・AI・IT・集客について基礎からやさしく学べる講座コンテンツです。",
      canonicalPath: "/course.html",
      ogImage: "assets/images/logo.png",
      depth: "root",
    }) +
    siteHeader("root") +
    "<main>\n\n" +
    '  <section class="page-hero course-hero">\n' +
    '    <div class="container reveal">\n' +
    '      <span class="section-tag">お役立ち講座</span>\n' +
    "      <h1>福祉事業所のお役立ち講座</h1>\n" +
    "      <p>福祉事業所の経営者・管理者の方や、これから福祉事業を始める方に向けて、ホームページ・AI・IT活用・集客について、初めてでも分かるやさしい言葉で解説します。</p>\n" +
    '      <ul class="course-category-list">\n' +
    "            " + categoryBadges + "\n" +
    "      </ul>\n" +
    "    </div>\n" +
    "  </section>\n\n" +
    "  <section>\n" +
    '    <div class="container">\n' +
    '      <div class="blog-list">\n\n' +
    cards +
    "\n\n      </div>\n" +
    "    </div>\n" +
    "  </section>\n\n" +
    '  <section class="cta-section">\n' +
    '    <div class="container reveal">\n' +
    "      <h2>まずはお気軽にご相談ください。</h2>\n" +
    '      <div class="btn-group">\n' +
    '        <a href="contact.html#google-form-embed" class="btn btn-accent js-consult-link">無料相談はこちら</a>\n' +
    "      </div>\n" +
    "    </div>\n" +
    "  </section>\n\n" +
    "</main>\n\n" +
    siteFooter("root")
  );
}

function generateCourse({ root = ROOT } = {}) {
  root = path.resolve(root);
  const coursesDir = path.join(root, "content", "courses");
  const courseIndexFile = path.join(root, "data", "course-index.json");
  const courseDir = path.join(root, "course");
  const courseHtmlFile = path.join(root, "course.html");

  const courses = loadCourses(coursesDir);
  const published = courses.filter((c) => c.data.published === true);

  fs.mkdirSync(courseDir, { recursive: true });

  // 下書きへ戻された（または削除された）講座のHTMLを削除する。
  // 対象は content/courses に実在する原稿のうちpublished:falseのものだけに限定し
  // （＝検証済みの既存CMS原稿に対応する出力のみ）、原稿自体が存在しない
  // 未管理のHTMLは削除しない。
  const unpublishedPaths = courses
    .filter((c) => c.data.published !== true)
    .map((c) => path.join(courseDir, c.slug + ".html"));
  for (const outPath of unpublishedPaths) {
    if (fs.existsSync(outPath) && !fs.lstatSync(outPath).isFile()) throw new Error("Unsafe output: " + outPath);
  }
  for (const outPath of unpublishedPaths) {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }

  const courseIndex = buildCourseIndex(published);
  fs.mkdirSync(path.dirname(courseIndexFile), { recursive: true });
  fs.writeFileSync(courseIndexFile, JSON.stringify(courseIndex, null, 2) + "\n", "utf8");
  console.log("generated " + courseIndexFile + " (" + published.length + " course article(s))");

  published.forEach((course) => {
    const outPath = path.join(courseDir, course.slug + ".html");
    fs.writeFileSync(outPath, renderCoursePage(course), "utf8");
    console.log("generated " + outPath);
  });

  fs.writeFileSync(courseHtmlFile, buildCourseTopHtml(courseIndex), "utf8");
  console.log("generated " + courseHtmlFile);

  // sitemap.xmlは既存ブログ側（scripts/generate-blog.js）のbuildSitemap()を
  // そのまま呼び出して再生成する。ブログ記事の読み込み・URL組み立ては
  // 完全に既存ロジックのままで、お役立ち講座のURLだけが追加される。
  const sitemapFile = path.join(root, "sitemap.xml");
  const blogArticlesDir = path.join(root, "content", "articles");
  let blogArticles = [];
  try {
    blogArticles = loadBlogArticles(blogArticlesDir);
  } catch (err) {
    blogArticles = [];
  }
  const publishedBlogArticles = blogArticles.filter((a) => a.data.published === true);
  fs.writeFileSync(
    sitemapFile,
    buildSitemap(publishedBlogArticles, blogArticles, path.join(root, "blog"), root),
    "utf8"
  );
  console.log("updated " + sitemapFile);

  return {
    publishedCount: published.length,
    files: [
      path.relative(root, courseIndexFile).split(path.sep).join("/"),
      ...published.map((c) => "course/" + c.slug + ".html"),
      path.relative(root, courseHtmlFile).split(path.sep).join("/"),
      path.relative(root, sitemapFile).split(path.sep).join("/"),
    ],
  };
}

if (require.main === module) {
  generateCourse();
}

module.exports = {
  CATEGORIES,
  loadCourses,
  renderCoursePage,
  buildCourseIndex,
  buildCourseTopHtml,
  generateCourse,
};
