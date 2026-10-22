"use strict";

// 「レンタルサーバー・ドメイン比較＆契約サポート」ページ（server-domain-guide.html）のテスト：
// データから作った本文と一致している／紹介リンクの扱い／PR表記／料金の整合性／SEO・導線
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

function anchors(html) {
  return [...html.matchAll(/<a href="([^"]+)"[^>]*data-link="([^"]+)"[^>]*data-link-type="([a-z]+)"[^>]*>/g)]
    .map(match => ({ tag: match[0], href: match[1].replace(/&amp;/g, "&"), key: match[2], type: match[3], rel: (match[0].match(/rel="([^"]*)"/) || [])[1] }));
}

test("ページの本文は、データ（data/server-guide.json）から作った内容と一致している（直したら npm run build:server-guide）", () => {
  assert.equal(page, guide.build({ write: false }), "server-domain-guide.html is out of date");
});

test("紹介リンク：さくら（取次店URL）と XServerドメイン（A8）は、指定どおりのURLで、sponsored・nofollowが付く", () => {
  const list = anchors(page);
  const sakura = list.filter(item => item.key === "sakura-rs");
  assert.ok(sakura.length >= 2, "the Sakura link appears in the pick card and the plan card");
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

test("紹介リンク：埼家連専用の uid 付きURLを使っていない", () => {
  assert.ok(!/uid=/i.test(page), "no uid parameter anywhere in the page");
  assert.ok(!/uid=/i.test(read("data/server-guide.json")));
  assert.ok(!/saikaren|埼家連/.test(page));
});

test("紹介リンクがない会社（ロリポップ・エックスサーバー・お名前.com・さくらのドメイン）は、公式サイトへの通常リンク", () => {
  const expected = { lolipop: "https://lolipop.jp/", xserver: "https://www.xserver.ne.jp/", onamae: "https://www.onamae.com/", "sakura-domain": "https://domain.sakura.ad.jp/" };
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

test("後日、紹介リンクに変えられる：データで approved＋referral にするだけで、PR表記・sponsored・nofollow が付く（逆も同様）", () => {
  const changed = JSON.parse(JSON.stringify(data));
  changed.links.onamae.referral = "https://example.com/referral?x=1";
  changed.links.onamae.status = "approved";
  const html = guide.buildMain(changed);
  const onamae = anchors(html).filter(item => item.key === "onamae");
  assert.equal(onamae[0].href, "https://example.com/referral?x=1");
  assert.match(onamae[0].rel, /sponsored nofollow/);
  assert.match(html, /お名前\.com<\/strong>/, "the PR disclosure lists the newly approved company");
  // 審査中・未登録のままなら、referral の値があっても使わない
  changed.links.onamae.status = "pending";
  assert.equal(anchors(guide.buildMain(changed)).find(item => item.key === "onamae").href, "https://www.onamae.com/");
});

test("PR表記：ページ上部に広告（PR）の表示があり、最初の紹介リンクより前にある。紹介報酬の説明もある", () => {
  const firstReferral = page.indexOf('data-link-type="referral"');
  const banner = page.indexOf("このページには広告（PR）を含みます");
  assert.ok(banner > 0 && banner < firstReferral, "the PR notice comes before the first referral link");
  assert.match(page, /紹介報酬を受け取る場合があります/);
  assert.match(page, /お客様のお支払い額が[^。]*高くなることはありません/);
  assert.match(page, /sg-pr-mark">PR</);
  assert.match(page, /id="sg-pr"/);
});

test("料金の整合性：12か月分の合計＝月額×12（キャンペーン価格も）。出典の確認日が載っている", () => {
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
  assert.match(page, /2026年10月22日/);
  assert.match(page, /税込/);
  for (const url of Object.values(data.sources).flat()) assert.ok(page.includes(url.replace(/^https:\/\//, "")), "source listed: " + url);
});

test("ドメイン：初年度の料金と更新料金が分けて載っている（3社とも）", () => {
  assert.equal(data.domains.length, 3);
  for (const domain of data.domains) {
    assert.ok(domain.first && domain.renew && domain.first !== domain.renew || domain.company === "さくらのドメイン", domain.company);
    assert.match(page, new RegExp(domain.company.replace(/\./g, "\\.")));
  }
  assert.match(page, /初年度（取得）/);
  assert.match(page, /2年目以降（更新・1年あたり）/);
  assert.match(page, /2026年11月9日から1,750円に改定予定/, "the announced renewal price change is disclosed");
});

test("方針：お客様ご自身の名義で契約し、福祉ITパートナーは設定を支援すると明記している。未確認の事項を断定していない", () => {
  assert.match(page, /お客様の名義でお申込み/);
  assert.match(page, /契約者は、お客様ご自身/);
  assert.match(page, /公式ページでご確認ください/);
  assert.ok(!/必ず(安く|お得)|絶対に|最安確定/.test(page));
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
  const h1s = page.match(/<h1\b/g) || [];
  assert.equal(h1s.length, 1, "exactly one h1");
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

test("プライバシーポリシーに、アフィリエイト（広告）についての説明がある", () => {
  const privacy = read("privacy.html");
  assert.match(privacy, /アフィリエイト（広告）について/);
  assert.match(privacy, /紹介報酬/);
});

test("アクセシビリティ・表示：表は横スクロール領域（キーボードで操作可）、リンクは新しいタブで noopener、1×1の計測画像以外は alt が空でない", () => {
  assert.match(page, /class="sg-table-wrap[^"]*" tabindex="0" role="region"/);
  for (const item of anchors(page)) assert.match(item.tag, /target="_blank"/), assert.match(item.rel, /noopener/);
  for (const match of page.matchAll(/<img\b[^>]*>/g)) {
    if (/width="1" height="1"/.test(match[0])) continue;
    assert.match(match[0], /alt="[^"]+"/);
  }
  assert.ok(fs.existsSync(path.join(ROOT, "assets", "css", "server-guide.css")));
});
