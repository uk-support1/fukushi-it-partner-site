"use strict";
// 特設ページ（公開中）をスマホ幅でスクリーンショットし、動画で使う場所を切り抜く。
//   使い方（リポジトリのルートで）： node marketing/youtube/ameba-ownd-end-short/capture.js
//   必要なもの：playwright と Chromium（環境変数 PLAYWRIGHT_CHROMIUM_PATH で指定できる）。ネットワーク。
const fs = require("fs");
const path = require("path");
function loadPlaywright() {
  for (const c of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(c); } catch (_) {} }
  throw new Error("playwright が見つかりません");
}
const URL = process.env.PAGE_URL || "https://fukushi-it-partner.com/ameba-ownd-end.html";
const OUT = path.join(__dirname, "crops");
// 切り抜く場所（CSSセレクタ）。clip は、要素の左上からの追加の範囲（任意）
const TARGETS = [
  ["hero-title", "#oe-hero-title"],
  ["hero-visual", ".pc-hero-visual"],
  ["hero-note", ".oe-hero-note"],
  ["hero-date", ".oe-hero-date"],
  ["todo-head", "#oe-todo .section-head"],
  ["todo-1", ".oe-todo:nth-of-type(1)"],
  ["todo-2", ".oe-todo:nth-of-type(2)"],
  ["todo-3", ".oe-todo:nth-of-type(3)"],
  ["compare-points", "#oe-compare"],
  // 料金と説明（「限定価格」の見出し行は含めない。動画では「限定」と言わないため）
  ["price-card", ".pc-proposal-card .pc-proposal-price, .pc-proposal-card .pc-proposal-sub", "union"],
  ["proposal-points", ".pc-proposal-points"],
];
(async () => {
  const { chromium } = loadPlaywright();
  const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 3 });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  // 固定のヘッダーが写り込まないようにする
  await page.addStyleTag({ content: "header, .site-header, .pc-header, .sticky, [class*='sticky'] { position: static !important; }" });
  for (const [name, sel, mode] of TARGETS) {
    const loc = page.locator(sel);
    const n = await loc.count();
    if (!n) { console.warn("[警告] 見つからない:", name, sel); continue; }
    const file = path.join(OUT, name + ".png");
    if (mode === "union") {
      // 複数の要素を、まとめて1枚に切り抜く
      const boxes = [];
      for (let i = 0; i < n; i++) { await loc.nth(i).scrollIntoViewIfNeeded(); boxes.push(await loc.nth(i).evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })); }
      const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
      const x2 = Math.max(...boxes.map(b => b.x + b.w)), y2 = Math.max(...boxes.map(b => b.y + b.h));
      await page.screenshot({ path: file, fullPage: true, clip: { x, y, width: x2 - x, height: y2 - y } });
    } else {
      await loc.first().screenshot({ path: file });
    }
    console.log("切り抜き:", path.relative(process.cwd(), file));
  }
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
