"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");
const { BLOG_LATEST_COUNT, parseYmd, groupByMonth, buildBlogArchiveHtml } = require("../scripts/lib/blog-archive");
const { buildBlogHtml } = require("../scripts/generate-blog");
const { isPublicFile } = require("../scripts/prepare-pages");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");

const entry = (slug, date, extra = {}) => ({
  slug, date, title: "記事 " + slug, category_label: "IT活用", excerpt: "要約 " + slug,
  image: "assets/images/logo.png", image_alt: "", object_position: "50% 50%", ...extra
});
const count = (html, re) => (html.match(re) || []).length;

test("日付の読み取り：存在しない日付（うるう年でない2/29、13月）は無効、うるう年の2/29は有効", () => {
  assert.deepEqual(parseYmd("2028-02-29"), { y: 2028, m: 2, d: 29 });
  assert.equal(parseYmd("2026-02-29"), null);
  assert.equal(parseYmd("2026-13-01"), null);
  assert.equal(parseYmd("2026-1-5"), null);
  assert.equal(parseYmd(undefined), null);
});

test("月ごとにまとめる：新しい月が先で、日付が無効な記事は除く", () => {
  const months = groupByMonth([entry("a", "2026-11-08"), entry("b", "2026-10-27"), entry("c", "2026-11-02"), entry("bad", "2026-02-30")]);
  assert.deepEqual(Array.from(months.keys()), ["2026-11", "2026-10"]);
  assert.equal(months.get("2026-11").size, 2);
});

test("アーカイブ：全記事が月ごとの一覧に1回ずつ載り、同じ日の2本目にはidを付けない", () => {
  const entries = [entry("a1", "2026-11-08"), entry("a2", "2026-11-08"), entry("b", "2026-10-27")];
  const html = buildBlogArchiveHtml(entries);
  assert.equal(count(html, /<li class="archive-item"/g), 3);
  for (const e of entries) assert.equal(count(html, new RegExp('href="blog/' + e.slug + '\\.html"', "g")), 1, e.slug);
  assert.equal(count(html, /id="d-2026-11-08"/g), 1);
  assert.equal(count(html, /id="d-2026-10-27"/g), 1);
  assert.ok(html.indexOf('id="m-2026-11"') < html.indexOf('id="m-2026-10"'), "newest month first");
  assert.match(html, /<option value="2026-11">2026年11月<\/option>/);
  assert.match(html, /<summary>2026年11月<span class="archive-count">2本<\/span><\/summary>/);
  assert.match(html, /全3本/);
});

test("カレンダー：記事のある日だけリンク、同じ日に複数あれば本数を表示、曜日の位置が合う", () => {
  const html = buildBlogArchiveHtml([entry("a1", "2026-11-08"), entry("a2", "2026-11-08"), entry("b", "2026-04-01")]);
  assert.match(html, /<a class="cal-day" href="#d-2026-11-08" data-date="2026-11-08" aria-label="11月8日（記事2本）">8<span class="cal-count" aria-hidden="true">2<\/span><\/a>/);
  assert.match(html, /<a class="cal-day" href="#d-2026-04-01" data-date="2026-04-01" aria-label="4月1日（記事1本）">1<\/a>/);
  assert.equal(count(html, /<a class="cal-day"/g), 2);
  const table = month => html.match(new RegExp('<div class="cal-month" id="cal-' + month + '"[\\s\\S]*?</table>'))[0];
  const rows = table => table.match(/<tr>[\s\S]*?<\/tr>/g).slice(1); // 先頭は曜日の見出し
  // 2026-11-01 は日曜日（空白なし）、2026-04-01 は水曜日（空白3つ）
  assert.equal(count(rows(table("2026-11"))[0], /cal-blank/g), 0);
  assert.equal(count(rows(table("2026-04"))[0], /cal-blank/g), 3);
  for (const month of ["2026-11", "2026-04"]) {
    for (const row of rows(table(month))) assert.equal(count(row, /<td/g), 7, month + " rows have 7 cells");
  }
  assert.equal(count(table("2026-04"), /<td[^>]*>(?:<a[^>]*>|<span[^>]*>)\d+/g), 30, "April has 30 days");
});

test("記事の題名・分類は文字として出力される（HTMLとして解釈されない）", () => {
  const html = buildBlogArchiveHtml([entry("x", "2026-11-08", { title: '<script>alert(1)</script> & "引用"', category_label: "<b>分類</b>" })]);
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<b>分類"));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;引用&quot;/);
});

test("一覧ページ：カードは最新10本だけ。11本以上のときだけ「ほかの記事」の案内を出す", () => {
  const many = Array.from({ length: BLOG_LATEST_COUNT + 5 }, (_, i) => entry("p" + i, "2026-11-" + String(28 - i).padStart(2, "0")));
  const html = buildBlogHtml(many);
  assert.equal(count(html, /<a class="blog-featured reveal"/g), 1);
  assert.equal(count(html, /<a class="blog-list-item reveal"/g), BLOG_LATEST_COUNT - 1);
  assert.ok(html.includes('<a class="blog-featured reveal" href="blog/p0.html">'), "newest is featured");
  assert.ok(!html.includes('class="blog-list-item reveal" href="blog/p10.html"'), "11th article has no card");
  assert.equal(count(html, /<li class="archive-item"/g), many.length, "but every article is in the archive");
  assert.match(html, /<p class="blog-more"><a href="#archive">/);
  assert.match(html, /<link rel="stylesheet" href="assets\/css\/blog-archive\.css">/);
  assert.match(html, /<script src="assets\/js\/blog-archive\.js" defer><\/script>/);

  const few = buildBlogHtml(many.slice(0, 3));
  assert.equal(count(few, /<a class="blog-list-item reveal"/g), 2);
  assert.ok(!few.includes("blog-more"), "no teaser when everything is already on the page");
  assert.match(few, /id="archive"/);

  const none = buildBlogHtml([]);
  assert.ok(!none.includes('id="archive"'));
  assert.ok(!none.includes("blog-more"));
});

test("実際の blog.html：最新10本のカード、全記事のアーカイブ、カレンダーと一覧の件数が一致する", () => {
  const index = JSON.parse(read("data/blog-index.json"));
  const html = read("blog.html");
  assert.equal(count(html, /<a class="blog-featured reveal"/g) + count(html, /<a class="blog-list-item reveal"/g), Math.min(index.length, BLOG_LATEST_COUNT));
  assert.equal(count(html, /<li class="archive-item"/g), index.length);
  // 月ごとの本数の合計 = 全記事数
  const monthTotals = [...html.matchAll(/<span class="archive-count">(\d+)本<\/span>/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  assert.equal(monthTotals, index.length);
  // カレンダーの印と、一覧の日付が1対1で対応する
  const calendarDates = [...html.matchAll(/<a class="cal-day" href="#d-([\d-]+)" data-date="\1" aria-label="[^"]*（記事(\d+)本）">/g)];
  const indexDates = new Map();
  index.forEach(item => indexDates.set(item.date, (indexDates.get(item.date) || 0) + 1));
  assert.equal(calendarDates.length, indexDates.size);
  for (const [, date, n] of calendarDates) assert.equal(Number(n), indexDates.get(date), date);
  // 日ごとのid（#d-...）は一覧の中で重複しない
  const ids = [...html.matchAll(/<li class="archive-item" data-date="[\d-]+" id="(d-[\d-]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, indexDates.size);
});

test("カレンダー用のCSS・JSは公開対象で、blog.html から読み込まれ、JSの構文が正しい", () => {
  for (const file of ["assets/css/blog-archive.css", "assets/js/blog-archive.js"]) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), file);
    assert.ok(isPublicFile(file), file + " is deployed");
  }
  const html = read("blog.html");
  assert.ok(html.includes('href="assets/css/blog-archive.css"'));
  assert.ok(html.includes('src="assets/js/blog-archive.js"'));
  assert.doesNotThrow(() => new vm.Script(read("assets/js/blog-archive.js")));
  // 記事ページ・他のページには読み込まない（影響範囲を一覧ページだけに保つ）
  assert.ok(!read("index.html").includes("blog-archive"));
});
