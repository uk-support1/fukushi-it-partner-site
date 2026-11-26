// 新しく公開ページを増やしたときに sitemap.xml への追加漏れがないかを確かめるテスト。
// 固定ページは scripts/generate-blog.js の STATIC_PAGES / STATIC_PAGES_AFTER_ARTICLES に
// 手で追加する仕組みのため、追加し忘れるとここで失敗する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BASE = "https://fukushi-it-partner.com/";

// 検索結果に出さない方針のページ（理由を書いて追加する）
const EXCLUDED = new Set([
  "support.html", // どこからもリンクしていない旧ページ。掲載するかは未定
]);

function listPages() {
  const pages = [];
  for (const dir of ["", "subsidy-support/"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith(".html")) pages.push(dir + f);
    }
  }
  return pages;
}

function isIndexable(file) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) return false;
  if (/http-equiv="refresh"/i.test(html)) return false;
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (canonical && !canonical[1].startsWith(BASE)) return false;
  return true;
}

function toUrl(file) {
  return BASE + file.replace(/(^|\/)index\.html$/, "$1");
}

const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test("公開している固定ページはすべて sitemap.xml に入っている", () => {
  const missing = listPages()
    .filter((f) => !EXCLUDED.has(f) && isIndexable(f))
    .filter((f) => !locs.includes(toUrl(f)));
  assert.deepEqual(missing, [], "scripts/generate-blog.js の STATIC_PAGES に追加してください");
});

test("sitemap.xml のURLはすべて実在し、検索除外ページを含まない", () => {
  for (const loc of locs) {
    assert.ok(loc.startsWith(BASE), loc);
    let file = loc.slice(BASE.length);
    if (file === "" || file.endsWith("/")) file += "index.html";
    assert.ok(fs.existsSync(path.join(ROOT, file)), "存在しない: " + loc);
    assert.ok(isIndexable(file), "検索除外ページが入っている: " + loc);
  }
});
