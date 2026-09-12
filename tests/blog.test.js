"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..");
const lib = require("../scripts/lib/articles");
const YAML = require("yaml");
const { isPublicFile } = require("../scripts/prepare-pages");
const text = (dir, file) => fs.readFileSync(path.join(dir, file), "utf8").replace(/\r\n/g, "\n");
function sandbox(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fukushi-blog-test-"));
  // Copies only; the source repository and its generated files are never written.
  for (const f of ["scripts", "content", "blog", "data", "blog.html", "sitemap.xml"]) {
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  t.after(() => {
    const resolved = fs.realpathSync(dir);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("fukushi-blog-test-"));
    fs.rmSync(resolved, { recursive: true });
  });
  return dir;
}
function run(dir, success = true) {
  const result = spawnSync(process.execPath, ["scripts/generate-blog.js"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules") }
  });
  if (success) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0);
}
function article(dir, slug, published, extra = "", body = "本文から説明文を生成します。") {
  fs.writeFileSync(path.join(dir, "content/articles", slug + ".md"),
    `---\ntype: column\ntitle: ${slug}\ndate: 2026-09-11\nimage: assets/images/logo.png\npublished: ${published}\n${extra}---\n${body}\n`);
}
function visibility(dir, slug, expected) {
  assert.equal(fs.existsSync(path.join(dir, "blog", slug + ".html")), expected);
  assert.equal(text(dir, "blog.html").includes(`blog/${slug}.html`), expected);
  assert.equal(JSON.parse(text(dir, "data/blog-index.json")).some(a => a.slug === slug), expected);
  assert.equal(text(dir, "sitemap.xml").includes(`/blog/${slug}.html`), expected);
}
test("A: full generation is repeatable as published article history grows", t => {
  const dir = sandbox(t);
  const files = ["blog.html", "sitemap.xml", "data/blog-index.json", ...fs.readdirSync(path.join(ROOT,"blog")).filter(f=>f.endsWith(".html")).map(f=>"blog/"+f)];
  run(dir);
  const first = Object.fromEntries(files.map(f => [f, text(dir,f)]));
  run(dir);
  for(const f of files) assert.equal(text(dir,f), first[f], f);
});
test("B: new draft excluded everywhere", t => {
  const dir = sandbox(t); article(dir,"test-draft",false); run(dir); visibility(dir,"test-draft",false);
});
test("C/D: publish then unpublish; unmanaged HTML preserved", t => {
  const dir = sandbox(t);
  fs.writeFileSync(path.join(dir,"blog/legacy.html"),"<h1>Legacy</h1>");
  fs.writeFileSync(path.join(dir,"blog/other.html"),"<h1>Other</h1>");
  article(dir,"test-published",true); run(dir); visibility(dir,"test-published",true);
  article(dir,"test-published",false); run(dir); visibility(dir,"test-published",false);
  assert.equal(text(dir,"blog/legacy.html"),"<h1>Legacy</h1>");
  assert.equal(text(dir,"blog/other.html"),"<h1>Other</h1>");
  assert.ok(text(dir,"sitemap.xml").includes("/blog/legacy.html"));
  run(dir); visibility(dir,"test-published",false);
});
test("E: manual and automatic related links never expose drafts or legacy metadata", t => {
  const dir = sandbox(t);
  article(dir,"secret-draft",false);
  fs.writeFileSync(path.join(dir,"blog/legacy.html"),"<h1>LEGACY_SECRET</h1>");
  article(dir,"test-manual",true,"related: [secret-draft, legacy, welcome-message]\n");
  article(dir,"test-auto",true); run(dir);
  for(const slug of ["test-manual","test-auto"]) {
    const html = text(dir,"blog/"+slug+".html");
    assert.ok(!html.includes("secret-draft")); assert.ok(!html.includes("LEGACY_SECRET"));
  }
  assert.ok(text(dir,"blog/test-manual.html").includes('href="welcome-message.html"'));
});
test("F: blank or absent description uses plain body text", t => {
  const dir = sandbox(t);
  for(const [slug,extra] of [["test-blank",'description: ""\n'],["test-absent",""],["test-null","description:\n"]]) {
    article(dir,slug,true,extra,"**本文**から説明文を生成します。");
  }
  run(dir);
  for(const slug of ["test-blank","test-absent","test-null"]) {
    assert.ok(text(dir,"blog/"+slug+".html").includes('<meta name="description" content="本文から説明文を生成します。">'));
  }
});
test("YAML: folded/literal/chomping/quoted multiline descriptions", () => {
  for(const [value,expected] of [[">-\n  first\n  second","first second"],["|-\n  first\n  second","first\nsecond"],[">\n  first\n  second","first second\n"],['"first\n  second"',"first second"]]) {
    assert.equal(lib.parseFrontmatter("---\ndescription: "+value+"\n---\nBody").data.description,expected);
  }
});
test("Invalid YAML / unsafe slug fails before overwriting or deleting outputs", t => {
  const dir = sandbox(t), before=text(dir,"blog.html");
  article(dir,"test-invalid",false,"slug: ../index\n");
  run(dir,false); assert.equal(text(dir,"blog.html"),before);
  fs.writeFileSync(path.join(dir,"content/articles/test-invalid.md"),"---\ntitle: [broken\n---\nBody");
  run(dir,false); assert.equal(text(dir,"blog.html"),before);
});
test("CMS required fields and Pages artifact exclusion", () => {
  const cms=YAML.parse(text(ROOT,".pages.yml"));
  for(const name of ["title","date","type","image","body"]) assert.equal(cms.content[0].fields.find(f=>f.name===name).required,true);
  for(const f of ["index.html","blog/article.html","subsidy-support/index.html","assets/css/style.css","CNAME","data/blog-index.json"]) assert.ok(isPublicFile(f));
  for(const f of ["content/articles/draft.md","state/x.json","runs/x.json","drafts/x.md","admin/index.html",".github/workflows/x.yml","node_modules/x.js","scripts/x.js",".pages.yml"]) assert.ok(!isPublicFile(f));
  const workflow=YAML.parse(text(ROOT,".github/workflows/generate-blog.yml"));
  assert.deepEqual(workflow.on.push.branches,["main"]);
  assert.equal(workflow.jobs.deploy.needs,"build-blog");
  assert.equal(workflow.jobs.deploy.permissions["pages"],"write");
});
