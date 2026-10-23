"use strict";
// ココナラ商品画像の書き出し
//   使い方（リポジトリのルートで）：
//     node marketing/coconala/images/src/build.js            # プランA（基本2,000円）の全画像 → images/
//     node marketing/coconala/images/src/build.js --plan-b   # プランB（基本3,000円）→ images/plan-b/（価格の入った画像だけ）
//     node marketing/coconala/images/src/build.js 01 04      # 番号を指定して書き出す
//   必要なもの：playwright と Chromium（環境変数 PLAYWRIGHT_CHROMIUM_PATH でパスを指定できます）。
//   フォントは Google Fonts の Noto Sans JP を読み込みます（ネットワークが必要です）。
//   書き出し後、はみ出し・見切れを自動で検査し、問題があれば警告を出します。
const fs = require("fs");
const path = require("path");

function loadPlaywright() {
  const candidates = ["playwright", "/opt/node-tools/node_modules/playwright"];
  for (const c of candidates) {
    try { return require(c); } catch (_) { /* 次の候補へ */ }
  }
  throw new Error("playwright が見つかりません。npm i -D playwright などで用意してください。");
}

const SRC = __dirname;
const OUT = path.resolve(SRC, "..");
const W = 1220, H = 1016;
const SAFE_X = 102;          // 左右の余白（一覧で正方形に切られても読める範囲）
const args = process.argv.slice(2);
const planB = args.includes("--plan-b");
const wanted = args.filter(a => /^\d+$/.test(a));
// 価格の入った画像（プランBで作り直すもの）
const PRICE_PAGES = ["01-main", "04-plans"];

const pages = fs.readdirSync(SRC)
  .filter(f => /^\d\d-.+\.html$/.test(f))
  .map(f => f.replace(/\.html$/, ""))
  .filter(n => (wanted.length ? wanted.some(w => n.startsWith(w)) : true))
  .filter(n => (planB ? PRICE_PAGES.includes(n) : true))
  .sort();

(async () => {
  const { chromium } = loadPlaywright();
  const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const outDir = planB ? path.join(OUT, "plan-b") : OUT;
  fs.mkdirSync(outDir, { recursive: true });
  let warnings = 0;

  for (const name of pages) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const query = planB ? "?basic=3,000" : "";
    await page.goto("file://" + path.join(SRC, name + ".html") + query, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const fontOk = await page.evaluate(() => document.fonts.check("800 40px 'Noto Sans JP'"));
    if (!fontOk) { console.warn(`[警告] ${name}: Noto Sans JP を読み込めていません（代わりのフォントで書き出されます）`); warnings++; }
    await page.waitForTimeout(250);

    // はみ出し・見切れの検査
    const problems = await page.evaluate(({ W, H, SAFE_X }) => {
      const out = [];
      const canvas = document.querySelector(".canvas");
      canvas.querySelectorAll("*").forEach(el => {
        if (el.closest(".mascot, .blob, .band, .decor")) return;
        const cs = getComputedStyle(el);
        if (cs.display === "inline") return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const label = (el.className && String(el.className)) || el.tagName.toLowerCase();
        const text = (el.textContent || "").trim().slice(0, 18);
        if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible") out.push(`文字がはみ出し: .${label} 「${text}」`);
        if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.push(`キャンバスの外: .${label} 「${text}」`);
        // 文字を直接含む要素が、左右の余白（安全範囲）に入っているか
        const hasOwnText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (hasOwnText && (r.left < SAFE_X - 2 || r.right > W - SAFE_X + 2) && !el.closest(".allow-wide")) {
          out.push(`安全範囲の外（左右）: .${label} 「${text}」 left=${Math.round(r.left)} right=${Math.round(r.right)}`);
        }
      });
      // 文字同士の重なり（ブランド帯と本文など）
      const boxes = [...canvas.querySelectorAll("p, li, h1, h2, h3, span.t, .t, .label")]
        .filter(el => !el.closest(".mascot, .blob") && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
        .map(el => ({ el, r: el.getBoundingClientRect() }));
      const brand = canvas.querySelector(".brand");
      if (brand) {
        const br = brand.getBoundingClientRect();
        boxes.forEach(({ el, r }) => {
          if (brand.contains(el)) return;
          if (r.bottom > br.top - 6) out.push(`ブランド帯と重なる: 「${(el.textContent || "").trim().slice(0, 18)}」 bottom=${Math.round(r.bottom)} brandTop=${Math.round(br.top)}`);
        });
      }
      return out;
    }, { W, H, SAFE_X });
    problems.forEach(p => { console.warn(`[警告] ${name}: ${p}`); warnings++; });

    const file = path.join(outDir, name + ".png");
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
    console.log("書き出し:", path.relative(process.cwd(), file));
    await page.close();
  }
  await browser.close();
  console.log(warnings ? `警告 ${warnings} 件` : "警告なし");
})().catch(e => { console.error(e); process.exit(1); });
