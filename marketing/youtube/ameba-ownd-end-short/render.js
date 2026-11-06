"use strict";
// 動画の1コマずつを、PNGで書き出す（時間 t を決めて描画し、スクリーンショットする）。
//   使い方：node render.js [--still] （--still：場面ごとの静止画だけ frames-preview/ に書き出す）
const fs = require("fs");
const path = require("path");
function loadPlaywright() { for (const c of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(c); } catch (_) {} } throw new Error("playwright が見つかりません"); }
const HERE = __dirname;
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, "scenes.json"), "utf8"));
const dur = JSON.parse(fs.readFileSync(path.join(HERE, "audio", "durations.json"), "utf8"));
// ナレーションが、場面の長さに収まっているか確認
cfg.scenes.forEach(s => { const n = dur[s.id]; if (n && cfg.narrationOffset + n + 0.15 > s.dur) console.warn(`[警告] ${s.id}: ナレーション ${n}秒が、場面 ${s.dur}秒に収まりません`); });
const still = process.argv.includes("--still");
(async () => {
  const { chromium } = loadPlaywright();
  const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(HERE, "video.html"), { waitUntil: "networkidle" });
  const { total } = await page.evaluate(c => setup(c), cfg);
  await page.evaluate(() => ready());
  const outDir = path.join(HERE, still ? "frames-preview" : "frames");
  fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
  if (still) {
    let t0 = 0;
    for (const s of cfg.scenes) { const t = t0 + Math.min(s.dur - 0.2, 2.2); await page.evaluate(t => renderAt(t), t); await page.screenshot({ path: path.join(outDir, s.id + ".png") }); t0 += s.dur; }
    console.log("静止画:", cfg.scenes.length, "枚 →", path.relative(process.cwd(), outDir));
  } else {
    const n = Math.round(total * cfg.fps);
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => renderAt(t), i / cfg.fps);
      await page.screenshot({ path: path.join(outDir, String(i).padStart(5, "0") + ".png") });
      if (i % 120 === 0) console.log("フレーム", i, "/", n);
    }
    fs.writeFileSync(path.join(outDir, "..", "audio", "total.txt"), String(total));
    console.log("書き出し:", n, "フレーム（", total.toFixed(2), "秒 ）");
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
