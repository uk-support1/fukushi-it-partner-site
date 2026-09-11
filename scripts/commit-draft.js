"use strict";

const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const lib = require("./lib/articles");

class DraftCommitError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) { throw new DraftCommitError(code); }

function defaultRunGit(args, { cwd, failureCode = "DRAFT_GIT_FAILED", allowFailure = false } = {}) {
  const result = cp.spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    fail(failureCode);
  }
  return result.stdout;
}

function nulList(value) {
  return String(value || "").split("\0").filter(Boolean);
}

function readResult(resultFile) {
  if (typeof resultFile !== "string" || !resultFile.trim()) fail("DRAFT_RESULT_FILE_MISSING");
  let raw;
  try {
    const stat = fs.lstatSync(resultFile);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) fail("DRAFT_RESULT_INVALID");
    raw = fs.readFileSync(resultFile, "utf8");
  } catch (error) {
    if (error instanceof DraftCommitError) throw error;
    fail("DRAFT_RESULT_INVALID");
  }
  let result;
  try { result = JSON.parse(raw); } catch { fail("DRAFT_RESULT_INVALID"); }
  if (!result || typeof result !== "object" || Array.isArray(result) ||
      result.status !== "draft_saved" || result.articlesCreated !== 1 || result.shouldPublish !== false ||
      typeof result.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(result.localDate) ||
      !result.topic || !result.article || !result.draft) fail("DRAFT_RESULT_INVALID");
  return result;
}

function validateDraft(result, repoRoot, runGit) {
  const articlesDir = path.resolve(repoRoot, "content", "articles");
  if (typeof result.draft.filePath !== "string" || typeof result.draft.filename !== "string" ||
      typeof result.draft.slug !== "string") fail("DRAFT_PATH_INVALID");
  const filePath = path.resolve(result.draft.filePath);
  const filename = path.basename(filePath);
  if (path.dirname(filePath) !== articlesDir || path.extname(filename) !== ".md" ||
      result.draft.filename !== filename || result.draft.slug + ".md" !== filename) {
    fail("DRAFT_PATH_INVALID");
  }
  let stat;
  try { stat = fs.lstatSync(filePath); } catch { fail("DRAFT_FILE_MISSING"); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail("DRAFT_PATH_INVALID");

  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join("/");
  if (relativePath !== "content/articles/" + filename) fail("DRAFT_PATH_INVALID");
  if (runGit(["ls-files", "--error-unmatch", "--", relativePath],
      { cwd: repoRoot, allowFailure: true }) !== null) fail("DRAFT_NOT_NEW");
  const untracked = nulList(runGit(["ls-files", "--others", "--exclude-standard", "-z", "--", relativePath],
    { cwd: repoRoot }));
  if (untracked.length !== 1 || untracked[0] !== relativePath) fail("DRAFT_NOT_NEW");

  let parsed;
  try { parsed = lib.parseFrontmatter(fs.readFileSync(filePath, "utf8")); }
  catch { fail("DRAFT_MARKDOWN_INVALID"); }
  if (parsed.data.published !== false || parsed.data.slug !== result.draft.slug ||
      parsed.data.title !== result.article.title || parsed.data.description !== result.article.description ||
      parsed.data.category_label !== result.topic.category ||
      parsed.body.trim() !== String(result.article.bodyMarkdown || "").trim()) {
    fail("DRAFT_MARKDOWN_INVALID");
  }
  return { filePath, relativePath };
}

function requireCleanTrackedState(repoRoot, runGit) {
  if (nulList(runGit(["diff", "--name-only", "-z"], { cwd: repoRoot })).length ||
      nulList(runGit(["diff", "--cached", "--name-only", "-z"], { cwd: repoRoot })).length) {
    fail("DRAFT_REPOSITORY_NOT_CLEAN");
  }
}

function commitDraft({ resultFile = process.env.DAILY_BLOG_RESULT_FILE, cwd = process.cwd(),
  runGit = defaultRunGit } = {}) {
  const result = readResult(resultFile);
  const repoRoot = path.resolve(String(runGit(["rev-parse", "--show-toplevel"],
    { cwd, failureCode: "DRAFT_REPOSITORY_INVALID" })).trim());
  const branch = String(runGit(["branch", "--show-current"], { cwd: repoRoot })).trim();
  if (branch !== "main") fail("DRAFT_BRANCH_INVALID");
  requireCleanTrackedState(repoRoot, runGit);
  const draft = validateDraft(result, repoRoot, runGit);

  runGit(["fetch", "--no-tags", "origin", "main"], { cwd: repoRoot, failureCode: "DRAFT_FETCH_FAILED" });
  const baseCommit = String(runGit(["rev-parse", "HEAD"], { cwd: repoRoot })).trim();
  const remoteCommit = String(runGit(["rev-parse", "origin/main"], { cwd: repoRoot })).trim();
  if (baseCommit !== remoteCommit) fail("DRAFT_MAIN_CHANGED");

  runGit(["add", "--", draft.relativePath], { cwd: repoRoot, failureCode: "DRAFT_STAGE_FAILED" });
  const staged = nulList(runGit(["diff", "--cached", "--name-only", "-z"], { cwd: repoRoot }));
  const stagedAdded = nulList(runGit(["diff", "--cached", "--diff-filter=A", "--name-only", "-z"],
    { cwd: repoRoot }));
  if (staged.length !== 1 || staged[0] !== draft.relativePath ||
      stagedAdded.length !== 1 || stagedAdded[0] !== draft.relativePath) fail("DRAFT_STAGE_INVALID");

  runGit(["config", "user.name", "github-actions[bot]"], { cwd: repoRoot });
  runGit(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { cwd: repoRoot });
  const message = "blog: add daily draft " + result.localDate;
  runGit(["commit", "-m", message], { cwd: repoRoot, failureCode: "DRAFT_COMMIT_FAILED" });
  const commit = String(runGit(["rev-parse", "HEAD"], { cwd: repoRoot })).trim();
  const committed = nulList(runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", commit],
    { cwd: repoRoot }));
  if (committed.length !== 1 || committed[0] !== draft.relativePath) fail("DRAFT_COMMIT_INVALID");

  runGit(["fetch", "--no-tags", "origin", "main"], { cwd: repoRoot, failureCode: "DRAFT_FETCH_FAILED" });
  const latestRemote = String(runGit(["rev-parse", "origin/main"], { cwd: repoRoot })).trim();
  const parent = String(runGit(["rev-parse", commit + "^"], { cwd: repoRoot })).trim();
  if (latestRemote !== parent) fail("DRAFT_MAIN_CHANGED");
  runGit(["push", "origin", "HEAD:main"], { cwd: repoRoot, failureCode: "DRAFT_PUSH_FAILED" });

  return {
    status: "draft_committed",
    articlesCreated: 1,
    shouldPublish: false,
    localDate: result.localDate,
    slug: result.draft.slug,
    file: draft.relativePath,
    commit
  };
}

function failureReport(error) {
  return {
    status: "failed",
    error: error instanceof DraftCommitError ? error.code : "DRAFT_COMMIT_FAILED",
    articlesCreated: 0,
    shouldPublish: false
  };
}

function writeCommitResult(result, resultFile) {
  if (!resultFile) return;
  try {
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + "\n",
      { encoding: "utf8", flag: "wx" });
  } catch {
    fail("DRAFT_COMMIT_RESULT_SAVE_FAILED");
  }
}

if (require.main === module) {
  try {
    const result = commitDraft();
    writeCommitResult(result, process.env.DAILY_DRAFT_COMMIT_RESULT_FILE);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify(failureReport(error)));
    process.exitCode = 1;
  }
}

module.exports = {
  DraftCommitError,
  defaultRunGit,
  readResult,
  validateDraft,
  commitDraft,
  failureReport,
  writeCommitResult
};
