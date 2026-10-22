"use strict";
// PHP脆弱性をきっかけにした集客施策（記事12本・比較ページ・既存LPへの追記）のテスト。
// 記事は事実（修正版の番号・サポート期限）を扱うため、番号の書き間違いと、
// 「49,500円で一律に移行できる」と誤解させる表現が入り込まないことを重点的に確認する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const lib = require("../scripts/lib/articles");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");

const HUB = "critical-php-vulnerability-2026-10";
const SLUGS = [
  HUB, "homepage-security-maintenance-cost", "homepage-without-php", "php-check-my-homepage",
  "php-contact-form-alternatives", "php-old-version-risk", "php-possible-attack-checklist", "php-update-cost",
  "php-update-not-possible", "php-version-check", "wordpress-php-relationship", "wordpress-to-static-pros-cons"
];
const COMPARE = "php-homepage-comparison.html";
const BASE = "https://fukushi-it-partner.com/";
// 記事に出てよいPHPの番号：今回の修正版と、その境界・例・サポート終了版の最終版
const KNOWN_VERSIONS = new Set(["8.5.12", "8.4.27", "8.3.36", "8.2.35", "8.5.11", "8.4.26", "8.3.35", "8.2.34", "8.3.30", "8.4.28", "8.1.34", "8.0.30", "7.4.33"]);

const campaignFiles = [...SLUGS.map(s => "blog/" + s + ".html"), COMPARE, "homepage-cost-reduction.html"];
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)].map(m => JSON.parse(m[1]));
const visibleText = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");

test("記事12本がすべて公開済みで、日付・説明文・画像・関連記事が揃っている", () => {
  const articles = lib.loadArticles(path.join(ROOT, "content", "articles"));
  const bySlug = new Map(articles.map(a => [a.slug, a]));
  const catalog = new Map(require("../data/image-library.json").images.map(i => [i.path, i]));
  for (const slug of SLUGS) {
    const article = bySlug.get(slug);
    assert.ok(article, slug + " exists");
    assert.equal(article.data.published, true, slug + " published");
    assert.equal(article.data.date, "2026-10-22", slug + " date");
    assert.ok(article.data.description.length >= 80 && article.data.description.length <= 180, slug + " description length");
    assert.ok(catalog.has(article.data.image), slug + " hero is a cataloged library image");
    assert.ok(Array.isArray(article.data.related) && article.data.related.length === 2, slug + " has two related slugs");
    for (const related of article.data.related) assert.ok(SLUGS.includes(related), slug + " related stays in the series: " + related);
    assert.ok(fs.existsSync(path.join(ROOT, "blog", slug + ".html")), slug + " generated");
  }
  assert.equal(new Set(SLUGS.map(s => bySlug.get(s).data.title)).size, SLUGS.length, "titles are unique");
});

test("PHPの番号の書き間違いがない：記事・比較ページ・LPに出る8.x.y／7.4.yはすべて確認済みの番号", () => {
  for (const file of campaignFiles) {
    const text = visibleText(read(file));
    for (const match of text.matchAll(/\b(?:8\.[0-5]|7\.4)\.\d+\b/g)) {
      assert.ok(KNOWN_VERSIONS.has(match[0]), file + " has an unverified PHP version: " + match[0]);
    }
  }
});

test("修正版の番号とサポート期限が、公式の情報どおりに書かれている", () => {
  const hub = visibleText(read("blog/" + HUB + ".html"));
  for (const version of ["8.5.12", "8.4.27", "8.3.36", "8.2.35", "CVE-2026-109618", "CVE-2026-109619"]) assert.ok(hub.includes(version), "hub mentions " + version);
  assert.match(hub, /9\.2/);
  const risk = visibleText(read("blog/php-old-version-risk.html"));
  for (const date of ["2029年12月31日", "2028年12月31日", "2027年12月31日", "2026年12月31日", "2025年12月31日"]) assert.ok(risk.includes(date), "end-of-support date " + date);
  assert.match(visibleText(read(COMPARE)), /2026年末でサポートが終わります/);
});

test("すべての記事が、ハブ記事と比較ページへ辿れる（ハブ自身は比較ページへ）", () => {
  for (const slug of SLUGS) {
    const html = read("blog/" + slug + ".html");
    assert.ok(html.includes('href="../' + COMPARE + '"'), slug + " links to the comparison page");
    if (slug !== HUB) assert.ok(html.includes('href="' + HUB + '.html"') || html.includes("関連記事"), slug + " reaches the hub");
  }
  // ハブは、残りの11本すべてへの入口になっている
  const hub = read("blog/" + HUB + ".html");
  for (const slug of SLUGS.filter(s => s !== HUB)) assert.ok(hub.includes('href="' + slug + '.html"'), "hub links to " + slug);
});

test("記事・比較ページ・LPの内部リンクが、すべて実在するファイル・見出しに届く", () => {
  const pages = [...campaignFiles, "blog.html", "index.html", "homepage-plan.html"];
  for (const file of pages) {
    const dir = path.dirname(path.join(ROOT, file));
    const html = read(file);
    for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|tel:|data:)/.test(href)) continue;
      const [target, hash] = href.split("#");
      const targetPath = target.split("?")[0];
      const targetFile = targetPath === "" ? path.join(ROOT, file) : path.resolve(dir, targetPath);
      const resolved = fs.existsSync(targetFile) && fs.statSync(targetFile).isDirectory() ? path.join(targetFile, "index.html") : targetFile;
      assert.ok(fs.existsSync(resolved) && fs.statSync(resolved).isFile(), file + " -> " + href + " does not exist");
      // #google-form-embed は、サイト全体の「無料相談」ボタンが以前から使っているリンクで、問い合わせページに同名のidはない（ページへの遷移は正常）。
      if (hash && hash !== "google-form-embed") assert.ok(fs.readFileSync(resolved, "utf8").includes('id="' + hash + '"'), file + " -> " + href + " anchor is missing");
    }
  }
});

test("比較ページ：SEO設定（title・説明・canonical・OG・GA4・構造化データ・見出し）が整っている", () => {
  const page = read(COMPARE);
  assert.match(page, /<title>PHPホームページの更新・乗り換え方法を比較｜福祉ITパートナー<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{80,}"/);
  assert.match(page, new RegExp('<link rel="canonical" href="' + BASE.replace(/\./g, "\\.") + COMPARE.replace(/\./g, "\\.") + '">'));
  assert.match(page, new RegExp('<meta property="og:url" content="' + BASE.replace(/\./g, "\\.") + COMPARE.replace(/\./g, "\\.") + '">'));
  assert.match(page, /assets\/js\/ga4\.js/);
  assert.match(page, /assets\/js\/main\.js/);
  assert.ok(!/noindex/.test(page));
  assert.equal((page.match(/<h1\b/g) || []).length, 1, "exactly one h1");
  assert.match(page, /class="pc-table-wrap[^"]*" tabindex="0" role="region"/, "the wide table scrolls and is keyboard-reachable");
  const graph = jsonLd(page)[0]["@graph"];
  assert.deepEqual(graph.map(node => node["@type"]), ["WebPage", "BreadcrumbList", "FAQPage"]);
  assert.equal(graph[0].url, BASE + COMPARE);
  assert.ok(fs.existsSync(path.join(ROOT, "assets", "css", "php-compare.css")));
  for (const link of ["assets/css/php-compare.css", "favicon.ico", "site.webmanifest"]) assert.ok(fs.existsSync(path.join(ROOT, link.split("?")[0])), link);
});

test("比較ページ：4つの選び方を、費用・安全面・管理負担・更新のしやすさ・向く事業者で比べ、PHPを更新して続ける方法も公平に説明している", () => {
  const page = read(COMPARE);
  for (const option of ["PHPを更新して継続", "WordPressを継続して保守管理", "制作会社へ更新・保守を依頼", "静的HTMLなどへ移行"]) assert.ok(page.includes(option), option);
  for (const row of ["費用の考え方", "セキュリティ", "管理の負担", "更新のしやすさ", "向いている事業者"]) assert.match(page, new RegExp("<th scope=\"row\">" + row + "</th>"), row);
  assert.match(page, /PHPやWordPress<\/strong>を「危険」と決めつけません/);
  assert.match(page, /乗り換えは必須ではありません/);
  assert.ok(!/(?:PHP|WordPress)(?:は|が)(?:とても|非常に)?危険(?:です|だ)/.test(visibleText(page)), "PHP/WordPress are never declared dangerous");
  assert.ok(!/絶対に安全(?:です|だ)(?!か)|必ず安くなります|必ず解決/.test(visibleText(page)));
});

test("誤認防止：49,500円は基本プランの料金で、PHPフォーム・会員・予約などは個別見積り。診断は脆弱性診断・侵害調査ではないと明記している", () => {
  for (const file of [COMPARE, "homepage-cost-reduction.html"]) {
    const text = visibleText(read(file));
    assert.match(text, /49,500円で一律に移行できるわけではありません/, file);
    assert.match(text, /個別のお見積り/, file);
    assert.match(text, /脆弱性診断や、攻撃を受けたかどうかの調査は行っていません/, file);
  }
  for (const slug of ["php-possible-attack-checklist", HUB]) {
    const text = visibleText(read("blog/" + slug + ".html"));
    assert.match(text, /脆弱性診断/, slug);
    assert.match(text, /攻撃を受けたかどうか/, slug);
  }
  // 49,500円に触れる記事は、必ず「一律ではない」旨を添えている
  for (const slug of SLUGS) {
    const text = visibleText(read("blog/" + slug + ".html"));
    if (text.includes("49,500円")) assert.match(text, /個別(?:の|に)(?:お)?見積り/, slug + " caveat");
  }
});

test("既存LP：料金・サポートの金額は変わらず、PHP向けの説明とFAQが追加され、FAQは表示と構造化データが一致している", () => {
  const page = read("homepage-cost-reduction.html");
  const text = visibleText(page);
  for (const price of ["49,500円", "5,500円〜", "月額4,400円", "月額9,900円", "118,800", "356,400"]) assert.ok(text.includes(price), "LP still shows " + price);
  assert.match(page, /<title>ホームページ維持費削減・乗り換えプラン｜福祉ITパートナー<\/title>/);
  assert.match(page, /<link rel="canonical" href="https:\/\/fukushi-it-partner\.com\/homepage-cost-reduction\.html">/);
  assert.match(page, /id="cs-php"/);
  assert.match(page, /href="php-homepage-comparison\.html"/);
  assert.match(page, /cost-switch\.css\?v=9/);
  const faq = jsonLd(page).find(node => node["@type"] === "FAQPage");
  const visible = [...page.matchAll(/<details class="cs-faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)]
    .map(m => [m[1].trim(), m[2].replace(/<[^>]+>/g, "").trim()]);
  assert.equal(faq.mainEntity.length, visible.length);
  faq.mainEntity.forEach((question, index) => {
    assert.equal(question.name, visible[index][0], "FAQ question " + index);
    assert.equal(question.acceptedAnswer.text, visible[index][1], "FAQ answer " + index);
  });
});

test("比較ページのFAQも、表示と構造化データが一致している", () => {
  const page = read(COMPARE);
  const faq = jsonLd(page)[0]["@graph"].find(node => node["@type"] === "FAQPage");
  const visible = [...page.matchAll(/<details class="pc-faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)]
    .map(m => [m[1].trim(), m[2].trim()]);
  assert.equal(faq.mainEntity.length, 8);
  assert.equal(visible.length, 8);
  faq.mainEntity.forEach((question, index) => {
    assert.equal(question.name, visible[index][0]);
    assert.equal(question.acceptedAnswer.text, visible[index][1]);
  });
});

test("サイトマップ・フッター・トップ・料金プランから、比較ページと12本の記事へ辿れる", () => {
  const sitemap = read("sitemap.xml");
  assert.ok(sitemap.includes("<loc>" + BASE + COMPARE + "</loc>"));
  for (const slug of SLUGS) assert.ok(sitemap.includes("<loc>" + BASE + "blog/" + slug + ".html</loc>"), slug + " in sitemap");
  assert.ok(read("scripts/generate-blog.js").includes('"' + BASE + COMPARE + '"'), "the sitemap generator keeps the page");
  const footerLink = /<li><a href="(?:\.\.\/)?php-homepage-comparison\.html">PHP・WordPress乗り換え比較<\/a><\/li>/;
  for (const file of ["index.html", "homepage-plan.html", "homepage-cost-reduction.html", "server-domain-guide.html", "works.html", "flow.html", "profile.html", "contact.html", "privacy.html", "services.html", "support.html", "course.html", "blog.html", "subsidy-support/index.html", "blog/" + HUB + ".html"]) {
    assert.match(read(file), footerLink, file + " footer link");
  }
  assert.ok((read("scripts/generate-blog.js").match(/php-homepage-comparison\.html">PHP・WordPress乗り換え比較/g) || []).length === 2, "both blog templates");
  assert.match(read("scripts/generate-course.js"), /php-homepage-comparison\.html">PHP・WordPress乗り換え比較/);
  for (const file of ["index.html", "homepage-plan.html"]) assert.match(read(file), /<a href="php-homepage-comparison\.html">更新・乗り換え方法の比較<\/a>/, file + " teaser link");
  const index = JSON.parse(read("data/blog-index.json"));
  for (const slug of SLUGS) assert.ok(index.some(entry => entry.slug === slug), slug + " in the blog list");
});

test("記事ページに、Article（BlogPosting）とパンくずの構造化データが付き、アドレスはcanonicalと一致する", () => {
  for (const slug of SLUGS) {
    const html = read("blog/" + slug + ".html");
    const graph = jsonLd(html)[0]["@graph"];
    const post = graph.find(node => node["@type"] === "BlogPosting");
    const crumbs = graph.find(node => node["@type"] === "BreadcrumbList");
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)[1];
    assert.equal(canonical, BASE + "blog/" + slug + ".html");
    assert.equal(post.mainEntityOfPage["@id"], canonical);
    assert.equal(post.datePublished, "2026-10-22");
    assert.match(post.image[0], /^https:\/\/fukushi-it-partner\.com\/assets\/images\/blog-library\/hero\//);
    assert.equal(crumbs.itemListElement.length, 3);
    assert.equal(crumbs.itemListElement[2].item, canonical);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, slug + " one h1");
    assert.ok(!html.includes("</script><"), "structured data cannot break out of its script block");
  }
});

test("構造化データのJSONは、'<'を\\u003cに置き換えて</script>で閉じられない（記事テンプレート）", () => {
  const { renderArticlePage } = require("../scripts/generate-blog");
  const article = { slug: "x-test", body: "本文", data: { title: "</script><b>t", date: "2026-10-22", type: "column", image: "assets/images/logo.png", description: "説明</script>" } };
  const html = renderArticlePage(article, { "x-test": article }, [article]);
  const block = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/)[1];
  assert.ok(!block.includes("<"), "no raw angle bracket inside the JSON");
  assert.equal(JSON.parse(block)["@graph"][0].headline, "</script><b>t");
});
