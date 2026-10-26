"use strict";

// 「レンタルサーバー・ドメイン比較＆契約サポート」ページ（server-domain-guide.html）のテスト：
// データから作った本文と一致している／ページの構成・導線／紹介リンクの扱い／PR表記／料金の整合性／SEO・導線
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const guide = require("../scripts/build-server-guide");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const data = JSON.parse(read("data/server-guide.json"));
const page = read("server-domain-guide.html");

const SAKURA_REFERRAL = "https://secure.sakura.ad.jp/order/rs-domain/agency/rs/plans?aid=29aa6a6d92e19bd50eaff2cdc2e06320";
const A8_HREF = "https://px.a8.net/svt/ejp?a8mat=4BEMLT+77L0J6+CO4+15ORS2";
const A8_PIXEL = "https://www12.a8.net/0.gif?a8mat=4BEMLT+77L0J6+CO4+15ORS2";
const ONAMAE_HREF = "https://px.a8.net/svt/ejp?a8mat=4BEMLT+6Z8Y2A+50+2HE8HE";
const ONAMAE_PIXEL = "https://www19.a8.net/0.gif?a8mat=4BEMLT+6Z8Y2A+50+2HE8HE";
const NOTICE = "本ページには広告・紹介リンクが含まれており、当サイトが紹介報酬を受け取る場合があります。掲載情報は各社の公式情報をもとに作成していますが、最新の料金・サービス内容は各公式サイトでご確認ください。";

function anchors(html) {
  return [...html.matchAll(/<a href="([^"]+)"[^>]*data-link="([^"]+)"[^>]*data-link-type="([a-z]+)"[^>]*>/g)]
    .map(match => ({ tag: match[0], href: match[1].replace(/&amp;/g, "&"), key: match[2], type: match[3], rel: (match[0].match(/rel="([^"]*)"/) || [])[1] }));
}
const idx = text => page.indexOf(text);

test("ページの本文は、データ（data/server-guide.json）から作った内容と一致している（直したら npm run build:server-guide）", () => {
  assert.equal(page, guide.build({ write: false }), "server-domain-guide.html is out of date");
});

test("構成：冒頭の2つの導線 → 目的別おすすめ → サーバー比較表 → ドメイン比較 の順で、詳しい補足カードは後半にある", () => {
  const order = ['id="sg-hero-title"', 'id="sg-pick"', 'id="sg-server-compare"', 'id="sg-domain-compare"', 'id="sg-support"', 'id="sg-detail"', 'id="sg-faq"', 'id="sg-pr"'].map(idx);
  assert.ok(order.every(position => position > 0), "all sections exist");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "sections are in the intended order");
  assert.match(page, /<h1\b[^>]*id="sg-hero-title"/);
});

test("冒頭の導線：「レンタルサーバーを比較する」「ドメインを比較する」が、それぞれの比較セクションへのページ内リンクになっている", () => {
  const nav = page.match(/<nav class="sg-jump"[\s\S]*?<\/nav>/)[0];
  assert.match(nav, /<a class="sg-jump-card sg-jump-card--server" href="#sg-server-compare">[\s\S]*?レンタルサーバーを比較する/);
  assert.match(nav, /<a class="sg-jump-card sg-jump-card--domain" href="#sg-domain-compare">[\s\S]*?ドメインを比較する/);
  assert.match(page, /<section[^>]*id="sg-server-compare"/);
  assert.match(page, /<section[^>]*id="sg-domain-compare"/);
  const css = read("assets/css/server-guide.css");
  assert.match(css, /html\s*\{\s*scroll-behavior:\s*smooth;/, "smooth scrolling");
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*html\s*\{\s*scroll-behavior:\s*auto/, "respects reduced motion");
  assert.match(css, /#sg-server-compare[\s\S]*?scroll-margin-top/, "targets are not hidden behind the fixed header");
});

test("冒頭の2つのカード：イラスト付きの軽やかなデザインで、カード全体が1つのリンク。色が違い、ホバーで自然に変化し、PRは付かない", () => {
  const nav = page.match(/<nav class="sg-jump"[\s\S]*?<\/nav>/)[0];
  const cards = [...nav.matchAll(/<a class="sg-jump-card[^"]*" href="(#[^"]+)">([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length, 2, "two cards");
  for (const [, , inner] of cards) {
    assert.match(inner, /<span class="sg-jump-art"><svg[^>]*aria-hidden="true"/, "an illustration, hidden from screen readers");
    assert.ok(!/<a /.test(inner), "no nested links: the whole card is one link");
    assert.ok(!/sg-pr-mark|PR/.test(inner), "no PR label on the in-page navigation");
    assert.match(inner, /sg-jump-eyebrow/);
  }
  assert.notEqual(cards[0][2].match(/<svg[\s\S]*?<\/svg>/)[0], cards[1][2].match(/<svg[\s\S]*?<\/svg>/)[0], "different illustrations");
  const css = read("assets/css/server-guide.css");
  assert.match(css, /\.sg-jump-card--domain\s*\{[^}]*--tint:[^}]*--edge:/, "the domain card has its own colour");
  assert.match(css, /\.sg-jump-card\s*\{[^}]*linear-gradient\(150deg, #ffffff/, "a white-based, light background (not a solid dark fill)");
  assert.ok(!/sg-jump-card\s*\{[^}]*background:\s*linear-gradient\(135deg, var\(--green-900\)/.test(css), "no heavy dark-green fill");
  assert.match(css, /\.sg-jump-card:hover,\s*\.sg-jump-card:focus-visible\s*\{[^}]*translateY\(-4px\)/, "hover/focus lift");
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.sg-jump-card/, "motion is switched off for users who prefer less motion");
  assert.match(css, /@media \(max-width: 640px\)\s*\{[\s\S]*?\.sg-jump \{\s*grid-template-columns: 1fr;/, "cards stack on phones");
  assert.match(css, /min-height: 96px/, "large tap target on phones");
});

test("PR表示の整理：右上のPRは維持。広告の紹介リンクにだけ「PR」の印が付き、公式の通常リンクには付かない。公式サイトと誤解されにくい文言", () => {
  const all = [...page.matchAll(/<a href="[^"]+"[^>]*data-link="[^"]+"[^>]*data-link-type="([a-z]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.ok(all.length >= 11);
  for (const [, type, inner] of all) {
    if (type === "referral") {
      assert.match(inner, /sg-pr-mark">PR</, "an ad link carries PR");
      assert.ok(!/公式/.test(inner), "an ad link is not labelled as the official site");
    } else {
      assert.ok(!/sg-pr-mark|PR/.test(inner), "a normal official link has no PR mark");
    }
  }
  assert.equal(page.match(/<a class="sg-pr-corner"[^>]*>PR<\/a>/).length, 1);
  assert.match(page, /<th scope="col">リンク<\/th>/);
  assert.match(page, /sg-notice-text/, "the short bottom notice stays");
});

test("目的別おすすめ：4つをコンパクトに並べ、載せる情報は「目的・サービス名とプラン名・月額換算」だけ（リンクや説明文を入れない）", () => {
  const section = page.match(/<section[^>]*id="sg-pick"[\s\S]*?<\/section>/)[0];
  assert.equal((section.match(/<li class="sg-tile/g) || []).length, 4);
  assert.ok(!/<a /.test(section), "no links inside the compact picks");
  for (const plan of data.servers) {
    assert.ok(section.includes(plan.purpose), plan.purpose);
    assert.ok(section.includes(plan.company) && section.includes(plan.plan));
    assert.ok(section.includes(`<span class="sg-num">${plan.monthly12.toLocaleString("ja-JP")}</span>`));
  }
  assert.ok(!/特徴|注意|キャンペーン/.test(section.replace(/<[^>]+>/g, "")), "no feature/caution text in the compact picks");
});

test("サーバー比較表：月額換算・年間料金・WordPress・バックアップ・サポート・公式サイトのリンクが、4プラン分ある", () => {
  const section = page.match(/<section[^>]*id="sg-server-compare"[\s\S]*?<\/section>/)[0];
  for (const heading of ["月額換算", "年間料金", "WordPress", "バックアップ", "サポート体制", "公式サイト"]) assert.ok(section.includes(heading), heading);
  assert.equal((section.match(/<tbody>[\s\S]*<\/tbody>/)[0].match(/<tr/g) || []).length, 4);
  assert.equal((section.match(/data-link="/g) || []).length, 4, "one official-site link per plan");
  for (const plan of data.servers) {
    assert.ok(section.includes(`<span class="sg-num">${plan.total12.toLocaleString("ja-JP")}</span>`), plan.id + " annual price");
    assert.ok(section.includes(plan.backup) && section.includes(plan.support));
  }
  // 比較基準の統一：12か月契約・税込・通常料金。エックスサーバーのキャンペーン価格は注記として載せる
  assert.match(section, /12か月契約・税込/);
  assert.match(section, /キャンペーン中 990円/);
  assert.match(section, /sg-table-wrap" tabindex="0" role="region"/, "keyboard-scrollable on small screens");
});

test("紹介リンク：さくら（取次店URL）と XServerドメイン（A8）は、指定どおりのURLで、sponsored・nofollowが付く", () => {
  const list = anchors(page);
  const sakura = list.filter(item => item.key === "sakura-rs");
  assert.ok(sakura.length >= 2, "the Sakura link appears in the comparison table and in the detail card");
  for (const item of sakura) {
    assert.equal(item.href, SAKURA_REFERRAL);
    assert.match(item.rel, /\bsponsored\b/);
    assert.match(item.rel, /\bnofollow\b/);
    assert.equal(item.type, "referral");
  }
  const a8 = list.filter(item => item.key === "xserver-domain");
  assert.equal(a8.length, 1);
  assert.equal(a8[0].href, A8_HREF);
  assert.match(a8[0].rel, /\bnofollow\b/);
  assert.ok(page.includes(`<img border="0" width="1" height="1" src="${A8_PIXEL}" alt="">`), "the A8 tracking pixel is included as provided");
  assert.equal((page.match(/www12\.a8\.net\/0\.gif/g) || []).length, 1, "pixel once");
});

test("紹介リンク：お名前.com（A8）は、正式な広告コードのURL・計測画像のまま、sponsored・nofollowが付く", () => {
  const onamae = anchors(page).filter(item => item.key === "onamae");
  assert.equal(onamae.length, 1);
  assert.equal(onamae[0].href, ONAMAE_HREF);
  assert.equal(onamae[0].type, "referral");
  assert.match(onamae[0].rel, /\bnofollow\b/);
  assert.match(onamae[0].rel, /\bsponsored\b/);
  assert.ok(page.includes(`<img border="0" width="1" height="1" src="${ONAMAE_PIXEL}" alt="">`), "the Onamae tracking pixel is included as provided");
  assert.equal((page.match(/www19\.a8\.net\/0\.gif/g) || []).length, 1, "pixel once");
});

test("紹介リンク：埼家連専用の uid 付きURLを使っていない", () => {
  assert.ok(!/uid=/i.test(page), "no uid parameter anywhere in the page");
  assert.ok(!/uid=/i.test(read("data/server-guide.json")));
  assert.ok(!/saikaren|埼家連/.test(page));
});

test("紹介リンクがない会社（ロリポップ・エックスサーバー・さくらのドメイン）は、公式サイトへの通常リンク", () => {
  const expected = { lolipop: "https://lolipop.jp/", xserver: "https://www.xserver.ne.jp/", "sakura-domain": "https://domain.sakura.ad.jp/" };
  const list = anchors(page);
  for (const [key, url] of Object.entries(expected)) {
    const items = list.filter(item => item.key === key);
    assert.ok(items.length >= 1, key + " is linked");
    for (const item of items) {
      assert.equal(item.href, url);
      assert.equal(item.type, "official");
      assert.ok(!/sponsored|nofollow/.test(item.rel), key + " is a normal link, not an ad");
    }
  }
});

test("後日、紹介リンクに変えられる：データで approved＋referral にするだけで、PRの印・sponsored・nofollow が付く（逆も同様）", () => {
  const changed = JSON.parse(JSON.stringify(data));
  changed.links.lolipop.referral = "https://example.com/referral?x=1";
  changed.links.lolipop.status = "approved";
  const html = guide.buildMain(changed);
  const lolipop = anchors(html).filter(item => item.key === "lolipop");
  assert.equal(lolipop[0].href, "https://example.com/referral?x=1");
  assert.match(lolipop[0].rel, /sponsored nofollow/);
  assert.match(html, /<span class="sg-pr-mark">PR<\/span>/);
  // 審査中・未登録のままなら、referral の値があっても使わない
  changed.links.lolipop.status = "pending";
  assert.equal(anchors(guide.buildMain(changed)).find(item => item.key === "lolipop").href, "https://lolipop.jp/");
  // 提携を外した場合も、公式リンクに戻せる
  const reverted = JSON.parse(JSON.stringify(data));
  reverted.links.onamae.status = "none";
  const back = guide.buildMain(reverted);
  assert.equal(anchors(back).find(item => item.key === "onamae").href, "https://www.onamae.com/");
  assert.ok(!back.includes("www19.a8.net"), "no tracking pixel for a plain official link");
});

test("PR表記：ページ右上に小さく「PR」だけを表示し（最初の紹介リンクより前）、紹介リンクの横にも「PR」の印が付く", () => {
  const corner = page.match(/<a class="sg-pr-corner"[^>]*>([^<]*)<\/a>/);
  assert.ok(corner, "the PR label exists");
  assert.equal(corner[1], "PR");
  assert.ok(idx('class="sg-pr-corner"') > 0 && idx('class="sg-pr-corner"') < idx('data-link-type="referral"'), "before the first referral link");
  const referrals = anchors(page).filter(item => item.type === "referral");
  for (const item of referrals) {
    const html = page.slice(page.indexOf(item.tag), page.indexOf("</a>", page.indexOf(item.tag)));
    assert.match(html, /sg-pr-mark">PR</, "every referral link carries a PR mark");
  }
  const css = read("assets/css/server-guide.css");
  assert.match(css, /\.sg-pr-corner\s*\{[^}]*position:\s*absolute[^}]*top:\s*0[^}]*right:/, "top right");
  assert.match(css, /\.sg-pr-corner\s*\{[^}]*background:\s*#6f7a75/, "dark enough to read");
});

test("広告の注意書き：下部に指定の1文だけを控えめに掲載し、大きな説明枠・企業名の列挙・紹介制度名・報酬の仕組みの説明はない", () => {
  assert.equal(guide.NOTICE, NOTICE);
  const section = page.match(/<section class="sg-notice"[\s\S]*?<\/section>/)[0];
  assert.equal(section.replace(/<[^>]+>/g, "").replace(/\s+/g, ""), NOTICE.replace(/\s+/g, ""), "the notice is exactly the specified sentences");
  assert.ok(!/sg-pr-box|sg-pr-list|sg-pr-section|sg-pr-line|sg-pr-banner/.test(page), "the large disclosure box is gone");
  const visible = page.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  for (const word of ["取次店", "A8.net", "紹介制度", "報酬の仕組み", "広告・紹介報酬について", "お名前.com、"]) assert.ok(!visible.includes(word), word + " is not shown");
  assert.equal((visible.match(/紹介報酬/g) || []).length, 1, "the reward is mentioned only in the one notice sentence");
});

test("確認日は残し、目立ちすぎない小さな表示にしている", () => {
  assert.match(page, /<p class="sg-hero-note">料金は税込・2026年10月22日確認<\/p>/);
  const css = read("assets/css/server-guide.css");
  assert.match(css, /\.sg-hero-note\s*\{[^}]*font-size:\s*0\.78rem/);
  assert.equal((page.match(/2026年10月22日/g) || []).length >= 1, true);
});

test("料金の整合性：12か月分の合計＝月額×12（キャンペーン価格も）。出典の公式ページが載っている", () => {
  for (const plan of data.servers) {
    assert.equal(plan.total12, plan.monthly12 * 12, plan.id);
    if (plan.campaign) assert.equal(plan.campaign.total12, plan.campaign.monthly12 * 12, plan.id + " campaign");
  }
  const byId = Object.fromEntries(data.servers.map(plan => [plan.id, plan]));
  assert.equal(byId["sakura-standard"].total12, 6600, "official: 6,600円 / 12 months");
  assert.equal(byId["lolipop-light"].monthly12, 539);
  assert.equal(byId["lolipop-highspeed"].monthly12, 1045);
  assert.equal(byId["xserver-standard"].monthly12, 1100);
  assert.equal(byId["xserver-standard"].campaign.monthly12, 990);
  for (const url of Object.values(data.sources).flat()) assert.ok(page.includes(url.replace(/^https:\/\//, "")), "source listed: " + url);
});

test("ドメイン比較：.com の初年度と更新料金を、表で並べている（3社とも）。更新料金の改定予定や条件は注記にある", () => {
  const section = page.match(/<section[^>]*id="sg-domain-compare"[\s\S]*?<\/section>/)[0];
  assert.equal(data.domains.length, 3);
  assert.match(section, /初年度<small>（\.com の取得）/);
  assert.match(section, /2年目以降<small>（\.com の更新・1年）/);
  for (const domain of data.domains) {
    assert.ok(section.includes(domain.company), domain.company);
    assert.ok(section.includes(domain.first.replace("円", "").replace("〜", "")) && section.includes(domain.renew.replace("円", "").replace("〜", "")));
  }
  assert.match(section, /2026年11月9日から1,750円に改定予定/);
  assert.match(section, /サービス維持調整費/);
  assert.equal((section.match(/data-link="/g) || []).length, 3, "one official-site link per company");
});

test("方針：お客様ご自身の名義で契約し、福祉ITパートナーは設定を支援すると明記している。断定を避けている", () => {
  assert.match(page, /お客様の名義でお申込み/);
  assert.match(page, /契約者は、お客様ご自身/);
  assert.match(page, /公式サイトでご確認ください/);
  assert.ok(!/必ず(安く|お得)|絶対に|最安確定/.test(page));
});

test("情報の重複を減らしている：詳しい補足カードに、比較表と同じ項目（月額・年間料金・WordPress・バックアップ・サポート）を繰り返さない", () => {
  const detail = page.match(/<section[^>]*id="sg-detail"[\s\S]*?<\/section>/)[0];
  assert.equal((detail.match(/<article class="sg-card"/g) || []).length, 4);
  const text = detail.replace(/<[^>]+>/g, " ");
  assert.ok(!/月額換算|年間料金|12か月で/.test(text));
  assert.ok(!/<dl|sg-spec|sg-price/.test(detail));
});

test("SEO：タイトル・説明・canonical・OG・FAQ構造化データがあり、サイトマップ・フッター・関連ページから辿れる", () => {
  assert.match(page, /<title>レンタルサーバー・ドメイン比較＆契約サポート｜福祉ITパートナー<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{60,}"/);
  assert.match(page, /<link rel="canonical" href="https:\/\/fukushi-it-partner\.com\/server-domain-guide\.html">/);
  assert.match(page, /<meta property="og:url" content="https:\/\/fukushi-it-partner\.com\/server-domain-guide\.html">/);
  assert.match(page, /assets\/js\/ga4\.js/, "GA4 is loaded like the other pages");
  assert.ok(!/noindex/.test(page));
  const ld = JSON.parse(page.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/)[1]);
  assert.equal(ld["@type"], "FAQPage");
  assert.equal(ld.mainEntity.length, guide.FAQ.length);
  assert.equal((page.match(/<h1\b/g) || []).length, 1, "exactly one h1");
  assert.ok(read("sitemap.xml").includes("<loc>https://fukushi-it-partner.com/server-domain-guide.html</loc>"));
  assert.ok(read("scripts/generate-blog.js").includes('"https://fukushi-it-partner.com/server-domain-guide.html"'), "the sitemap generator keeps the page");
  for (const file of ["index.html", "homepage-plan.html", "homepage-cost-reduction.html", "blog.html", "profile.html"]) {
    assert.match(read(file), /<li><a href="server-domain-guide\.html">サーバー・ドメイン比較<\/a><\/li>/, file + " footer link");
  }
  assert.ok((read("scripts/generate-blog.js").match(/server-domain-guide\.html">サーバー・ドメイン比較/g) || []).length === 2, "both blog templates");
  assert.match(read("scripts/generate-course.js"), /server-domain-guide\.html">サーバー・ドメイン比較/);
  assert.match(read("homepage-plan.html"), /<a href="server-domain-guide\.html">比較ページ<\/a>/);
  assert.match(read("homepage-cost-reduction.html"), /href="server-domain-guide\.html"/);
});

test("関連ページとの相互リンク：料金プラン・制作の流れ（公開・納品）・維持費の見直しから比較ページへ。比較ページからも関連ページへ戻れる", () => {
  const plan = read("homepage-plan.html");
  assert.match(plan, /サーバー契約、ドメイン取得、公開作業は基本料金に含まれておりません。[^<]*<a href="server-domain-guide\.html">比較ページ<\/a>/);
  const flow = read("flow.html");
  const step = flow.match(/<h3>公開・納品<\/h3>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)[0];
  assert.equal((step.match(/href="server-domain-guide\.html"/g) || []).length, 2, "desktop text and short phone text, inside the 公開・納品 step only");
  assert.equal((flow.match(/href="server-domain-guide\.html"/g) || []).length, 3, "2 in the step + 1 footer link");
  const cost = read("homepage-cost-reduction.html");
  assert.match(cost, /公開環境の実費（選び方は<a href="server-domain-guide\.html" class="cs-inline-link">比較ページ<\/a>）/);
  assert.ok((cost.match(/href="server-domain-guide\.html"/g) || []).length <= 3, "not too many links");
  assert.match(page, /あわせてご覧ください：<a href="flow\.html">[^<]*<\/a>／<a href="homepage-cost-reduction\.html">[^<]*<\/a>/);
  // 上部ナビには足さない
  for (const file of ["index.html", "flow.html", "homepage-plan.html", "homepage-cost-reduction.html"]) {
    const header = read(file).match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
    assert.ok(!header.includes("server-domain-guide.html"), file + " header has no new link");
  }
});

test("プライバシーポリシーに、アフィリエイト（広告）についての説明がある", () => {
  const privacy = read("privacy.html");
  assert.match(privacy, /アフィリエイト（広告）について/);
  assert.match(privacy, /紹介報酬/);
});

test("アクセシビリティ・表示：表は横スクロール領域（キーボードで操作可）、リンクは新しいタブで noopener、1×1の計測画像以外は alt が空でない", () => {
  assert.match(page, /class="sg-table-wrap" tabindex="0" role="region"/);
  for (const item of anchors(page)) assert.match(item.tag, /target="_blank"/), assert.match(item.rel, /noopener/);
  for (const match of page.matchAll(/<img\b[^>]*>/g)) {
    if (/width="1" height="1"/.test(match[0])) continue;
    assert.match(match[0], /alt="[^"]+"/);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "assets", "css", "server-guide.css")));
});
