"use strict";
// 判定のきまり（04-listing-copy.md §7）が、report.js の judge() と一致することの確認。
//   node --test marketing/coconala/templates/report/report.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { judge, buildModel } = require("./report.js");

const base = { uses_php: true, php_managed_by: "customer", provider_patch_possible: false };
const cases = [
  // [PHPの番号, 追加の入力, 期待する判定]
  ["8.5.12", {}, "ok"], ["8.5.11", {}, "update"], ["8.5.30", {}, "ok"],
  ["8.4.27", {}, "ok"], ["8.4.26", {}, "update"],
  ["8.3.36", {}, "ok"], ["8.3.35", {}, "update"],
  ["8.2.35", {}, "ok"], ["8.2.34", {}, "update"],
  ["8.1.30", {}, "eol"], ["8.0.30", {}, "eol"], ["7.4.33", {}, "eol"], ["5.6.40", {}, "eol"],
  ["8.3.30-1ubuntu1", {}, "update"],                       // 末尾の文字があっても番号を読む
  ["8.3", {}, "check"],                                    // 最後の数字が分からない
  ["", {}, "check"], [null, {}, "check"], ["不明", {}, "check"],
  ["8.6.1", {}, "check"],                                  // 公式の修正版の一覧にない系列は断定しない
  ["8.1.30", { provider_patch_possible: true }, "check"],  // 提供元が番号を変えずに修正している可能性
  ["8.3.30", { provider_patch_possible: true }, "check"],
  ["8.3.30", { php_managed_by: "host" }, "check"],         // サーバー会社が管理：番号が古くても「？」
  ["8.3.36", { php_managed_by: "host" }, "ok"],            // 修正版以上なら、管理者が誰でも「◎」
];
for (const [v, extra, expected] of cases) {
  test(`PHP ${JSON.stringify(v)} ${JSON.stringify(extra)} → ${expected}`, () => {
    assert.equal(judge({ ...base, php_version: v, ...extra }).status, expected);
  });
}
test("PHPを使っていないサイトは「対象外」", () => {
  assert.equal(judge({ ...base, uses_php: false, php_version: "" }).status, "none");
});
test("status を指定すると、判定の提案を上書きできる", () => {
  const m = buildModel({ ...base, php_version: "8.3.30", status: "check", report_date: "2026年10月24日" });
  assert.equal(m.status, "check");
  assert.equal(m.judge.status, "update");
});
test("「更新が必要」のとき、文面に「安全」「保証」の言い切りがない", () => {
  const m = buildModel({ ...base, php_version: "8.3.30", site_url: "https://example.com/" });
  const text = [m.conclusion, ...m.actions, ...m.scope].join("");
  assert.ok(!/安全です。|必ず|保証します|完全に安全/.test(text.replace("「安全です」というお約束ではありません", "")));
});
test("8.2系で修正版以上のときは、サポート終了日を伝える", () => {
  const m = buildModel({ ...base, php_version: "8.2.35" });
  assert.match(m.conclusion, /2026年12月31日/);
});
