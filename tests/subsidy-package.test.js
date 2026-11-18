"use strict";
// 補助金活用支援の「パッケージの具体例」ページ（subsidy-support/*-plan.html）のテスト。
// 料金・補助額・実質負担の計算、税の表記ルール、申請代行と誤解される表現が入らないことを確認する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const BASE = "https://fukushi-it-partner.com/subsidy-support/";

// file, 総額（万円）, ホームページ・Web関連の経費（万円）
const PLANS = [
  ["starter-plan.html", 15, 7.5],
  ["standard-plan.html", 27, 14],
  ["max-plan.html", 75, 40],
];

for (const [file, total, web] of PLANS) {
  const page = read("subsidy-support/" + file);
  const subsidy = Math.min(total * 2 / 3, 50);
  const self = total - subsidy;

  test(file + "：料金・補助額・実質負担が正しく、税の表記ルールを守っている", () => {
    assert.ok(page.includes(">" + total + "<small>万円</small>"), "price in 万円");
    assert.ok(page.includes(">" + self + "<small>万円</small>"), "self pay in 万円");
    assert.ok(!/\d{2,3},000/.test(page), "no long zero-padded yen amounts (shown as 〇万円)");
    assert.ok(page.includes("＋ " + subsidy + "万円"), "subsidy in the cash diagram");
    assert.match(page, /表示価格がお支払いの総額です。消費税はかかりません。/);
    assert.ok(!/税込|税別|税抜/.test(page), "no tax wording on our own price");
    assert.match(page, /採択・交付決定を保証するものではありません/);
  });

  test(file + "：内訳の合計が総額と一致し、Web関連は補助30万円の範囲に収まる", () => {
    const parts = [...page.matchAll(/<span class="seg seg-[a-z]+" style="flex:([\d.]+)">\1万<\/span>/g)].map(m => Number(m[1]));
    assert.ok(parts.length >= 3);
    assert.equal(Math.round(parts.reduce((a, b) => a + b, 0) * 10) / 10, total);
    assert.ok(web * 2 / 3 <= 30, "web-related subsidy stays within 30万円");
  });

  test(file + "：申請はお客様ご自身。代行するとは書かない。ほかのプランへもつながる", () => {
    assert.match(page, /申請書類の作成代行・代理申請は行いません/);
    assert.ok(!/申請(を|の)?代行します|代わりに申請します/.test(page));
    assert.match(page, /費用は別途/);
    assert.match(page, new RegExp('<link rel="canonical" href="' + (BASE + file).replace(/\./g, "\\.") + '">'));
    for (const [other] of PLANS) if (other !== file) assert.ok(page.includes('href="' + other + '" class="spk-plan-card'), other);
  });
}

test("補助金活用支援のトップから3つのパッケージへ案内があり、サイトマップにも載っている", () => {
  const index = read("subsidy-support/index.html");
  for (const [file] of PLANS) {
    assert.ok(index.includes('<a href="' + file + '" class="spk-plan-card'), file);
    assert.ok(read("sitemap.xml").includes("<loc>" + BASE + file + "</loc>"), file);
    assert.ok(read("scripts/generate-blog.js").includes('"' + BASE + file + '"'), file + " stays in the sitemap generator");
  }
});
