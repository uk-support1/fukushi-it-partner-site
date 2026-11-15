"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const { isPublicFile } = require("../scripts/prepare-pages");

// ---- a tiny fake DOM, just enough to run assets/js/latest-updates.js without a browser ----
function makeEnv({ scriptSrc, bodyClasses = [], files, withObserver = false }) {
  class El {
    constructor(tag) { this.tagName = tag; this.children = []; this.className = ""; this.attrs = {}; this._text = ""; this.id = ""; this.href = ""; this.rel = ""; }
    setAttribute(k, v) { this.attrs[k] = v; }
    appendChild(c) { this.children.push(c); return c; }
    insertBefore(c) { this.children.unshift(c); return c; }
    get firstChild() { return this.children[0] || null; }
    set textContent(v) { this._text = String(v); }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(""); }
    find(cls) { return [...this.children.flatMap(c => [c, ...c.find(cls)])].filter(c => (" " + c.className + " ").includes(" " + cls + " ")); }
  }
  const footerBox = new El("div");
  const head = new El("head");
  const requested = [];
  const document = {
    currentScript: { src: scriptSrc },
    body: { classList: { contains: c => bodyClasses.includes(c) } },
    head,
    createElement: tag => new El(tag),
    querySelector(sel) {
      if (sel === ".site-footer .container") return footerBox;
      if (sel === ".latest-updates") return footerBox.find("latest-updates")[0] || null;
      return null;
    }
  };
  const fetch = async url => {
    requested.push(url);
    const key = Object.keys(files).find(k => url.endsWith(k));
    const value = key ? files[key] : undefined;
    if (value === undefined) return { ok: false, status: 404, json: async () => { throw new Error("404"); } };
    return { ok: true, json: async () => value };
  };
  const window = withObserver ? { IntersectionObserver: class { constructor(cb) { this.cb = cb; } observe() { window.observed = true; } disconnect() {} } } : {};
  return { document, fetch, window, footerBox, head, requested, El };
}

async function run(opts) {
  const env = makeEnv(opts);
  const code = read("assets/js/latest-updates.js");
  // In a browser the observer is a global; mirror that in the sandbox.
  vm.runInNewContext(code, { document: env.document, window: env.window, IntersectionObserver: env.window.IntersectionObserver, fetch: env.fetch, URL, Promise, Array, String });
  for (let i = 0; i < 5; i += 1) await new Promise(resolve => setImmediate(resolve));
  return env;
}

const blog = (slug, date, title, extra = {}) => ({ slug, date, title, category_label: "IT活用", ...extra });
const course = (slug, date, title) => ({ slug, date, title, category_label: "ホームページ・Web制作" });

test("新着欄：お役立ち情報とホームページ作成講座を、日付の新しい順に最大6件、日付つきで出す", async () => {
  const env = await run({
    scriptSrc: "https://example.test/assets/js/latest-updates.js",
    files: {
      "data/blog-index.json": [blog("b1", "2026-11-14", "ブログ1"), blog("b2", "2026-11-13", "ブログ2"), blog("b3", "2026-11-12", "ブログ3"), blog("b4", "2026-11-10", "ブログ4"), blog("b5", "2026-11-09", "ブログ5")],
      "data/course-index.json": [course("c1", "2026-11-14", "講座1"), course("c2", "2026-11-11", "講座2"), course("c3", "2026-11-01", "講座3")]
    }
  });
  const section = env.footerBox.find("latest-updates")[0];
  assert.ok(section, "section is inserted at the top of the footer");
  assert.equal(env.footerBox.firstChild, section);
  const items = section.find("latest-updates-item");
  assert.equal(items.length, 6);
  const titles = items.map(li => li.find("latest-updates-link")[0].textContent);
  // 同じ日付（11/14）では、お役立ち情報が先。そのあとは日付順。
  assert.deepEqual(titles, ["ブログ1", "講座1", "ブログ2", "ブログ3", "講座2", "ブログ4"]);
  const dates = items.map(li => li.find("latest-updates-time")[0].textContent);
  assert.deepEqual(dates, ["2026.11.14", "2026.11.14", "2026.11.13", "2026.11.12", "2026.11.11", "2026.11.10"]);
  assert.equal(items[0].find("latest-updates-time")[0].attrs.datetime, "2026-11-14");
  assert.equal(section.find("latest-updates-latest")[0].textContent, "最終更新：2026.11.14");
  assert.equal(section.find("latest-updates-title")[0].textContent, "お役立ち情報を更新しました");
  assert.equal(section.find("latest-updates-badge")[0].textContent, "毎日更新");
  // 種類の表示と、リンク先（サイトのルートから）
  assert.deepEqual(items.map(li => li.find("latest-updates-kind")[0].textContent), ["お役立ち情報", "ホームページ作成講座", "お役立ち情報", "お役立ち情報", "ホームページ作成講座", "お役立ち情報"]);
  assert.equal(items[0].find("latest-updates-link")[0].href, "https://example.test/blog/b1.html");
  assert.equal(items[1].find("latest-updates-link")[0].href, "https://example.test/course/c1.html");
  const more = section.find("latest-updates-more")[0].children.map(a => [a.textContent, a.href]);
  assert.deepEqual(more, [["お役立ち情報をすべて見る →", "https://example.test/blog.html"], ["ホームページ作成講座を見る →", "https://example.test/course.html"]]);
  assert.equal(env.head.children.length, 1);
  assert.equal(env.head.children[0].href, "https://example.test/assets/css/latest-updates.css");
});

test("新着欄：blog/ や course/ の中のページからでも、サイトのルートを正しく見つける", async () => {
  const env = await run({
    scriptSrc: "https://example.test/assets/js/latest-updates.js",
    files: { "data/blog-index.json": [blog("b1", "2026-11-14", "T")], "data/course-index.json": [] }
  });
  assert.ok(env.requested.every(u => u.startsWith("https://example.test/data/")), env.requested.join(","));
});

test("新着欄：片方のデータが取れなくても、取れた分を出す。両方失敗したら何も出さない", async () => {
  const one = await run({ scriptSrc: "https://example.test/assets/js/latest-updates.js", files: { "data/blog-index.json": [blog("b1", "2026-11-14", "T")] } });
  assert.equal(one.footerBox.find("latest-updates-item").length, 1);
  const none = await run({ scriptSrc: "https://example.test/assets/js/latest-updates.js", files: {} });
  assert.equal(none.footerBox.find("latest-updates").length, 0);
  assert.equal(none.footerBox.children.length, 0);
});

test("新着欄：日付や題名が不正なデータは飛ばす。題名は文字として入れる（HTMLとして解釈しない）", async () => {
  const env = await run({
    scriptSrc: "https://example.test/assets/js/latest-updates.js",
    files: {
      "data/blog-index.json": [blog("ok", "2026-11-14", '<img src=x onerror=alert(1)>'), blog("bad", "2026/11/14", "不正な日付"), blog("empty", "2026-11-13", "")],
      "data/course-index.json": "not an array"
    }
  });
  const items = env.footerBox.find("latest-updates-item");
  assert.equal(items.length, 1);
  assert.equal(items[0].find("latest-updates-link")[0].textContent, "<img src=x onerror=alert(1)>");
  assert.ok(!JSON.stringify(env.footerBox.children).includes("innerHTML"));
});

test("新着欄：独立型ページ（lp-shell・jlp-body）には出さない／二重には出さない／フッターが近づくまで読み込まない", async () => {
  const files = { "data/blog-index.json": [blog("b1", "2026-11-14", "T")], "data/course-index.json": [] };
  for (const cls of ["lp-shell", "jlp-body"]) {
    const env = await run({ scriptSrc: "https://example.test/assets/js/latest-updates.js", bodyClasses: [cls], files });
    assert.equal(env.footerBox.children.length, 0, cls);
    assert.equal(env.requested.length, 0, cls + " does not even fetch");
  }
  const lazy = await run({ scriptSrc: "https://example.test/assets/js/latest-updates.js", files, withObserver: true });
  assert.equal(lazy.window.observed, true);
  assert.equal(lazy.requested.length, 0, "nothing is fetched until the footer is near");
});

test("main.js が全ページ共通で新着欄を読み込み、CSS・JSは公開対象で、独立型ページの目印がある", () => {
  const main = read("assets/js/main.js");
  assert.ok(main.includes("latest-updates.js"));
  assert.doesNotThrow(() => new vm.Script(main));
  assert.doesNotThrow(() => new vm.Script(read("assets/js/latest-updates.js")));
  for (const file of ["assets/js/latest-updates.js", "assets/css/latest-updates.css"]) assert.ok(isPublicFile(file), file);
  // 独立型ページは、新着欄を出さない目印（body のクラス）を持つ
  assert.match(read("php-homepage-comparison.html"), /<body class="lp-shell">/);
  assert.match(read("ameba-ownd-end.html"), /<body class="lp-shell">/);
  assert.match(read("subsidy-support/index.html"), /<body class="jlp-body">/);
  // 公開する2つのデータが、新着欄の必要な項目（slug・title・date）を持つ
  for (const file of ["data/blog-index.json", "data/course-index.json"]) {
    const list = JSON.parse(read(file));
    assert.ok(list.length > 0, file);
    for (const item of list) assert.ok(item.slug && item.title && /^\d{4}-\d{2}-\d{2}$/.test(item.date), file + " " + item.slug);
    assert.ok(isPublicFile(file), file + " is public");
  }
});

test("サイトの表示名：ブログ→お役立ち情報、お役立ち講座→ホームページ作成講座（旧名のナビ・フッター・戻るリンクが残っていない）", () => {
  const files = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const oldBlogLink = /<a\s[^>]*href="(?:\.\.\/)?blog\.html"[^>]*>(?:<svg(?:(?!<\/a>)[\s\S])*?<\/svg>)?ブログ<\/a>/;
  const oldCourseLink = /<a\s[^>]*href="(?:\.\.\/)?course\.html"[^>]*>(?:<svg(?:(?!<\/a>)[\s\S])*?<\/svg>)?お役立ち講座<\/a>/;
  for (const file of files) {
    const html = read(file);
    assert.ok(!oldBlogLink.test(html), file + " still labels blog.html as ブログ");
    assert.ok(!oldCourseLink.test(html), file + " still labels course.html as お役立ち講座");
    assert.ok(!html.includes("ブログ一覧へ戻る"), file);
    assert.ok(!html.includes("お役立ち講座一覧へ戻る"), file);
  }
  const blogPage = read("blog.html");
  assert.match(blogPage, /<title>お役立ち情報｜/);
  assert.match(blogPage, /<h1>お役立ち情報<\/h1>/);
  const coursePage = read("course.html");
  assert.match(coursePage, /<title>福祉事業所のホームページ作成講座｜/);
  assert.match(coursePage, /<h1>福祉事業所のホームページ作成講座<\/h1>/);
  // ナビ・フッターの新しい名前
  const home = read("index.html");
  assert.match(home, /<a href="blog\.html">お役立ち情報<\/a>/);
  assert.match(home, /<\/svg>ホームページ作成講座<\/a>/);
});
