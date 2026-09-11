"use strict";

const fs = require("fs");
const path = require("path");
const lib = require("./lib/articles");
const { generateBlog } = require("./generate-blog");
const { DraftCommitError, defaultRunGit } = require("./commit-draft");

function fail(code) { throw new DraftCommitError(code); }
function nulList(value) { return String(value || "").split("\0").filter(Boolean); }

function readJsonFile(file, code) {
  if (typeof file !== "string" || !file.trim()) fail(code);
  let raw;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) fail(code);
    raw = fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error instanceof DraftCommitError) throw error;
    fail(code);
  }
  try { return JSON.parse(raw); } catch { fail(code); }
}

function sameList(actual, expected) {
  return actual.slice().sort().join("\0") === expected.slice().sort().join("\0");
}

function validateInputs(daily, committed, repoRoot, runGit) {
  if (!daily || daily.status !== "draft_saved" || daily.articlesCreated !== 1 ||
      daily.shouldPublish !== false || !daily.topic || !daily.article || !daily.draft ||
      !committed || committed.status !== "draft_committed" || committed.articlesCreated !== 1 ||
      committed.shouldPublish !== false || typeof committed.commit !== "string" ||
      !/^[0-9a-f]{40}$/.test(committed.commit) ||
      typeof committed.slug !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(committed.slug) ||
      typeof committed.file !== "string" || typeof daily.draft.filePath !== "string" ||
      typeof daily.draft.filename !== "string" || typeof daily.draft.slug !== "string" ||
      committed.slug !== daily.draft.slug || committed.file !== "content/articles/" + daily.draft.filename) {
    fail("PUBLICATION_RESULT_INVALID");
  }
  const expectedPath = path.resolve(repoRoot, committed.file);
  if (path.resolve(daily.draft.filePath) !== expectedPath ||
      path.dirname(expectedPath) !== path.resolve(repoRoot, "content", "articles") ||
      path.extname(expectedPath) !== ".md") fail("PUBLICATION_PATH_INVALID");
  let stat;
  try { stat = fs.lstatSync(expectedPath); } catch { fail("PUBLICATION_FILE_MISSING"); }
  if (!stat.isFile() || stat.isSymbolicLink()) fail("PUBLICATION_PATH_INVALID");

  const committedFiles = nulList(runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z",
    committed.commit], { cwd: repoRoot }));
  const committedAdds = nulList(runGit(["diff-tree", "--no-commit-id", "--diff-filter=A",
    "--name-only", "-r", "-z", committed.commit], { cwd: repoRoot }));
  if (!sameList(committedFiles, [committed.file]) || !sameList(committedAdds, [committed.file])) {
    fail("PUBLICATION_DRAFT_COMMIT_INVALID");
  }
  return { articlePath: expectedPath, articleRelative: committed.file, slug: committed.slug };
}

function requireCleanRepository(repoRoot, runGit) {
  if (nulList(runGit(["diff", "--name-only", "-z"], { cwd: repoRoot })).length ||
      nulList(runGit(["diff", "--cached", "--name-only", "-z"], { cwd: repoRoot })).length ||
      nulList(runGit(["ls-files", "--others", "--exclude-standard", "-z"], { cwd: repoRoot })).length) {
    fail("PUBLICATION_REPOSITORY_NOT_CLEAN");
  }
}

function requireCurrentMain(repoRoot, expectedCommit, runGit) {
  runGit(["fetch", "--no-tags", "origin", "main"],
    { cwd: repoRoot, failureCode: "PUBLICATION_FETCH_FAILED" });
  const head = String(runGit(["rev-parse", "HEAD"], { cwd: repoRoot })).trim();
  const remote = String(runGit(["rev-parse", "origin/main"], { cwd: repoRoot })).trim();
  if (head !== expectedCommit || remote !== expectedCommit) fail("PUBLICATION_MAIN_CHANGED");
}

function publishMarkdown(articlePath, daily) {
  let raw;
  try { raw = fs.readFileSync(articlePath, "utf8"); }
  catch { fail("PUBLICATION_FILE_MISSING"); }
  let parsed;
  try { parsed = lib.parseFrontmatter(raw); }
  catch { fail("PUBLICATION_MARKDOWN_INVALID"); }
  if (parsed.data.published === true) fail("PUBLICATION_ALREADY_PUBLISHED");
  if (parsed.data.published !== false || parsed.data.slug !== daily.draft.slug ||
      parsed.data.title !== daily.article.title || parsed.data.description !== daily.article.description ||
      parsed.data.category_label !== daily.topic.category ||
      parsed.body.trim() !== String(daily.article.bodyMarkdown || "").trim()) {
    fail("PUBLICATION_MARKDOWN_INVALID");
  }
  const matches = raw.match(/^published:\s*false\s*$/gm) || [];
  if (matches.length !== 1) fail("PUBLICATION_MARKDOWN_INVALID");
  const updated = raw.replace(/^published:\s*false\s*$/m, "published: true");
  try { fs.writeFileSync(articlePath, updated, "utf8"); }
  catch { fail("PUBLICATION_MARKDOWN_WRITE_FAILED"); }
}

function validateGeneratedFiles(repoRoot, target, daily, runGit) {
  const htmlRelative = "blog/" + target.slug + ".html";
  const expected = [
    target.articleRelative,
    htmlRelative,
    "blog.html",
    "sitemap.xml",
    "data/blog-index.json"
  ];
  for (const relative of expected) {
    const absolute = path.join(repoRoot, ...relative.split("/"));
    if (!fs.existsSync(absolute) || !fs.lstatSync(absolute).isFile() ||
        fs.lstatSync(absolute).isSymbolicLink()) fail("PUBLICATION_OUTPUT_INVALID");
  }
  const trackedChanges = nulList(runGit(["diff", "--name-only", "-z"], { cwd: repoRoot }));
  const untracked = nulList(runGit(["ls-files", "--others", "--exclude-standard", "-z"], { cwd: repoRoot }));
  if (!sameList(trackedChanges, expected.filter(file => file !== htmlRelative)) ||
      !sameList(untracked, [htmlRelative])) fail("PUBLICATION_OUTPUT_SET_INVALID");

  const index = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "blog-index.json"), "utf8"));
  if (index.filter(item => item.slug === target.slug).length !== 1 ||
      !fs.readFileSync(path.join(repoRoot, "blog.html"), "utf8").includes("blog/" + target.slug + ".html") ||
      !fs.readFileSync(path.join(repoRoot, "sitemap.xml"), "utf8")
        .includes("https://fukushi-it-partner.com/blog/" + target.slug + ".html") ||
      !fs.readFileSync(path.join(repoRoot, "blog", target.slug + ".html"), "utf8")
        .includes('<link rel="canonical" href="https://fukushi-it-partner.com/blog/' + target.slug + '.html">')) {
    fail("PUBLICATION_OUTPUT_INVALID");
  }
  const article = lib.parseFrontmatter(fs.readFileSync(target.articlePath, "utf8"));
  if (article.data.published !== true || article.data.slug !== daily.draft.slug) {
    fail("PUBLICATION_MARKDOWN_INVALID");
  }
  return expected;
}

function publishDraft({
  dailyResultFile = process.env.DAILY_BLOG_RESULT_FILE,
  commitResultFile = process.env.DAILY_DRAFT_COMMIT_RESULT_FILE,
  cwd = process.cwd(),
  runGit = defaultRunGit,
  generate = generateBlog
} = {}) {
  const daily = readJsonFile(dailyResultFile, "PUBLICATION_DAILY_RESULT_INVALID");
  const committed = readJsonFile(commitResultFile, "PUBLICATION_COMMIT_RESULT_INVALID");
  const repoRoot = path.resolve(String(runGit(["rev-parse", "--show-toplevel"],
    { cwd, failureCode: "PUBLICATION_REPOSITORY_INVALID" })).trim());
  if (String(runGit(["branch", "--show-current"], { cwd: repoRoot })).trim() !== "main") {
    fail("PUBLICATION_BRANCH_INVALID");
  }
  requireCleanRepository(repoRoot, runGit);
  const target = validateInputs(daily, committed, repoRoot, runGit);
  const htmlPath = path.join(repoRoot, "blog", target.slug + ".html");
  if (fs.existsSync(htmlPath)) fail("PUBLICATION_OUTPUT_EXISTS");
  requireCurrentMain(repoRoot, committed.commit, runGit);

  publishMarkdown(target.articlePath, daily);
  const generated = generate({ root: repoRoot, onlySlug: target.slug });
  const expectedGenerated = [
    "data/blog-index.json", "blog/" + target.slug + ".html", "blog.html", "sitemap.xml"
  ];
  if (!generated || !sameList(generated.files, expectedGenerated)) fail("PUBLICATION_OUTPUT_INVALID");
  const expected = validateGeneratedFiles(repoRoot, target, daily, runGit);
  requireCurrentMain(repoRoot, committed.commit, runGit);

  runGit(["add", "--", ...expected], { cwd: repoRoot, failureCode: "PUBLICATION_STAGE_FAILED" });
  const staged = nulList(runGit(["diff", "--cached", "--name-only", "-z"], { cwd: repoRoot }));
  if (!sameList(staged, expected)) fail("PUBLICATION_STAGE_INVALID");
  const added = nulList(runGit(["diff", "--cached", "--diff-filter=A", "--name-only", "-z"],
    { cwd: repoRoot }));
  if (!sameList(added, ["blog/" + target.slug + ".html"])) fail("PUBLICATION_STAGE_INVALID");

  runGit(["config", "user.name", "github-actions[bot]"], { cwd: repoRoot });
  runGit(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"],
    { cwd: repoRoot });
  const message = "blog: publish daily article " + daily.localDate;
  runGit(["commit", "-m", message], { cwd: repoRoot, failureCode: "PUBLICATION_COMMIT_FAILED" });
  const commit = String(runGit(["rev-parse", "HEAD"], { cwd: repoRoot })).trim();
  const committedFiles = nulList(runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", commit],
    { cwd: repoRoot }));
  if (!sameList(committedFiles, expected)) fail("PUBLICATION_COMMIT_INVALID");

  runGit(["fetch", "--no-tags", "origin", "main"],
    { cwd: repoRoot, failureCode: "PUBLICATION_FETCH_FAILED" });
  const remote = String(runGit(["rev-parse", "origin/main"], { cwd: repoRoot })).trim();
  const parent = String(runGit(["rev-parse", commit + "^"], { cwd: repoRoot })).trim();
  if (remote !== parent) fail("PUBLICATION_MAIN_CHANGED");
  runGit(["push", "origin", "HEAD:main"], { cwd: repoRoot, failureCode: "PUBLICATION_PUSH_FAILED" });

  return {
    status: "publication_committed",
    articlesCreated: 1,
    shouldPublish: true,
    localDate: daily.localDate,
    slug: target.slug,
    file: target.articleRelative,
    commit
  };
}

function failureReport(error) {
  return {
    status: "failed",
    error: error instanceof DraftCommitError ? error.code : "PUBLICATION_FAILED",
    articlesCreated: 0,
    shouldPublish: false
  };
}

if (require.main === module) {
  try {
    console.log(JSON.stringify(publishDraft(), null, 2));
  } catch (error) {
    console.error(JSON.stringify(failureReport(error)));
    process.exitCode = 1;
  }
}

module.exports = {
  readJsonFile,
  validateInputs,
  publishMarkdown,
  validateGeneratedFiles,
  publishDraft,
  failureReport
};
