"use strict";
// 独立型ページ（専用ヘッダー・全業種向け・運営表記）のテスト。
// 対象：PHP比較ページ（php-homepage-comparison.html）と、Ameba Owndの終了と移行ガイド（ameba-ownd-end.html）。
// 「補助金活用支援」と同じく、共通メニュー（nav-links）には入れず、専用ヘッダー（lp-header）を持つ。
// 新しい独立型ページを足すときは、下の PAGES に1件追加すれば、同じ確認が自動で行われる。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const textOf = html => html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, "").replace(/<br[^>]*>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const htmlFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? htmlFiles(full) : entry.name.endsWith(".html") ? [full] : [];
});

const PAGES = [
  { file: "php-homepage-comparison.html", service: "PHP対応", anchors: ["#pc-choices", "#pc-compare", "#pc-proposal", "#pc-faq"], reason: "PHPの重大な脆弱性の公表（2026年10月）を受けた、緊急対応です。" },
  { file: "ameba-ownd-end.html", service: "Ameba Ownd終了", anchors: ["#oe-todo", "#oe-free", "#oe-ours", "#oe-faq"], reason: "2026年12月24日のAmeba Ownd終了を受けた、緊急対応です。" }
];
const INDUSTRIES = ["建設・工事", "製造・工場", "卸売・小売", "飲食・宿泊", "医療・福祉・介護", "美容・サービス", "士業・コンサル", "不動産", "運送・物流", "教育・スクール", "農業・漁業", "NPO・各種団体"];

test("共通メニューは、もとの7項目のまま。「PHP対応」「Ameba Ownd終了」は入っていない（補助金活用支援と同じ扱い）", () => {
  let checked = 0;
  for (const full of htmlFiles(ROOT)) {
    const nav = fs.readFileSync(full, "utf8").match(/<ul class="nav-links">([\s\S]*?)<\/ul>/);
    if (!nav) continue; // 共通メニューを持たないページ（独立型ページ・補助金LP・移転の転送ページ）
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    const items = [...nav[1].matchAll(/<li><a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a><\/li>/g)];
    assert.deepEqual(items.map(item => textOf(item[3])), ["HOME", "料金プラン", "制作実績", "制作までの流れ", "ブログ", "プロフィール", "お問い合わせ"], rel);
    assert.ok(!/php-homepage-comparison|ameba-ownd-end|nav-badge/.test(nav[1]), rel + " has no PHP/Ownd item");
    checked++;
  }
  assert.ok(checked >= 90, "the shared menu is on every ordinary page: " + checked);
  // 記事・講座のテンプレートからも出ない（再生成しても、メニューに戻らない）
  for (const file of ["scripts/generate-blog.js", "scripts/generate-course.js"]) {
    assert.ok(!/class="nav-(php|ownd)"|nav-badge/.test(read(file)), file + " has no leftover nav item");
  }
  assert.ok(!/\.nav-badge/.test(read("assets/css/style.css")), "the nav badge style is gone");
  // 共通メニューの幅の設定は、7項目だった頃の設定に戻してある
  const css = read("assets/css/style.css");
  assert.match(css, /@media \(max-width: 1200px\) \{\s*\.nav-cta \{\s*display: none;/);
  assert.ok(!/max-width: 1279px/.test(css), "no leftover nav breakpoint for 9 items");
});

for (const page of PAGES) {
  test(`独立型ページ ${page.file}：専用ヘッダー・全業種向けの案内・運営表記がそろっている`, () => {
    const html = read(page.file);
    // 一番上の「緊急対応」のお知らせ：ふだんは福祉事業所向けだが、今回は特別に業種を問わず受ける、という趣旨
    const notice = html.match(/<div class="lp-notice" role="note"[\s\S]*?<\/div>\s*<\/div>/)[0];
    assert.ok(html.indexOf('class="lp-notice"') > html.indexOf("<body") && html.indexOf('class="lp-notice"') < html.indexOf('<header class="lp-header">'), "the notice is the very first thing on the page");
    assert.equal(textOf(notice.match(/lp-notice-tag">([\s\S]*?)<\/span>/)[1]), "緊急対応");
    assert.equal(textOf(notice.match(/lp-notice-text">([\s\S]*?)<\/p>/)[1]), "今回は特別に、業種を問わずご相談をお受けしています。福祉ITパートナーは、ふだんは福祉事業所向けのサービスです。" + page.reason);
    // 不安をあおる言い方・期限や数量の限定（景品表示法の面でも不適切）は使わない
    for (const word of ["今だけ", "先着", "期間限定", "残りわずか", "急いで", "今すぐ", "限定"]) assert.ok(!textOf(notice).includes(word), "no pressure wording in the notice: " + word);
    // 専用ヘッダー（共通メニューは使わない）
    assert.match(html, /<body class="lp-shell">/);
    assert.match(html, /<link rel="stylesheet" href="assets\/css\/lp-shell\.css\?v=1">/);
    assert.match(html, /<script src="assets\/js\/lp-shell\.js"><\/script>/);
    assert.ok(fs.existsSync(path.join(ROOT, "assets/css/lp-shell.css")) && fs.existsSync(path.join(ROOT, "assets/js/lp-shell.js")));
    assert.ok(!/class="site-header"|class="nav-links"|class="nav-bar"/.test(html), "no shared header");
    const header = html.match(/<header class="lp-header">[\s\S]*?<\/header>/)[0];
    assert.equal(textOf(header.match(/lp-header-brand-name">([\s\S]*?)<\/span>/)[1]), "福祉ITパートナー");
    assert.equal(textOf(header.match(/lp-header-brand-service">([\s\S]*?)<\/span>/)[1]), page.service);
    const links = [...header.match(/<ul class="lp-nav-links">[\s\S]*?<\/ul>/)[0].matchAll(/<li><a href="(#[^"]+)">/g)].map(match => match[1]);
    assert.deepEqual(links, page.anchors, "in-page links");
    for (const anchor of links) assert.ok(html.includes('id="' + anchor.slice(1) + '"'), "target exists: " + anchor);
    assert.equal((header.match(/福祉ITパートナー公式サイトへ →/g) || []).length, 2, "official-site link (PC, menu)");
    assert.equal((header.match(/href="contact\.html#google-form-embed" class="btn btn-accent[^"]*js-consult-link"/g) || []).length, 2, "consult buttons (PC, menu)");
    assert.match(header, /<button type="button" class="lp-nav-toggle" aria-label="メニューを開く" aria-expanded="false">/);

    // 全業種向け：業種・規模を問わないことが、ファーストビューのすぐ下に見える
    const scope = html.match(/<section class="lp-scope"[\s\S]*?<\/section>/)[0];
    assert.ok(html.indexOf('class="lp-scope"') > html.indexOf('class="pc-hero"') && html.indexOf('class="lp-scope"') < html.indexOf('class="pc-section'), "scope band sits right below the first view");
    assert.equal(textOf(scope.match(/<h2[\s\S]*?<\/h2>/)[0]), "業種・規模を問わず、ご利用いただけます");
    assert.deepEqual([...scope.matchAll(/<li>([^<]+)<\/li>/g)].map(match => match[1]), INDUSTRIES);
    assert.ok(textOf(scope).includes("個人事業主の方から、小さな会社、大きな法人まで、ご相談いただけます。"));
    assert.ok(textOf(scope).includes("規模が大きい場合や、会員・予約・ネットショップなどの特別な機能がある場合は、内容を確認して、個別にお見積りします。"), "large or special cases are quoted individually");
    // 本文は福祉だけに向けた書き方にしない（ブランド名の「福祉ITパートナー」は除く）
    const body = textOf(html.slice(html.indexOf("<main"), html.indexOf("</main>"))).replace(/福祉ITパートナー/g, "");
    for (const phrase of ["福祉の現場", "福祉事業所", "福祉施設", "福祉団体", "NPO・福祉"]) assert.ok(!body.includes(phrase), "not welfare-only wording: " + phrase);
    assert.ok(!/[“”]?小規模な団体/.test(textOf(html)), "no small-organization-only wording");

    // フッター：運営は福祉ITパートナー（公式サイトへのリンクつき）
    const footer = html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
    assert.match(footer, /<div class="lp-footer-operator">\s*<span class="lp-footer-note">運営：福祉ITパートナー<\/span>\s*<a href="index\.html">福祉ITパートナー公式サイトへ →<\/a>\s*<\/div>/);
    assert.ok(footer.indexOf("lp-footer-operator") < footer.indexOf("footer-bottom"), "operator line sits above the copyright line");
  });
}

test("独立型ページのスタイルは、専用の部品ファイルにまとめてあり、補助金活用支援のCSSには手を入れていない", () => {
  const css = read("assets/css/lp-shell.css");
  for (const selector of [".lp-header", ".lp-nav-links", ".lp-nav-toggle", ".lp-scope", ".lp-scope-chips", ".lp-footer-operator"]) assert.ok(css.includes(selector), selector);
  assert.ok(!/\bjlp-/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), "no jlp- class (those belong to the subsidy LP)");
  // お知らせの帯は、やわらかいオレンジ系。点滅・動き・固定表示は使わない
  const notice = css.match(/\.lp-notice \{[^}]*\}/)[0];
  assert.ok(!/position:\s*(fixed|sticky)|animation/.test(css.match(/\.lp-notice[^{]*\{[^}]*\}/g).join("")), "the notice does not blink, move or stick");
  assert.match(notice, /background: #fff4e8;/);
  // 幅が狭いときのメニュー：開いたときだけ表示され、画面が低くても最後のボタンまで届く
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*\.lp-nav-links \{[\s\S]*max-height: calc\(100vh - 71px\);[\s\S]*overflow-y: auto;/);
  const js = read("assets/js/lp-shell.js");
  assert.match(js, /\.lp-nav-toggle/);
  assert.match(js, /aria-expanded/);
  // 補助金活用支援のLPは、そのまま（専用ヘッダー・運営表記・専用CSS）
  const subsidy = read("subsidy-support/index.html");
  assert.match(subsidy, /class="jlp-header"/);
  assert.match(subsidy, /運営：福祉ITパートナー/);
  assert.ok(!/lp-shell/.test(subsidy), "the subsidy LP does not use the new shell");
});

test("共通メニューから外しても、入口が残っている（フッター・サイトマップ・関連ページ）", () => {
  for (const file of ["index.html", "homepage-plan.html", "contact.html", "blog.html"]) {
    const html = read(file);
    assert.match(html, /<li><a href="php-homepage-comparison\.html">PHP・WordPress乗り換え比較<\/a><\/li>/, file + " footer: PHP");
    assert.match(html, /<li><a href="ameba-ownd-end\.html">Ameba Owndの終了と移行ガイド<\/a><\/li>/, file + " footer: Ownd");
  }
  const sitemap = read("sitemap.xml");
  assert.ok(sitemap.includes("<loc>https://fukushi-it-partner.com/php-homepage-comparison.html</loc>"));
  assert.ok(sitemap.includes("<loc>https://fukushi-it-partner.com/ameba-ownd-end.html</loc>"));
  // 再スタートのLPからの案内も残っている
  assert.match(read("homepage-recovery.html"), /href="ameba-ownd-end\.html"/);
});
