"use strict";

// Runs daily on a GitHub cloud runner (see .github/workflows/youtube-cache.yml).
// This script only ever touches data/youtube-cache.json; it must never be
// relied on for Daily Blog's own reliability (see docs/daily-blog.md).
const cp = require("child_process");
const fs = require("fs");
const path = require("path");
const { DEFAULT_SOURCES, collectLatestInfo, loadYoutubeCache } = require("./latest-info");

class YoutubeCacheError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function fail(code) { throw new YoutubeCacheError(code); }

function defaultRunGit(args, { cwd, failureCode = "YOUTUBE_CACHE_GIT_FAILED", allowFailure = false } = {}) {
  const result = cp.spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) {
    if (allowFailure) return null;
    fail(failureCode);
  }
  return result.stdout;
}

function nulList(value) { return String(value || "").split("\0").filter(Boolean); }

const sleepMs = ms => new Promise(resolve => setTimeout(resolve, ms));

// A channel's feed only lists its latest ~15 videos, so a month of history can't
// be fetched directly; instead each run folds the previous cache back in
// (collect's extraCandidates) and keeps up to 30 days of videos. `previous`
// carries videos not yet used as an article source across days the machine was off.
async function fetchYoutubeCache({ now = new Date(), collect = collectLatestInfo, previous = loadYoutubeCache({ now }),
  attempts = 3, retryDelayMs = 30000, sleep = sleepMs } = {}) {
  const videoSources = DEFAULT_SOURCES.filter(source => source.kind === "video");
  let result;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    result = await collect({ now, sources: videoSources, limit: 60, maxAgeDays: 30, extraCandidates: previous });
    if (result.successfulSources > 0) break;
    // Often just a network that isn't up yet right after the PC boots.
    if (attempt < attempts) await sleep(retryDelayMs);
  }
  // Every feed failing means "we learned nothing", not "there are no videos".
  // Writing an empty cache would erase the backlog and look freshly checked.
  if (!(result.successfulSources > 0)) fail("YOUTUBE_FETCH_ALL_FAILED");
  return {
    fetchedAt: now.toISOString(),
    candidates: result.candidates,
    attemptedSources: result.attemptedSources,
    successfulSources: result.successfulSources
  };
}

function writeAndCommitCache({ cache, cwd = process.cwd(), runGit = defaultRunGit } = {}) {
  const repoRoot = path.resolve(String(runGit(["rev-parse", "--show-toplevel"],
    { cwd, failureCode: "YOUTUBE_CACHE_REPOSITORY_INVALID" })).trim());
  const branch = String(runGit(["branch", "--show-current"], { cwd: repoRoot })).trim();
  if (branch !== "main") fail("YOUTUBE_CACHE_BRANCH_INVALID");
  if (nulList(runGit(["diff", "--name-only", "-z"], { cwd: repoRoot })).length ||
      nulList(runGit(["diff", "--cached", "--name-only", "-z"], { cwd: repoRoot })).length) {
    fail("YOUTUBE_CACHE_REPOSITORY_NOT_CLEAN");
  }

  const relativePath = "data/youtube-cache.json";
  const filePath = path.join(repoRoot, relativePath);
  fs.writeFileSync(filePath, JSON.stringify({ fetchedAt: cache.fetchedAt, candidates: cache.candidates }, null, 2) + "\n", "utf8");

  runGit(["fetch", "--no-tags", "origin", "main"], { cwd: repoRoot, failureCode: "YOUTUBE_CACHE_FETCH_FAILED" });
  const baseCommit = String(runGit(["rev-parse", "HEAD"], { cwd: repoRoot })).trim();
  const remoteCommit = String(runGit(["rev-parse", "origin/main"], { cwd: repoRoot })).trim();
  if (baseCommit !== remoteCommit) fail("YOUTUBE_CACHE_MAIN_CHANGED");

  runGit(["add", "--", relativePath], { cwd: repoRoot, failureCode: "YOUTUBE_CACHE_STAGE_FAILED" });
  const staged = nulList(runGit(["diff", "--cached", "--name-only", "-z"], { cwd: repoRoot }));
  if (staged.length === 0) return { status: "youtube_cache_unchanged", candidateCount: cache.candidates.length };
  if (staged.length !== 1 || staged[0] !== relativePath) fail("YOUTUBE_CACHE_STAGE_INVALID");

  runGit(["config", "user.name", "github-actions[bot]"], { cwd: repoRoot });
  runGit(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { cwd: repoRoot });
  runGit(["commit", "-m", "chore: refresh YouTube candidate cache " + cache.fetchedAt.slice(0, 10)],
    { cwd: repoRoot, failureCode: "YOUTUBE_CACHE_COMMIT_FAILED" });
  const commit = String(runGit(["rev-parse", "HEAD"], { cwd: repoRoot })).trim();
  const committed = nulList(runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", commit], { cwd: repoRoot }));
  if (committed.length !== 1 || committed[0] !== relativePath) fail("YOUTUBE_CACHE_COMMIT_INVALID");

  runGit(["fetch", "--no-tags", "origin", "main"], { cwd: repoRoot, failureCode: "YOUTUBE_CACHE_FETCH_FAILED" });
  const latestRemote = String(runGit(["rev-parse", "origin/main"], { cwd: repoRoot })).trim();
  const parent = String(runGit(["rev-parse", commit + "^"], { cwd: repoRoot })).trim();
  if (latestRemote !== parent) fail("YOUTUBE_CACHE_MAIN_CHANGED");
  runGit(["push", "origin", "HEAD:main"], { cwd: repoRoot, failureCode: "YOUTUBE_CACHE_PUSH_FAILED" });

  return { status: "youtube_cache_updated", candidateCount: cache.candidates.length, commit };
}

function failureReport(error) {
  return { status: "failed", error: error instanceof YoutubeCacheError ? error.code : "YOUTUBE_CACHE_FAILED" };
}

if (require.main === module) {
  fetchYoutubeCache().then(cache => {
    const result = writeAndCommitCache({ cache });
    console.log(JSON.stringify({ ...result, attemptedSources: cache.attemptedSources, successfulSources: cache.successfulSources }, null, 2));
  }).catch(error => {
    console.error(JSON.stringify(failureReport(error)));
    process.exitCode = 1;
  });
}

module.exports = { YoutubeCacheError, fetchYoutubeCache, writeAndCommitCache, failureReport, defaultRunGit };
