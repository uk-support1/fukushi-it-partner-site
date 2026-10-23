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
      if (hash) assert.ok(fs.readFileSync(resolved, "utf8").includes('id="' + hash + '"'), file + " -> " + href + " anchor is missing");
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

test("比較ページ（下部のくわしい比較表）：A-①・A-②・B・Cを、費用・安全面・管理負担・更新のしやすさ・向く事業者で比べ、PHPを更新して続ける方法も公平に説明している", () => {
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

test("「無料相談」ボタン（#google-form-embed）の移動先が、問い合わせページのフォームに存在する", () => {
  const contact = read("contact.html");
  assert.equal((contact.match(/id="google-form-embed"/g) || []).length, 1, "exactly one target");
  const section = contact.match(/<section class="contact-form-section" id="google-form-embed">([\s\S]*?)<\/section>/);
  assert.ok(section && section[1].includes('id="contact-form"'), "the target section contains the contact form");
  assert.match(read("assets/css/style.css"), /\.contact-form-section\s*\{[^}]*scroll-margin-top:/, "the heading is not stuck to the sticky header");
  // どのページの無料相談ボタンも、同じ移動先を指している（相対パスはページごとに異なるが、ファイルとidは同じ）
  for (const file of ["index.html", "homepage-cost-reduction.html", COMPARE, "blog.html", "blog/" + HUB + ".html", "server-domain-guide.html", "contact.html"]) {
    const links = [...read(file).matchAll(/href="((?:\.\.\/)?(?:contact\.html)?#google-form-embed)"/g)];
    assert.ok(links.length >= 2, file + " has consultation buttons");
  }
});

test("PHP記事の追加後も、ほかの既存記事の「関連記事」に内容の合わない記事が出ない（関連記事を手動で指定した7本）", () => {
  const manual = {
    "article-2026-09-12-f0e5810ed646": ["article-2026-10-03-8fc1e175357e", "article-2026-10-04-4556b703d269"],
    "article-2026-09-14-6ca79ae15b4f": ["article-2026-10-05-af89cd319b17", "article-2026-10-04-4556b703d269"],
    "article-2026-09-19-8c2cd49ae608": ["article-2026-09-23-59ef7fca0e92", "article-2026-10-17-871ba9e14398"],
    "article-2026-09-23-59ef7fca0e92": ["article-2026-09-19-8c2cd49ae608", "article-2026-10-05-af89cd319b17"],
    "article-2026-10-16-bb9ecce5ed2d": ["post-03-ai-first-step", "article-2026-09-16-6cb0c0eff193"],
    "article-2026-10-18-efb45ffc58ca": ["group-home-vacancy-information", "group-home-website-content"],
    "welfare-website-essential-information": ["why-homepage-5-reasons", "website-pricing-two-plans"]
  };
  for (const [slug, related] of Object.entries(manual)) {
    const html = read("blog/" + slug + ".html");
    const cards = [...html.matchAll(/<a class="blog-list-item reveal" href="([^"]+)\.html">/g)].map(m => m[1]);
    assert.deepEqual(cards, related, slug + " shows its hand-picked related articles");
    for (const campaign of SLUGS) assert.ok(!cards.includes(campaign), slug + " does not show " + campaign);
  }
});

// ---- 比較ページの全面改善（専門知識のない経営者向け）：ナビの入口、上部の見せ方、下部への整理 ----
const textOf = html => html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, "").replace(/<br[^>]*>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const sectionOf = (html, id) => {
  const found = html.match(new RegExp('<section[^>]*id="' + id + '"[\\s\\S]*?</section>'));
  assert.ok(found, "section #" + id);
  return found[0];
};
const htmlFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? htmlFiles(full) : entry.name.endsWith(".html") ? [full] : [];
});

test("全ページ共通ナビに「PHP対応」（小さなNEWバッジ付き）があり、比較ページへ移動する", () => {
  let checked = 0;
  for (const full of htmlFiles(ROOT)) {
    const html = fs.readFileSync(full, "utf8");
    const nav = html.match(/<ul class="nav-links">([\s\S]*?)<\/ul>/);
    if (!nav) continue; // 共通ナビを持たないページ（移転の転送ページ・補助金LPの独自ヘッダー）
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    const prefix = "../".repeat(rel.split("/").length - 1);
    const items = [...nav[1].matchAll(/<li><a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a><\/li>/g)];
    const php = items.filter(item => item[1] === prefix + COMPARE);
    assert.equal(php.length, 1, rel + " has exactly one PHP item in the nav");
    assert.match(php[0][2], rel === COMPARE ? /class="nav-php active"/ : /class="nav-php"/, rel);
    assert.equal(php[0][3], 'PHP対応<span class="nav-badge">NEW</span>', rel + " badge");
    // 料金プランのすぐ後ろに並び、ほかのメニューの順番は変わっていない
    assert.deepEqual(items.map(item => textOf(item[3])).slice(0, 4), ["HOME", "料金プラン", "PHP対応NEW", "制作実績"], rel + " order");
    checked++;
  }
  assert.ok(checked >= 70, "the shared nav is on most pages: " + checked);
  // 記事・講座のテンプレートからも同じ入口が出る（再生成しても消えない）
  assert.equal((read("scripts/generate-blog.js").match(/class="nav-php">PHP対応<span class="nav-badge">NEW<\/span>/g) || []).length, 2);
  assert.equal((read("scripts/generate-course.js").match(/class="nav-php">PHP対応<span class="nav-badge">NEW<\/span>/g) || []).length, 1);
  const css = read("assets/css/style.css");
  assert.match(css, /\.nav-links \.nav-badge\s*\{/);
  assert.ok(!/@keyframes|animation:/.test(css.match(/\.nav-links \.nav-badge\s*\{[^}]*\}/)[0]), "the badge never blinks");
});

test("比較ページの上部：やさしい問いかけの見出しと短い説明、ボタン1つで「3つの方法」へ進める", () => {
  const page = read(COMPARE);
  const hero = page.match(/<section class="pc-hero"[\s\S]*?<\/section>/)[0];
  assert.equal(textOf(hero.match(/<h1[\s\S]*?<\/h1>/)[0]), "あなたのホームページ、PHPの更新は大丈夫ですか？");
  assert.ok(textOf(hero).includes("古い仕組みを使っている場合、確認や更新が必要なことがあります。専門知識がなくても、対応方法をわかりやすくご案内します。"));
  assert.match(hero, /<a href="#pc-choices" class="btn btn-accent pc-btn-lg">対応方法を確認する<\/a>/);
  assert.ok(page.includes('id="pc-choices"'), "the hero button has a target");
  // 上部は文字を絞る（見出し・説明・ボタン・案内の一文）
  assert.ok(textOf(hero).length < 260, "the first view stays short: " + textOf(hero).length);
  // 専門用語（CVE・バージョン番号）は、最初の画面や3つの方法・比較のカードには出てこない
  const above = page.slice(page.indexOf('<section class="pc-hero"'), page.indexOf('id="pc-details"'));
  for (const term of ["CVE-", "8.2.35", "8.3.36", "脆弱性", "静的HTML", "プラグイン"]) assert.ok(!textOf(above.replace(/<section class="pc-section" id="pc-proposal"[\s\S]*?<\/section>/, "")).includes(term), "no jargon above the fold: " + term);
  // 並び順：最初の画面 → 3つの方法 → 比較 → ご提案 → くわしい情報 → FAQ → 関連記事
  const order = ['class="pc-hero"', 'id="pc-choices"', 'id="pc-compare"', 'id="pc-proposal"', 'id="pc-details"', 'id="pc-faq"', 'id="pc-links"', 'id="pc-sources"'].map(marker => page.indexOf(marker));
  assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > order[index - 1])), "section order: " + order);
});

test("3つの選択肢（A・B・C）が、アイコン付きのカードで、メリットと注意点を短く示している", () => {
  const page = read(COMPARE);
  const expected = {
    a: ["今のホームページを使い続ける", "PHPを更新して、安全に使い続ける方法。"],
    b: ["管理会社に対応してもらう", "現在の制作会社・サーバー会社に、確認や更新を依頼する方法。"],
    c: ["ホームページを乗り換える", "PHPに依存しない、管理しやすいホームページへ移行する方法。"]
  };
  assert.equal((page.match(/<article class="pc-choice pc-choice--/g) || []).length, 3);
  for (const [key, [title, lead]] of Object.entries(expected)) {
    const card = page.match(new RegExp('<article class="pc-choice pc-choice--' + key + '[^"]*"[\\s\\S]*?</article>'))[0];
    assert.equal(textOf(card.match(/<h3[\s\S]*?<\/h3>/)[0]), title);
    assert.ok(textOf(card).includes(lead), key + " lead");
    assert.ok(card.includes('class="pc-choice-letter"') && card.includes('<span class="pc-choice-icon"><svg'), key + " has a letter and an icon");
    assert.ok(textOf(card).includes("メリット") && textOf(card).includes("注意点"), key + " has pros and cons");
    assert.equal((card.match(/<li>/g) || []).length, 4, key + " keeps the points short (2 pros, 2 cons)");
  }
  // 色で見分ける（A＝緑、B＝青、C＝オレンジ）。点滅・警告色のアニメーションは使わない
  const css = read("assets/css/php-compare.css");
  for (const key of ["a", "b", "c"]) assert.match(css, new RegExp("\\.pc-choice--" + key + "\\s*\\{[^}]*--c:"), key + " color");
  assert.ok(!/@keyframes|animation\s*:/.test(css), "no blinking or animation in the comparison page styles");
  assert.match(textOf(page), /PHPやWordPressを「危険」と決めつけません。乗り換えは必須ではありません。/);
});

test("視覚的な比較：費用・管理の手間・対応の難しさ・向いている会社を、A・B・Cのカードで示している", () => {
  const page = read(COMPARE);
  const cards = [...page.matchAll(/<article class="pc-cmp reveal">[\s\S]*?<\/article>/g)].map(match => match[0]);
  assert.deepEqual(cards.map(card => textOf(card.match(/<h3[\s\S]*?<\/h3>/)[0])), ["費用", "管理の手間", "対応の難しさ", "どんな会社に向いているか"]);
  cards.forEach((card, index) => {
    for (const key of ["a", "b", "c"]) assert.equal((card.match(new RegExp("pc-cmp-row--" + key + '"', "g")) || []).length, 1, index + " has a row for " + key);
    // 最初の3つは、3段階のメーター（●の数）で直感的に比べられる
    assert.equal((card.match(/class="pc-meter"/g) || []).length, index < 3 ? 3 : 0, "meters in card " + index);
    for (const meter of card.matchAll(/<span class="pc-meter" role="img" aria-label="目安：3段階のうち(\d)">((?:<i class="on"><\/i>|<i><\/i>){3})<\/span>/g)) {
      assert.equal((meter[2].match(/class="on"/g) || []).length, Number(meter[1]), "the screen-reader label matches the dots");
    }
  });
  assert.match(textOf(page), /あくまで目安です。費用や手間は、ホームページの大きさや、今ついている機能（会員ページ・予約など）によって大きく変わります。一律の相場はお示しできません。/);
});

test("福祉ITパートナーの提案：49,500円と、フォーム・予約・会員などは個別見積りであること、無料相談ボタンが同じ場所にある", () => {
  const proposal = sectionOf(read(COMPARE), "pc-proposal");
  const text = textOf(proposal);
  assert.ok(text.includes("ホームページの管理をもっと簡単にしませんか？"));
  assert.ok(text.includes("49,500円〜") || /49,500\s*円〜/.test(text));
  assert.match(text, /動的なフォーム・予約機能・会員機能・ネットショップ・データベースを使った機能などがある場合は、49,500円で一律に移行できるわけではありません。個別のお見積りになります。/);
  assert.match(text, /脆弱性診断や、攻撃を受けたかどうかの調査は行っていません/);
  assert.match(proposal, /<a href="contact\.html#google-form-embed" class="btn btn-accent js-consult-link">無料で相談する<\/a>/);
  assert.match(proposal, /<a href="homepage-cost-reduction\.html" class="btn btn-outline">乗り換えプランと費用の比較例を見る<\/a>/);
  // 料金の注意書きは、金額と同じカードの中にある（金額だけが目に入らない）
  const card = proposal.match(/<div class="pc-proposal-card">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || proposal.match(/<div class="pc-proposal-card">[\s\S]*$/);
  assert.ok(card[0].includes("49,500") && card[0].includes("個別のお見積り"));
});

test("専門的な内容は、下部の閉じたアコーディオンにまとまり、記事12本へのリンクも残っている", () => {
  const page = read(COMPARE);
  const details = sectionOf(page, "pc-details");
  const ids = [...details.matchAll(/<details class="pc-acc" id="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual(ids, ["pc-news", "pc-guide", "pc-table", "pc-options", "pc-static", "pc-questions", "pc-flow"]);
  assert.ok(!/<details class="pc-acc"[^>]*\sopen/.test(details), "closed by default");
  const text = textOf(details);
  for (const term of ["CVE-2026-109618", "CVE-2026-109619", "8.2.35", "8.5.12", "2026年末でサポートが終わります"]) assert.ok(text.includes(term), "details keep " + term);
  for (const slug of SLUGS) assert.ok(page.includes('href="blog/' + slug + '.html"'), "still links to " + slug);
  assert.equal((page.match(/<details class="pc-faq-item">/g) || []).length, 8, "FAQ stays visible below");
  // アコーディオンの中の見出しへのリンク（#pc-questions など）でも、自動で開く
  assert.match(page, /el\.tagName === "DETAILS"\) \{ el\.open = true;/);
  assert.match(page, /addEventListener\("hashchange", fromHash\)/);
  // SEO：title・canonical・構造化データは維持。説明文は3つの方法に合わせて更新済み
  assert.match(page, /<title>PHPホームページの更新・乗り換え方法を比較｜福祉ITパートナー<\/title>/);
  assert.match(page, /「今のまま更新して使い続ける」「管理会社に対応してもらう」「乗り換える」の3つの方法/);
  assert.ok(!page.includes("4つの方法") && !/の4つで、費用/.test(page), "no stale '4 options' wording in the SEO text");
});
