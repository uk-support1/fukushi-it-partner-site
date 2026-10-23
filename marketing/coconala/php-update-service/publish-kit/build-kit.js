"use strict";
// 出品画面に貼り付けるテキストを、06-listing-copy.md から取り出して、欄ごとのファイルに書き出す。
//   使い方（リポジトリのルートで）： node marketing/coconala/php-update-service/publish-kit/build-kit.js
//   文章の元は 06-listing-copy.md だけ。直すときは 06 を直して、このスクリプトを実行し直す（貼り付け用が古くならない）。
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const src = fs.readFileSync(path.join(DIR, "..", "06-listing-copy.md"), "utf8");
const count = t => [...t.replace(/\n/g, "")].length;

// コードブロック：1 タイトル／2 キャッチコピー／3 サービス内容／4 購入にあたってのお願い
const blocks = [...src.matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1]);
if (blocks.length < 4) throw new Error("06-listing-copy.md のコードブロックが4つ未満です");

// 有料オプション（§6の表）
const optSec = src.slice(src.indexOf("## 6. 有料オプション"), src.indexOf("## 7."));
const options = optSec.split("\n").filter(l => /^\| .+ \| \+?[\d,]+円 \| .+ \|$/.test(l)).map(l => {
  const [, name, price, desc] = l.match(/^\| (.+?) \| (\+?[\d,]+円) \| (.+) \|$/);
  return { name, price, desc };
});

// FAQ（§8）
const faqSec = src.slice(src.indexOf("## 8."), src.indexOf("## 9."));
const faq = faqSec.split(/\n(?=\*\*Q\.)/).filter(b => b.startsWith("**Q.")).map(b => {
  const m = b.match(/^\*\*(Q\..+?)\*\*\n([\s\S]+)$/);
  return { q: m[1], a: m[2].trim() };
});

const out = {
  "01-タイトル.txt": blocks[0],
  "02-キャッチコピー.txt": blocks[1],
  "03-サービス内容.txt": blocks[2],
  "04-購入にあたってのお願い.txt": blocks[3],
  "05-有料オプション.txt": options.map((o, i) => `【オプション${i + 1}】\n名称：${o.name}\n価格：${o.price}\n説明：${o.desc}`).join("\n\n"),
  "06-よくある質問.txt": faq.map(f => `${f.q}\nA. ${f.a.replace(/^A\.\s*/, "")}`).join("\n\n"),
};
for (const [name, body] of Object.entries(out)) fs.writeFileSync(path.join(DIR, name), body.replace(/\s+$/, "") + "\n", "utf8");

const lines = [
  "貼り付け用テキストの字数（改行を除く）。上限は、出品画面のカウンターで確認してください。",
  `タイトル：${count(blocks[0])}字（目安：25字以内）`,
  `キャッチコピー：${count(blocks[1])}字（目安：30字以内）`,
  `サービス内容：${count(blocks[2])}字`,
  `購入にあたってのお願い：${count(blocks[3])}字（目安：500字以内）`,
  `有料オプション：${options.length}個（最大10個）`,
  `よくある質問：${faq.length}問`,
];
fs.writeFileSync(path.join(DIR, "00-字数.txt"), lines.join("\n") + "\n", "utf8");
console.log(lines.join("\n"));
