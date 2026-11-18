"use strict";
// 補助金活用支援の「パッケージの具体例」ページ（subsidy-support/max-plan.html）のテスト。
// 料金の表記ルール（税込を書かない・消費税はかからない注記）と、申請代行と誤解される表現が入らないことを確認する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const PAGE = "subsidy-support/max-plan.html";
const URL = "https://fukushi-it-partner.com/subsidy-support/max-plan.html";

test("パッケージページ：料金・補助額・実質負担がそろっていて、税の表記ルールを守っている", () => {
  const page = read(PAGE);
  assert.match(page, /750,000<small>円<\/small>/);
  assert.match(page, /250,000<small>円<\/small>/);
  assert.match(page, /表示価格がお支払いの総額です。消費税はかかりません。/);
  assert.ok(!/税込|税別|税抜/.test(page), "no tax wording on our own price");
  assert.match(page, /採択・交付決定を保証するものではありません/);
});

test("パッケージページ：内訳の合計が75万円で、Web関連は補助30万円の範囲に収まる", () => {
  const page = read(PAGE);
  const parts = [...page.matchAll(/<span class="seg seg-[a-z]+" style="flex:(\d+)">\1万<\/span>/g)].map(m => Number(m[1]));
  assert.deepEqual(parts, [30, 25, 10, 10]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 75);
  const web = 30 + 10; // ホームページ＋Googleマップ・Web広告
  assert.ok(web * 2 / 3 <= 30, "web-related subsidy stays within 30万円");
});

test("パッケージページ：申請はお客様ご自身。代行するとは書かない", () => {
  const page = read(PAGE);
  assert.match(page, /申請書類の作成代行・代理申請は行いません/);
  assert.ok(!/申請(を|の)?代行します|代わりに申請します/.test(page));
  assert.match(page, /費用は別途/);
});

test("補助金活用支援のトップからパッケージページへ案内があり、サイトマップにも載っている", () => {
  assert.match(read("subsidy-support/index.html"), /<a href="max-plan\.html" class="spk-teaser/);
  assert.ok(read("sitemap.xml").includes("<loc>" + URL + "</loc>"));
  assert.ok(read("scripts/generate-blog.js").includes('"' + URL + '"'), "the sitemap generator keeps the page");
  assert.match(read(PAGE), new RegExp('<link rel="canonical" href="' + URL.replace(/\./g, "\\.") + '">'));
});
