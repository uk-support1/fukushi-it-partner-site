"use strict";
// 判定のきまり（04-listing-copy.md §7）が、report.js の judge() と一致することの確認。
//   node --test marketing/coconala/templates/report/report.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { judge, buildModel, renderHtml, renderMarkdown } = require("./report.js");

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

// ---- 文面・構成の確認（見本画像の検証で見つかった誤りが、戻らないようにする） ------------------------------
test("修正版そのもの（8.4.27）は「対応済み」で、「対象外」とは書かない", () => {
  const m = buildModel({ ...base, php_version: "8.4.27", report_date: "2026年10月24日" });
  assert.equal(m.status, "ok");
  const text = renderMarkdown(m);
  assert.match(text, /対応済み/);
  assert.ok(!/お客様のサイトは[^。]*対象外/.test(text));
});
test("7.4.33は「サポート終了の版」。『8.1以上に』とは案内しない", () => {
  const m = buildModel({ ...base, php_version: "7.4.33" });
  assert.equal(m.status, "eol");
  const text = renderMarkdown(m);
  assert.ok(!/8\.1以上/.test(text));
  assert.match(text, /8\.3系以上/);
});
test("CVE番号は、プレースホルダーではなく、正しい番号", () => {
  const text = renderMarkdown(buildModel({ ...base, php_version: "8.3.30" }));
  assert.match(text, /CVE-2026-109618/);
  assert.match(text, /CVE-2026-109619/);
  assert.ok(!/CVE-2024|\?{3}/.test(text));
});
test("「診断レポート」「緊急度」「安全なバージョン」を使っていない", () => {
  const m = buildModel({ ...base, php_version: "8.4.27" });
  const text = renderMarkdown(m) + renderHtml(m);
  assert.ok(!/診断レポート|診断日|緊急度|安全なバージョン|期待できる効果|再診断/.test(text));
});
test("判定の目安は5つ（◎△！？－）で、今回の判定が分かる", () => {
  const m = buildModel({ ...base, php_version: "8.3.30" });
  assert.deepEqual(m.legend.map(l => l.mark), ["◎", "△", "！", "？", "－"]);
  assert.equal(m.legend.filter(l => l.mine).length, 1);
  assert.equal(m.legend.find(l => l.mine).key, "update");
});
test("公開情報だけが根拠のときは、参考の判定である旨が入る", () => {
  const m = buildModel({ ...base, php_version: "8.3.30", evidence_kind: "public" });
  assert.match(m.conclusion, /公開されている情報では/);
  assert.match(m.conclusion, /参考/);
});
test("画面が根拠のときは、「いただいた画面では」と書く", () => {
  const m = buildModel({ ...base, php_version: "8.3.30", evidence_kind: "screen" });
  assert.match(m.conclusion, /いただいた画面では/);
});
test("報告書は4ページ構成", () => {
  const html = renderHtml(buildModel({ ...base, php_version: "8.3.30" }));
  assert.equal((html.match(/<section class="page">/g) || []).length, 4);
  assert.match(html, /1 \/ 4/);
  assert.match(html, /4 \/ 4/);
});
