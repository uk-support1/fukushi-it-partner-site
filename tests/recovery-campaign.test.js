"use strict";
// ホームページ再スタート（15,000円）キャンペーン：LP・記事7本・導線のテスト。
// 価格・提供範囲の誤認（データ復旧と誤解させる表現、原因をPHPと決めつける表現）が入り込まないことを重点的に確認する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const lib = require("../scripts/lib/articles");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const visibleText = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ");

const LP = "homepage-recovery.html";
const SLUGS = [
  "homepage-suddenly-not-displayed", "ameba-ownd-cannot-view", "wordpress-com-free-plan-notes",
  "free-homepage-service-migration", "homepage-rebuild-low-cost", "npo-welfare-homepage-rebuild",
  "php-vulnerability-and-site-down"
];
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)].map(m => JSON.parse(m[1]));

test("LP：15,000円（税込）が明示され、データ復旧と誤解させる記載がある", () => {
  const html = read(LP);
  const text = visibleText(html);
  assert.match(text, /15,000円/);
  assert.match(text, /税込/);
  assert.match(text, /データの復旧|データ復旧/);
  assert.match(text, /完全な(再現|復元)/);
  assert.match(text, /月額の?管理費[^。]{0,6}0円/);
  assert.match(text, /年額の実費/);
  assert.match(html, /<link rel="canonical" href="https:\/\/fukushi-it-partner\.com\/homepage-recovery\.html">/);
  assert.match(html, /js-consult-link/);
});

test("LP：復旧・復元を保証する表現と、原因をPHPと断定する表現がない", () => {
  const text = visibleText(read(LP)).replace(/\s+/g, "");
  for (const bad of [/確実に復旧/, /必ず復旧/, /データを(復旧|復元)します/, /完全復元(します|できます)/, /PHPの脆弱性が原因です/, /PHPが原因です/]) {
    assert.doesNotMatch(text, bad, String(bad));
  }
});

test("LP：既存プランの価格表記が公開ページと一致している", () => {
  const text = visibleText(read(LP));
  assert.match(text, /19,800円/);
  assert.match(text, /49,500円〜/);
  assert.match(text, /5,500円〜/);
  assert.match(text, /4,400円/);
  assert.match(read("homepage-plan.html"), /19,800/);
  assert.match(read("homepage-cost-reduction.html"), /49,500円/);
});

test("LP：FAQの構造化データが表示内容と同じ数、BreadcrumbListがある", () => {
  const html = read(LP);
  const graph = jsonLd(html)[0]["@graph"];
  const faq = graph.find(n => n["@type"] === "FAQPage");
  const shown = html.split('id="rc-faq"')[1].split("</section>")[0].match(/<details>/g).length;
  assert.equal(faq.mainEntity.length, shown);
  assert.ok(graph.some(n => n["@type"] === "BreadcrumbList"));
});

test("LPと記事内のサイト内リンクがすべて実在する", () => {
  const files = [LP, ...SLUGS.map(s => "blog/" + s + ".html"), "php-homepage-comparison.html", "homepage-cost-reduction.html", "homepage-plan.html"];
  for (const file of files) {
    const dir = path.dirname(path.join(ROOT, file));
    for (const m of read(file).matchAll(/href="([^"#?]+\.html)(?:#[^"]*)?"/g)) {
      if (/^https?:/.test(m[1])) continue;
      assert.ok(fs.existsSync(path.resolve(dir, m[1])), file + " -> " + m[1]);
    }
  }
});

test("記事7本が公開済みで、説明文・画像・関連記事が揃い、LPへ案内している", () => {
  const articles = lib.loadArticles(path.join(ROOT, "content", "articles"));
  const bySlug = new Map(articles.map(a => [a.slug, a]));
  const catalog = new Map(require("../data/image-library.json").images.map(i => [i.path, i]));
  for (const slug of SLUGS) {
    const a = bySlug.get(slug);
    assert.ok(a, slug);
    assert.equal(a.data.published, true);
    assert.ok(a.data.description.length >= 80 && a.data.description.length <= 180, slug + " description length " + a.data.description.length);
    assert.ok(catalog.has(a.data.image), slug + " hero from library");
    assert.equal(a.data.related.length, 2);
    for (const r of a.data.related) assert.ok(bySlug.has(r) || fs.existsSync(path.join(ROOT, "blog", r + ".html")), slug + " related " + r);
    assert.match(read("blog/" + slug + ".html"), /homepage-recovery\.html/, slug + " links to the LP");
  }
  assert.equal(new Set(SLUGS.map(s => bySlug.get(s).data.title)).size, SLUGS.length);
});

test("記事：データ復旧ではないこと・日付付きの注意が書かれ、断定表現がない", () => {
  for (const slug of SLUGS) {
    const text = visibleText(read("blog/" + slug + ".html")).replace(/\s+/g, "");
    if (/15,000円/.test(text)) assert.match(text, /データ復旧ではなく/, slug);
    for (const bad of [/PHPの脆弱性が原因です/, /PHPが原因でした/, /サービスが終了(します|しました)(?!か)/, /完全に復旧(します|できます)/]) {
      assert.doesNotMatch(text, bad, slug + " " + bad);
    }
  }
  const ownd = visibleText(read("blog/ameba-ownd-cannot-view.html")).replace(/\s+/g, "");
  assert.match(ownd, /2026年10月28日ごろまでに確認できた情報/);
  assert.match(ownd, /PHPとの関係(について)?も、公式には触れられていません/);
  assert.match(ownd, /公式のお知らせでご確認ください/);
});

test("導線：サイトマップ・フッター・PHP比較ページ・維持費ページ・料金ページ・PHP記事からLPへ到達できる", () => {
  assert.match(read("sitemap.xml"), /https:\/\/fukushi-it-partner\.com\/homepage-recovery\.html/);
  for (const file of ["index.html", "homepage-plan.html", "php-homepage-comparison.html", "homepage-cost-reduction.html", "blog.html", "blog/php-update-not-possible.html", "blog/critical-php-vulnerability-2026-10.html", "course.html"]) {
    assert.match(read(file), /homepage-recovery\.html/, file);
  }
  assert.match(read("php-homepage-comparison.html"), /rc-banner/);
  assert.match(read("scripts/generate-blog.js"), /homepage-recovery\.html/);
  assert.match(read("scripts/generate-course.js"), /homepage-recovery\.html/);
});

test("既存の49,500円〜の表記と、PHP比較ページの価格・FAQは変わっていない", () => {
  const cmp = visibleText(read("php-homepage-comparison.html"));
  assert.match(cmp, /49,500円〜/);
  assert.equal(jsonLd(read("php-homepage-comparison.html"))[0]["@graph"].find(n => n["@type"] === "FAQPage").mainEntity.length, 8);
});
