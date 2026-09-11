"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const YAML = require("yaml");
const {
  DraftCommitError,
  defaultRunGit,
  commitDraft,
  failureReport
} = require("../scripts/commit-draft");

const ROOT = path.resolve(__dirname, "..");

function git(args, cwd, allowFailure = false) {
  const result = cp.spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error("test git command failed: " + args.join(" ") + "\n" + result.stderr);
  }
  return allowFailure ? result : result.stdout.trim();
}

function initRepository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "daily-draft-git-"));
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  git(["init", "--bare", "--initial-branch=main", remote], root);
  git(["init", "--initial-branch=main"], work);
  git(["config", "user.name", "Test User"], work);
  git(["config", "user.email", "test@example.invalid"], work);
  fs.mkdirSync(path.join(work, "content", "articles"), { recursive: true });
  fs.writeFileSync(path.join(work, "README.md"), "fixture\n");
  fs.writeFileSync(path.join(work, "content", "articles", "existing.md"), "existing article\n");
  git(["add", "--", "README.md", "content/articles/existing.md"], work);
  git(["commit", "-m", "fixture"], work);
  git(["remote", "add", "origin", remote], work);
  git(["push", "-u", "origin", "main"], work);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, remote, work };
}

function createDraft(fixture, overrides = {}) {
  const date = "2026-09-12";
  const slug = "article-2026-09-12-abcdef123456";
  const filename = slug + ".md";
  const filePath = path.join(fixture.work, "content", "articles", filename);
  const topic = { category: "採用" };
  const article = {
    title: "福祉事業所の採用ページを改善する方法",
    description: "福祉事業所の採用ページを改善するための実務的なポイントを紹介します。",
    bodyMarkdown: "## 採用情報を整理する\n\n応募者が必要とする内容を確認します。"
  };
  const metadata = {
    type: "column",
    category_label: topic.category,
    title: article.title,
    date,
    image: "assets/images/services/service-homepage.jpg",
    image_alt: "福祉事業所のホームページ活用を支援するイメージ",
    published: false,
    description: article.description,
    slug
  };
  fs.writeFileSync(filePath, "---\n" + YAML.stringify(metadata).trimEnd() + "\n---\n\n" +
    article.bodyMarkdown + "\n");
  const result = {
    status: "draft_saved",
    articlesCreated: 1,
    shouldPublish: false,
    localDate: date,
    topic,
    article,
    draft: { slug, filename, filePath, metadata }
  };
  Object.assign(result, overrides);
  const resultFile = path.join(fixture.root, "result-" + crypto.randomUUID() + ".json");
  fs.writeFileSync(resultFile, JSON.stringify(result));
  return { result, resultFile, filePath, relativePath: "content/articles/" + filename };
}

test("Only the generated Markdown is committed and pushed; unrelated files remain untracked", t => {
  const fixture = initRepository(t);
  const existingBefore = fs.readFileSync(path.join(fixture.work, "content", "articles", "existing.md"), "utf8");
  fs.writeFileSync(path.join(fixture.work, "unrelated.tmp"), "do not stage\n");
  const draft = createDraft(fixture);
  const outcome = commitDraft({ resultFile: draft.resultFile, cwd: fixture.work });
  assert.equal(outcome.status, "draft_committed");
  assert.equal(outcome.articlesCreated, 1);
  assert.equal(outcome.shouldPublish, false);
  assert.deepEqual(git(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], fixture.work)
    .split(/\r?\n/), [draft.relativePath]);
  assert.match(git(["log", "-1", "--pretty=%B"], fixture.work), /^blog: add daily draft 2026-09-12$/);
  assert.match(git(["--git-dir", fixture.remote, "show", "main:" + draft.relativePath], fixture.root),
    /published: false/);
  assert.equal(fs.readFileSync(path.join(fixture.work, "content", "articles", "existing.md"), "utf8"), existingBefore);
  assert.match(git(["status", "--short"], fixture.work), /\?\? unrelated\.tmp/);
});

test("Invalid destination and non-Markdown paths fail before staging", async t => {
  await t.test("outside content/articles", () => {
    const fixture = initRepository(t);
    const draft = createDraft(fixture);
    const outside = path.join(fixture.work, "outside.md");
    fs.renameSync(draft.filePath, outside);
    const value = JSON.parse(fs.readFileSync(draft.resultFile, "utf8"));
    value.draft.filePath = outside;
    value.draft.filename = "outside.md";
    value.draft.slug = "outside";
    fs.writeFileSync(draft.resultFile, JSON.stringify(value));
    assert.throws(() => commitDraft({ resultFile: draft.resultFile, cwd: fixture.work }),
      { code: "DRAFT_PATH_INVALID" });
    assert.equal(git(["diff", "--cached", "--name-only"], fixture.work), "");
  });
  await t.test("wrong extension", () => {
    const fixture = initRepository(t);
    const draft = createDraft(fixture);
    const textPath = draft.filePath.replace(/\.md$/, ".txt");
    fs.renameSync(draft.filePath, textPath);
    const value = JSON.parse(fs.readFileSync(draft.resultFile, "utf8"));
    value.draft.filePath = textPath;
    value.draft.filename = path.basename(textPath);
    fs.writeFileSync(draft.resultFile, JSON.stringify(value));
    assert.throws(() => commitDraft({ resultFile: draft.resultFile, cwd: fixture.work }),
      { code: "DRAFT_PATH_INVALID" });
  });
});

test("Tracked modifications and an existing staged file stop the commit", async t => {
  await t.test("tracked modification", () => {
    const fixture = initRepository(t);
    const draft = createDraft(fixture);
    fs.appendFileSync(path.join(fixture.work, "README.md"), "changed\n");
    assert.throws(() => commitDraft({ resultFile: draft.resultFile, cwd: fixture.work }),
      { code: "DRAFT_REPOSITORY_NOT_CLEAN" });
  });
  await t.test("pre-staged file", () => {
    const fixture = initRepository(t);
    const draft = createDraft(fixture);
    fs.writeFileSync(path.join(fixture.work, "other.txt"), "other\n");
    git(["add", "--", "other.txt"], fixture.work);
    assert.throws(() => commitDraft({ resultFile: draft.resultFile, cwd: fixture.work }),
      { code: "DRAFT_REPOSITORY_NOT_CLEAN" });
  });
});

test("An updated origin/main stops safely without merge, rebase or push", t => {
  const fixture = initRepository(t);
  const peer = path.join(fixture.root, "peer");
  git(["clone", fixture.remote, peer], fixture.root);
  git(["config", "user.name", "Peer User"], peer);
  git(["config", "user.email", "peer@example.invalid"], peer);
  fs.writeFileSync(path.join(peer, "peer.txt"), "new remote work\n");
  git(["add", "--", "peer.txt"], peer);
  git(["commit", "-m", "peer update"], peer);
  git(["push", "origin", "main"], peer);
  const draft = createDraft(fixture);
  const headBefore = git(["rev-parse", "HEAD"], fixture.work);
  assert.throws(() => commitDraft({ resultFile: draft.resultFile, cwd: fixture.work }),
    { code: "DRAFT_MAIN_CHANGED" });
  assert.equal(git(["rev-parse", "HEAD"], fixture.work), headBefore);
  assert.notEqual(git(["rev-parse", "origin/main"], fixture.work), headBefore);
});

test("A rejected normal push is reported as failure and never treated as committed", t => {
  const fixture = initRepository(t);
  const draft = createDraft(fixture);
  const runGit = (args, options) => {
    if (args[0] === "push") throw new DraftCommitError(options.failureCode);
    return defaultRunGit(args, options);
  };
  let caught;
  try { commitDraft({ resultFile: draft.resultFile, cwd: fixture.work, runGit }); }
  catch (error) { caught = error; }
  assert.equal(caught.code, "DRAFT_PUSH_FAILED");
  assert.deepEqual(failureReport(caught), {
    status: "failed", error: "DRAFT_PUSH_FAILED", articlesCreated: 0, shouldPublish: false
  });
  const remoteCheck = git(["--git-dir", fixture.remote, "cat-file", "-e",
    "main:" + draft.relativePath], fixture.root, true);
  assert.notEqual(remoteCheck.status, 0);
});

test("Git implementation uses an explicit path and contains no broad add or force push", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts", "commit-draft.js"), "utf8");
  assert.match(source, /\["add", "--", draft\.relativePath\]/);
  assert.doesNotMatch(source, /\["add",\s*"\."\]/);
  assert.doesNotMatch(source, /\["add",\s*"-A"\]/);
  assert.doesNotMatch(source, /--force|push",\s*"-f"/);
});
