"use strict";

const BUHIO_IMAGES = [
  { file: "buhio-01-standing.png", purpose: "通常の説明、導入", pose: "内容を案内する" },
  { file: "buhio-02-waving.png", purpose: "あいさつ、やさしい案内", pose: "手を振って案内する" },
  { file: "buhio-03-pointing.png", purpose: "ポイント解説、注目箇所", pose: "ポイントを指し示す" },
  { file: "buhio-04-jumping.png", purpose: "前向きな話題、成功事例、明るい話", pose: "跳び上がって喜ぶ" },
  { file: "buhio-05-surprised.png", purpose: "意外な情報、注意喚起、驚き", pose: "驚きながら注意を促す" },
  { file: "buhio-06-important.png", purpose: "特に重要な注意点、制度変更、必ず見てほしい箇所", pose: "「ここ重要！」の札で大切な点を伝える" }
];
const DIRECTORY = "assets/images/buhio/";
function plain(value, max) {
  return typeof value === "string" && value.trim().length <= max &&
    !/[<>\u0000-\u001f\u007f]/.test(value) ? value.trim() : "";
}
function fallbackImage(text) {
  const rules = [
    [5, /制度変更|報酬改定|法改正|義務化|必ず|重要な注意/],
    [4, /意外|驚き|注意喚起|見落とし|落とし穴|リスク/],
    [3, /成功事例|成功|明るい|前向き|うれしい|改善事例/],
    [2, /ポイント|注目|チェック|手順/],
    [1, /あいさつ|こんにちは|はじめまして|やさしい|初めて/]
  ];
  return BUHIO_IMAGES[(rules.find(([, pattern]) => pattern.test(text)) || [0])[0]];
}
function selectBuhio(article, requested) {
  const text = `${article.title || ""}\n${article.description || ""}\n${article.bodyMarkdown || ""}`;
  const chosen = BUHIO_IMAGES.find(item => item.file === requested?.image) || fallbackImage(text);
  const title = plain(article.title, 140) || "この記事";
  return {
    image: chosen.file,
    alt: plain(requested?.alt, 220) || `${title}について、${chosen.pose}ぶひお`,
    comment: plain(requested?.comment, 180) || "自分の事業所ならどうするか、現場の場面に置き換えて一緒に整理してみよう。"
  };
}
function renderBuhio(article, requested, escapeHtml) {
  const selection = selectBuhio(article, requested);
  return `<aside class="buhio-note" aria-label="ぶひおのひとこと"><img src="../${DIRECTORY}${selection.image}" alt="${escapeHtml(selection.alt)}" width="128" height="128" loading="lazy" decoding="async"><div><strong>ぶひおのひとこと</strong><p>${escapeHtml(selection.comment)}</p></div></aside>`;
}
module.exports = { BUHIO_IMAGES, DIRECTORY, selectBuhio, renderBuhio };
