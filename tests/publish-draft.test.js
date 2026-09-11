"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { saveArticleDraft } = require("../scripts/article-writer");
const { publishDraft, failureReport } = require("../scripts/publish-draft");
const { DraftCommitError, defaultRunGit } = require("../scripts/commit-draft");

const ROOT = path.resolve(__dirname, "..");
const topic = {
  title: "福祉事業所の採用応募フォームで入力負担を減らす設計",
  category: "採用",
  target: "福祉事業所の採用担当者",
  keyword: "福祉 採用 応募フォーム",
  reason: "既存記事とは異なる採用応募時の離脱に着目するため",
  angle: "応募入力項目を減らし途中離脱を抑える",
  service: "ホームページ改善支援"
};
const body = [
  "福祉事業所の採用ページでは、応募する方が迷わず次の行動へ進める情報整理が大切です。",
  "## 応募する方が知りたい情報を整理する",
  "仕事内容や勤務場所、応募後の流れを分かりやすくまとめます。".repeat(25),
  "## 入力項目を必要なものに絞る",
  "最初の連絡で確認する内容と、面談後に確認できる内容を分けます。".repeat(25),
  "## スマートフォンで操作を確認する",
  "文字の読みやすさやボタンの位置、エラー表示を確認します。".repeat(25)
].join("\n\n");
const article = {
  title: topic.title,
  description: "福祉事業所の採用応募フォームについて、入力負担を減らすポイントを紹介します。",
  bodyMarkdown: body
};

function git(args, cwd, allowFailure = false) {
  const result = cp.spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error("test git command failed: " + args.join(" ") + "\n" + result.stderr);
  }
  return allowFailure ? result : result.stdout.trim();
}

function hashFiles(directory, relativeFiles) {
  return Object.fromEntries(relativeFiles.map(file => [
    file,
    crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, ...file.split("/")))).digest("hex")
  ]));
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "daily-publish-git-"));
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  for (const entry of ["scripts", "content", "blog", "data", "blog.html", "sitemap.xml"]) {
    fs.cpSync(path.join(ROOT, entry), path.join(work, entry), { recursive: true });
  }
  git(["init", "--bare", "--initial-branch=main", remote], root);
  git(["init", "--initial-branch=main"], work);
  git(["config", "user.name", "Test User"], work);
  git(["config", "user.email", "test@example.invalid"], work);
  git(["add", "--", "scripts", "content", "blog", "data", "blog.html", "sitemap.xml"], work);
  git(["commit", "-m", "fixture"], work);
  git(["remote", "add", "origin", remote], work);
  git(["push", "-u", "origin", "main"], work);

  const saved = saveArticleDraft({
    article,
    topic,
    date: "2026-09-12",
    directory: path.join(work, "content", "articles")
  });
  const relative = "content/articles/" + saved.filename;
  git(["add", "--", relative], work);
  git(["commit", "-m", "blog: add daily draft 2026-09-12"], work);
  git(["push", "origin", "main"], work);
  const draftCommit = git(["rev-parse", "HEAD"], work);
  const daily = {
    status: "draft_saved",
    articlesCreated: 1,
    shouldPublish: false,
    localDate: "2026-09-12",
    topic,
    article,
    draft: saved
  };
  const committed = {
    status: "draft_committed",
    articlesCreated: 1,
    shouldPublish: false,
    localDate: "2026-09-12",
    slug: saved.slug,
    file: relative,
    commit: draftCommit
  };
  const dailyResultFile = path.join(root, "daily.json");
  const commitResultFile = path.join(root, "committed.json");
  fs.writeFileSync(dailyResultFile, JSON.stringify(daily));
  fs.writeFileSync(commitResultFile, JSON.stringify(committed));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, remote, work, saved, relative, draftCommit, dailyResultFile, commitResultFile };
}

function publishOptions(value, extra = {}) {
  return {
    dailyResultFile: value.dailyResultFile,
    commitResultFile: value.commitResultFile,
    cwd: value.work,
    ...extra
  };
}

test("Daily draft alone is published and all required outputs are committed and pushed", t => {
  const value = fixture(t);
  const existingMarkdown = fs.readdirSync(path.join(value.work, "content", "articles"))
    .filter(name => name.endsWith(".md") && name !== value.saved.filename)
    .map(name => "content/articles/" + name);
  const existingHtml = fs.readdirSync(path.join(value.work, "blog"))
    .filter(name => name.endsWith(".html"))
    .map(name => "blog/" + name);
  const before = hashFiles(value.work, existingMarkdown.concat(existingHtml));
  const result = publishDraft(publishOptions(value));
  assert.equal(result.status, "publication_committed");
  assert.equal(result.articlesCreated, 1);
  assert.equal(result.shouldPublish, true);

  const expected = [
    value.relative,
    "blog/" + value.saved.slug + ".html",
    "blog.html",
    "sitemap.xml",
    "data/blog-index.json"
  ].sort();
  const committed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], value.work)
    .split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(committed, expected);
  assert.deepEqual(hashFiles(value.work, existingMarkdown.concat(existingHtml)), before);
  assert.equal(require("../scripts/lib/articles")
    .parseFrontmatter(fs.readFileSync(value.saved.filePath, "utf8")).data.published, true);
  assert.ok(fs.existsSync(path.join(value.work, "blog", value.saved.slug + ".html")));
  const index = JSON.parse(fs.readFileSync(path.join(value.work, "data", "blog-index.json"), "utf8"));
  assert.equal(index.filter(item => item.slug === value.saved.slug).length, 1);
  assert.equal(index[0].slug, value.saved.slug);
  assert.match(fs.readFileSync(path.join(value.work, "blog.html"), "utf8"),
    new RegExp("blog/" + value.saved.slug + "\\.html"));
  assert.match(fs.readFileSync(path.join(value.work, "sitemap.xml"), "utf8"),
    new RegExp("/blog/" + value.saved.slug + "\\.html"));
  assert.equal(git(["rev-parse", "HEAD"], value.work), git(["rev-parse", "origin/main"], value.work));
});

test("The same draft cannot be published twice", t => {
  const value = fixture(t);
  publishDraft(publishOptions(value));
  const publishedCommit = git(["rev-parse", "HEAD"], value.work);
  assert.throws(() => publishDraft(publishOptions(value)));
  assert.equal(git(["rev-parse", "HEAD"], value.work), publishedCommit);
});

test("A concurrent main update stops publication before the Markdown is changed", t => {
  const value = fixture(t);
  const peer = path.join(value.root, "peer");
  git(["clone", value.remote, peer], value.root);
  git(["config", "user.name", "Peer User"], peer);
  git(["config", "user.email", "peer@example.invalid"], peer);
  fs.writeFileSync(path.join(peer, "peer.txt"), "remote update\n");
  git(["add", "--", "peer.txt"], peer);
  git(["commit", "-m", "peer update"], peer);
  git(["push", "origin", "main"], peer);
  assert.throws(() => publishDraft(publishOptions(value)), { code: "PUBLICATION_MAIN_CHANGED" });
  assert.equal(require("../scripts/lib/articles")
    .parseFrontmatter(fs.readFileSync(value.saved.filePath, "utf8")).data.published, false);
  assert.equal(git(["rev-parse", "HEAD"], value.work), value.draftCommit);
});

test("Generation failure is never reported as a successful publication", t => {
  const value = fixture(t);
  let caught;
  try {
    publishDraft(publishOptions(value, { generate: () => { throw new Error("generation failed"); } }));
  } catch (error) { caught = error; }
  assert.deepEqual(failureReport(caught), {
    status: "failed", error: "PUBLICATION_FAILED", articlesCreated: 0, shouldPublish: false
  });
  assert.equal(git(["rev-parse", "HEAD"], value.work), value.draftCommit);
  const remoteMarkdown = git(["--git-dir", value.remote, "show", "main:" + value.relative], value.root);
  assert.match(remoteMarkdown, /published: false/);
});

test("A rejected publication push leaves the remote draft unpublished", t => {
  const value = fixture(t);
  const runGit = (args, options) => {
    if (args[0] === "push") throw new DraftCommitError(options.failureCode);
    return defaultRunGit(args, options);
  };
  let caught;
  try { publishDraft(publishOptions(value, { runGit })); }
  catch (error) { caught = error; }
  assert.deepEqual(failureReport(caught), {
    status: "failed", error: "PUBLICATION_PUSH_FAILED", articlesCreated: 0, shouldPublish: false
  });
  const remoteMarkdown = git(["--git-dir", value.remote, "show", "main:" + value.relative], value.root);
  assert.match(remoteMarkdown, /published: false/);
});

test("Publication Git commands use explicit files and no broad add, force, merge or rebase", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts", "publish-draft.js"), "utf8");
  assert.match(source, /\["add", "--", \.\.\.expected\]/);
  assert.doesNotMatch(source, /\["add",\s*"\."\]|\["add",\s*"-A"\]/);
  assert.doesNotMatch(source, /--force|push",\s*"-f"|\["merge"|\["rebase"/);
});
