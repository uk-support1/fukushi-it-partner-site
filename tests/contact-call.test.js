"use strict";
// 問い合わせページ（contact.html）：電話を先頭に大きく表示し、その下にフォームを置く設計のテスト。
// 「無料相談」ボタン（#google-form-embed）は、この電話のカードの位置に移動する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const textOf = html => html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, "").replace(/<br[^>]*>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? files(full) : /\.(html|css|js)$/.test(entry.name) ? [full] : [];
});

test("問い合わせページ：電話番号が先頭に大きく表示され、その下に「フォームから相談する」がある", () => {
  const contact = read("contact.html");
  const section = contact.match(/<section class="contact-form-section" id="google-form-embed">([\s\S]*?)<\/section>/)[1];
  const call = section.match(/<div class="contact-call reveal">[\s\S]*?<\/div>/)[0];
  // 並び順：電話のカード → 「電話がむずかしいときは」の区切り → 「フォームから相談する」→ フォーム
  const order = ['class="contact-call reveal"', 'class="contact-or"', "フォームから相談する", 'id="contact-form"'].map(marker => section.indexOf(marker));
  assert.ok(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1])), "order: " + order);
  assert.match(call, /<a href="tel:07091272425" class="contact-call-number js-phone-link" aria-label="070-9127-2425 に電話をかける">/);
  assert.equal(textOf(call.match(/<a [^>]*contact-call-number[\s\S]*?<\/a>/)[0]), "070-9127-2425");
  assert.equal(textOf(call.match(/contact-call-tag">([\s\S]*?)<\/span>/)[1]), "お電話でのご相談");
  assert.equal(textOf(call.match(/<h2[\s\S]*?<\/h2>/)[0]), "お気軽に、お電話をどうぞ");
  // 電話したくなる、気軽な書き方（相談だけでもよい）
  assert.ok(textOf(call).includes("ご相談だけでも、まったく問題ありません。「こんなことで電話していいのかな？」という内容でも、大丈夫です。"));
  assert.ok(!/いちばん早い|一番早い/.test(textOf(call)), "no 'fastest' claim");
  assert.ok(textOf(call).includes("受付時間：8:00～21:00"));
  assert.equal(textOf(section.match(/<p class="contact-or"[\s\S]*?<\/p>/)[0]), "電話がむずかしいときは、フォームからどうぞ");
  assert.equal(textOf(section.match(/<h2 class="section-title">[\s\S]*?<\/h2>/)[0]), "フォームから相談する");
  // 電話の絵は、読み上げの邪魔にならない（装飾）
  assert.match(call, /<svg [^>]*aria-hidden="true"/);
  // 目立つが、大きすぎない（PCは1.75rem＝約28px以下、スマホでも1.4rem以上）。幅の狭い画面でも、はみ出さない
  const css = read("assets/css/style.css");
  const number = css.match(/\.contact-call-number \{[^}]*\}/)[0];
  assert.match(number, /font-size: clamp\(1\.4rem, [^)]*, 1\.75rem\);/);
  // 明るく、やさしい色：カードはクリーム〜うすいオレンジ、番号のボタンはオレンジ。暗い緑のグラデーションは使わない
  const card = css.match(/\.contact-call \{[^}]*\}/)[0];
  assert.match(card, /background: linear-gradient\(135deg, #fffaf2, #ffeedb\);/);
  assert.ok(!/green-900|green-700/.test(card.match(/background:[^;]*;/)[0]), "the card is not dark green");
  assert.match(number, /background: var\(--orange-500\);/);
  assert.match(number, /color: var\(--white\);/);
  assert.match(number, /max-width: 100%;/);
  assert.match(css.match(/\.contact-call \{[^}]*\}/)[0], /max-width: 680px;/);
  assert.match(css, /\.contact-form-section \{[^}]*scroll-margin-top:/);
});

test("担当者直通と、電話がつながったときの案内（「福祉ITパートナーへの問い合わせです」）は、サイトのどこにも残っていない。電話番号は代表電話だけ", () => {
  let checked = 0;
  for (const full of files(ROOT)) {
    const text = fs.readFileSync(full, "utf8");
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (rel.startsWith("tests/")) continue;
    assert.ok(!/担当者直通|09094581755|090-9458-1755|福祉ITパートナーへの問い合わせです|contact-other-phones|contact-other-note/.test(text), rel + " has no leftover direct line / old note");
    checked++;
  }
  assert.ok(checked > 100, "checked many files: " + checked);
  // 実際の電話リンクは代表電話の1つだけ（recovery-template-*.html は、番号がダミーのひな型）
  const tels = new Set();
  for (const full of files(ROOT)) {
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    if (!rel.endsWith(".html") || rel.startsWith("recovery-template-")) continue;
    for (const match of fs.readFileSync(full, "utf8").matchAll(/href="tel:(\d+)"/g)) tels.add(match[1]);
  }
  assert.deepEqual([...tels], ["07091272425"]);
});

test("メールの欄は残り、電話のタップはGA4で計測される", () => {
  const contact = read("contact.html");
  const other = contact.match(/<div class="contact-other reveal">[\s\S]*?<\/div>\s*<\/div>/)[0];
  assert.equal(textOf(other.match(/<h2[\s\S]*?<\/h2>/)[0]), "メールでのお問い合わせ");
  assert.match(other, /<a href="mailto:fukushi\.it\.partner@gmail\.com" class="contact-other-item">/);
  assert.ok(!/tel:/.test(other), "no phone in the email block");
  const js = read("assets/js/main.js");
  assert.match(js, /querySelectorAll\("\.js-phone-link"\)[\s\S]*sendGaEvent\("phone_click"\)/);
  // 既存の計測（フォームへの「無料相談」ボタン）は、そのまま
  assert.match(js, /querySelectorAll\("\.js-consult-link"\)[\s\S]*sendGaEvent\("free_consultation_click"\)/);
});

test("フォームの「ご希望のサービス」に、PHP・Ameba Ownd・維持費の見直しの選択肢がある（再スタートは入れない）", () => {
  const select = read("contact.html").match(/<select id="cf-service" name="ご希望のサービス" required>([\s\S]*?)<\/select>/)[1];
  const options = [...select.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(match => { assert.equal(match[1] === "" ? "選択してください" : match[1], match[2]); return match[2]; });
  assert.deepEqual(options, ["選択してください", "ホームページ制作", "ホームページ更新", "SEO・集客支援", "AI・IT活用", "補助金活用",
    "PHP・WordPressの更新・乗り換え", "Ameba Ownd終了の移行（引き継ぎ）", "ホームページ維持費の見直し", "その他"]);
  assert.ok(options[options.length - 1] === "その他", "'other' stays last");
});
