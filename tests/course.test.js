"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const YAML = require("yaml");
const ROOT = path.resolve(__dirname, "..");
const { isPublicFile } = require("../scripts/prepare-pages");
const { courseBodyToHtml } = require("../scripts/lib/course-markdown");

const text = (dir, file) => fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");

function sandbox(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fukushi-course-test-"));
  // Copies only; the source repository and its generated files are never written.
  for (const f of ["scripts", "content", "blog", "course", "data", "blog.html", "course.html", "sitemap.xml"]) {
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  t.after(() => {
    const resolved = fs.realpathSync(dir);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("fukushi-course-test-"));
    fs.rmSync(resolved, { recursive: true });
  });
  return dir;
}
function runCourse(dir, success = true) {
  const result = spawnSync(process.execPath, ["scripts/generate-course.js"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules") }
  });
  if (success) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0);
  return result;
}
function runBlog(dir, success = true) {
  const result = spawnSync(process.execPath, ["scripts/generate-blog.js"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules") }
  });
  if (success) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0);
  return result;
}
function courseArticle(dir, slug, published, extra = "", body = "本文の説明文です。") {
  fs.writeFileSync(path.join(dir, "content/courses", slug + ".md"),
    `---\ntitle: ${slug}\nslug: ${slug}\ndate: 2026-09-12\ncategory_label: ホームページ・Web制作\nimage: assets/images/services/service-homepage.jpg\npublished: ${published}\n${extra}---\n${body}\n`);
}
function visibility(dir, slug, expected) {
  assert.equal(fs.existsSync(path.join(dir, "course", slug + ".html")), expected);
  assert.equal(text(dir, "course.html").includes(`course/${slug}.html`), expected);
  assert.equal(JSON.parse(text(dir, "data/course-index.json")).some(a => a.slug === slug), expected);
  assert.equal(text(dir, "sitemap.xml").includes(`/course/${slug}.html`), expected);
}

test("CMS config: courses collection is separate from articles and has required fields", () => {
  const cms = YAML.parse(text(ROOT, ".pages.yml"));
  assert.equal(cms.content[0].name, "articles");
  const courses = cms.content.find(c => c.name === "courses");
  assert.ok(courses, "courses collection must exist");
  assert.equal(courses.path, "content/courses");
  assert.notEqual(courses.path, cms.content[0].path);
  for (const name of ["title", "slug", "date", "category_label", "image", "body"]) {
    const field = courses.fields.find(f => f.name === name);
    assert.ok(field, name + " field must exist");
    assert.equal(field.required, true, name + " must be required");
  }
  const categoryField = courses.fields.find(f => f.name === "category_label");
  assert.equal(categoryField.type, "select");
  assert.deepEqual(categoryField.options.values, [
    "ホームページ・Web制作", "SEO・集客", "AI・IT活用", "Googleマップ・SNS・広報",
  ]);
  const published = courses.fields.find(f => f.name === "published");
  assert.equal(published.type, "boolean");
  assert.equal(published.default, false);
  // Body description documents the course-only tags as a quick reference for CMS editors.
  const body = courses.fields.find(f => f.name === "body");
  for (const tag of ["[SUMMARY]", "[BUHIO", "[POINT]", "[CAUTION]", "[MARK]"]) {
    assert.ok(body.description.includes(tag), "body description should mention " + tag);
  }
});

test("Pages artifact includes course.html, course/*, course CSS/JS and course-index.json", () => {
  for (const f of ["course.html", "course/sample.html", "assets/css/course.css", "assets/js/course-toc.js", "data/course-index.json"]) {
    assert.ok(isPublicFile(f), f + " should be public");
  }
  for (const f of ["content/courses/draft.md"]) {
    assert.ok(!isPublicFile(f), f + " should not be public");
  }
  // Existing blog/general publish rules must be unaffected by the addition.
  for (const f of ["index.html", "blog/article.html", "subsidy-support/index.html", "assets/css/style.css", "CNAME", "data/blog-index.json"]) {
    assert.ok(isPublicFile(f), f + " should still be public");
  }
});

test("A: course generation is repeatable", t => {
  const dir = sandbox(t);
  const files = ["course.html", "sitemap.xml", "data/course-index.json",
    ...fs.readdirSync(path.join(ROOT, "course")).filter(f => f.endsWith(".html")).map(f => "course/" + f)];
  runCourse(dir);
  const first = Object.fromEntries(files.map(f => [f, text(dir, f)]));
  runCourse(dir);
  for (const f of files) assert.equal(text(dir, f), first[f], f);
});

test("B: draft course excluded from output, index and sitemap", t => {
  const dir = sandbox(t);
  courseArticle(dir, "test-course-draft", false);
  runCourse(dir);
  visibility(dir, "test-course-draft", false);
});

test("C: published course appears in course.html, index and sitemap; unpublishing removes it", t => {
  const dir = sandbox(t);
  courseArticle(dir, "test-course-pub", true);
  runCourse(dir);
  visibility(dir, "test-course-pub", true);
  courseArticle(dir, "test-course-pub", false);
  runCourse(dir);
  visibility(dir, "test-course-pub", false);
});

test("D: course-index.json contains the expected fields", t => {
  const dir = sandbox(t);
  courseArticle(dir, "test-course-fields", true, "image_alt: サンプル画像\ndescription: サンプルの概要文です。\n");
  runCourse(dir);
  const entry = JSON.parse(text(dir, "data/course-index.json")).find(a => a.slug === "test-course-fields");
  assert.equal(entry.title, "test-course-fields");
  assert.equal(entry.category_label, "ホームページ・Web制作");
  assert.equal(entry.description, "サンプルの概要文です。");
  assert.equal(entry.image, "assets/images/services/service-homepage.jpg");
});

test("Custom tags render correctly: SUMMARY, BUHIO, POINT, CAUTION, MARK, H2/H3, numbered list", () => {
  const body = [
    "[SUMMARY]",
    "- わかること1",
    "- わかること2",
    "[/SUMMARY]",
    "",
    "## 見出し2",
    "",
    "本文です。**太字**もあります。",
    "",
    "[BUHIO type=\"point\"]ぶひおのコメント[/BUHIO]",
    "",
    "### 見出し3",
    "",
    "[MARK]重要な文章[/MARK]です。",
    "",
    "[POINT]",
    "1. 要点1",
    "2. 要点2",
    "[/POINT]",
    "",
    "[CAUTION]",
    "注意事項です。",
    "[/CAUTION]",
  ].join("\n");
  const { html, headings } = courseBodyToHtml(body, "course");
  assert.match(html, /<div class="course-summary">/);
  assert.match(html, /この記事でわかること/);
  assert.match(html, /<h2 id="[^"]+">見出し2<\/h2>/);
  assert.match(html, /<h3 id="[^"]+">見出し3<\/h3>/);
  assert.match(html, /<strong>太字<\/strong>/);
  assert.match(html, /<div class="course-buhio">[\s\S]*buhio-03-pointing\.png[\s\S]*<span class="course-buhio-tag">POINT<\/span>/);
  assert.match(html, /<span class="course-mark">重要な文章<\/span>/);
  assert.match(html, /<div class="course-point"><ol>\s*<li>要点1<\/li>\s*<li>要点2<\/li>/);
  assert.match(html, /<div class="course-caution"><p class="course-caution-label">注意<\/p>/);
  // No raw bracket tags should leak into the rendered HTML.
  assert.ok(!/\[SUMMARY\]|\[\/SUMMARY\]|\[POINT\]|\[\/POINT\]|\[CAUTION\]|\[\/CAUTION\]|\[MARK\]|\[\/MARK\]|\[BUHIO/.test(html));
  assert.deepEqual(headings.map(h => h.text), ["見出し2", "見出し3"]);
});

test("BUHIO type maps to an existing buhio asset for every documented type", () => {
  for (const type of ["point", "caution", "important", "success", "greeting", "note", "unknown-type"]) {
    const body = `[BUHIO type="${type}"]コメント[/BUHIO]`;
    const { html } = courseBodyToHtml(body, "course");
    assert.match(html, /assets\/images\/buhio\/buhio-0[1-6]-[a-z]+\.png/);
  }
});

test("E: existing blog is unaffected by running the course generator", t => {
  const dir = sandbox(t);
  const blogHtmlBefore = text(dir, "blog.html");
  const blogArticleFiles = fs.readdirSync(path.join(dir, "blog")).filter(f => f.endsWith(".html"));
  const blogArticlesBefore = Object.fromEntries(blogArticleFiles.map(f => [f, text(dir, "blog/" + f)]));
  runCourse(dir);
  assert.equal(text(dir, "blog.html"), blogHtmlBefore);
  for (const f of blogArticleFiles) assert.equal(text(dir, "blog/" + f), blogArticlesBefore[f]);
});

test("F: sitemap keeps blog URLs and gains course URLs regardless of which generator runs last", t => {
  const dir = sandbox(t);
  courseArticle(dir, "test-course-sitemap", true);

  // Course generator runs first (as generate-course.yml would).
  runCourse(dir);
  const afterCourse = text(dir, "sitemap.xml");
  assert.ok(afterCourse.includes("/course.html"));
  assert.ok(afterCourse.includes("/course/test-course-sitemap.html"));
  assert.ok(afterCourse.includes("/blog/welcome-message.html"));

  // Blog generator runs afterwards (as generate-blog.yml would on the same push,
  // since it has no path filter); course URLs must not be lost.
  runBlog(dir);
  const afterBlog = text(dir, "sitemap.xml");
  assert.ok(afterBlog.includes("/course.html"));
  assert.ok(afterBlog.includes("/course/test-course-sitemap.html"));
  assert.ok(afterBlog.includes("/blog/welcome-message.html"));
});

test("G: without any course content, blog sitemap generation is byte-identical to before", t => {
  const dir = sandbox(t);
  fs.rmSync(path.join(dir, "course"), { recursive: true, force: true });
  fs.rmSync(path.join(dir, "data/course-index.json"), { force: true });
  runBlog(dir);
  assert.ok(!text(dir, "sitemap.xml").includes("/course"));
});

test("Nav: course link is present in the blog header and footer templates", () => {
  const src = text(ROOT, "scripts/generate-blog.js");
  const navMatches = src.match(/<li><a href="\.?\.?\/?course\.html"[^<]*>お役立ち講座<\/a><\/li>/g) || [];
  assert.equal(navMatches.length, 4, "expected 2 nav + 2 footer course links across both templates");
});
