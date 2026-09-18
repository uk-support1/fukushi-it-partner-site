"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  YoutubeCacheError,
  fetchYoutubeCache,
  writeAndCommitCache,
  failureReport,
  defaultRunGit
} = require("../scripts/fetch-youtube-cache");
const { DEFAULT_SOURCES } = require("../scripts/latest-info");

function git(args, cwd, allowFailure = false) {
  const result = cp.spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (!allowFailure && (result.error || result.status !== 0)) {
    throw new Error("test git command failed: " + args.join(" ") + "\n" + result.stderr);
  }
  return allowFailure ? result : result.stdout.trim();
}

function initRepository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "youtube-cache-git-"));
  const remote = path.join(root, "remote.git");
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  git(["init", "--bare", "--initial-branch=main", remote], root);
  git(["init", "--initial-branch=main"], work);
  git(["config", "user.name", "Test User"], work);
  git(["config", "user.email", "test@example.invalid"], work);
  fs.mkdirSync(path.join(work, "data"), { recursive: true });
  fs.writeFileSync(path.join(work, "README.md"), "fixture\n");
  git(["add", "--", "README.md"], work);
  git(["commit", "-m", "fixture"], work);
  git(["remote", "add", "origin", remote], work);
  git(["push", "-u", "origin", "main"], work);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, remote, work };
}

const cache = candidates => ({ fetchedAt: "2026-09-18T03:00:00.000Z", candidates });
const video = { title: "障がい者施設が作ったクッキーについて", url: "https://www.youtube.com/watch?v=k596ZRNsvsU",
  publishedAt: "2026-09-16T09:00:39.000Z", source: "精神保健福祉士うさぎ", summary: "福祉施設に関する動画です。", kind: "video" };

test("fetchYoutubeCache only ever live-fetches the video sources, never the official ones",async()=>{
  let seenSources;
  const result=await fetchYoutubeCache({now:new Date("2026-09-18T03:00:00Z"),
    collect:async args=>{seenSources=args.sources;return {candidates:[video],attemptedSources:4,successfulSources:4};}});
  assert.equal(seenSources.length,4);
  assert.ok(seenSources.every(source=>source.kind==="video"));
  assert.deepEqual(seenSources,DEFAULT_SOURCES.filter(source=>source.kind==="video"));
  assert.deepEqual(result,{fetchedAt:"2026-09-18T03:00:00.000Z",candidates:[video],attemptedSources:4,successfulSources:4});
});

test("A fresh cache file is written and committed, and the second run with no new content is a no-op", t => {
  const fixture = initRepository(t);
  const first = writeAndCommitCache({ cache: cache([video]), cwd: fixture.work });
  assert.equal(first.status, "youtube_cache_updated");
  assert.equal(first.candidateCount, 1);
  const saved = JSON.parse(fs.readFileSync(path.join(fixture.work, "data", "youtube-cache.json"), "utf8"));
  assert.deepEqual(saved, { fetchedAt: "2026-09-18T03:00:00.000Z", candidates: [video] });
  const committed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", first.commit], fixture.work);
  assert.equal(committed, "data/youtube-cache.json");
  // Re-running with byte-identical content stages nothing, so it must not create an empty commit.
  const headBefore = git(["rev-parse", "HEAD"], fixture.work);
  const second = writeAndCommitCache({ cache: cache([video]), cwd: fixture.work });
  assert.equal(second.status, "youtube_cache_unchanged");
  assert.equal(git(["rev-parse", "HEAD"], fixture.work), headBefore);
});

test("Zero candidates still refreshes the timestamp so freshness reflects a successful check", t => {
  const fixture = initRepository(t);
  const result = writeAndCommitCache({ cache: cache([]), cwd: fixture.work });
  assert.equal(result.status, "youtube_cache_updated");
  const saved = JSON.parse(fs.readFileSync(path.join(fixture.work, "data", "youtube-cache.json"), "utf8"));
  assert.deepEqual(saved, { fetchedAt: "2026-09-18T03:00:00.000Z", candidates: [] });
});

test("A tracked modification stops the commit before anything is staged", t => {
  const fixture = initRepository(t);
  fs.appendFileSync(path.join(fixture.work, "README.md"), "changed\n");
  assert.throws(() => writeAndCommitCache({ cache: cache([video]), cwd: fixture.work }),
    { code: "YOUTUBE_CACHE_REPOSITORY_NOT_CLEAN" });
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
  const headBefore = git(["rev-parse", "HEAD"], fixture.work);
  assert.throws(() => writeAndCommitCache({ cache: cache([video]), cwd: fixture.work }),
    { code: "YOUTUBE_CACHE_MAIN_CHANGED" });
  assert.equal(git(["rev-parse", "HEAD"], fixture.work), headBefore);
  assert.notEqual(git(["rev-parse", "origin/main"], fixture.work), headBefore);
});

test("A branch other than main is rejected", t => {
  const fixture = initRepository(t);
  git(["checkout", "-b", "not-main"], fixture.work);
  assert.throws(() => writeAndCommitCache({ cache: cache([video]), cwd: fixture.work }),
    { code: "YOUTUBE_CACHE_BRANCH_INVALID" });
});

test("A rejected push is reported as failure and leaves the remote cache file untouched", t => {
  const fixture = initRepository(t);
  const runGit = (args, options) => {
    if (args[0] === "push") throw new YoutubeCacheError(options.failureCode);
    return defaultRunGit(args, options);
  };
  let caught;
  try { writeAndCommitCache({ cache: cache([video]), cwd: fixture.work, runGit }); }
  catch (error) { caught = error; }
  assert.equal(caught.code, "YOUTUBE_CACHE_PUSH_FAILED");
  assert.deepEqual(failureReport(caught), { status: "failed", error: "YOUTUBE_CACHE_PUSH_FAILED" });
  const remoteCheck = git(["--git-dir", fixture.remote, "cat-file", "-e", "main:data/youtube-cache.json"], fixture.root, true);
  assert.notEqual(remoteCheck.status, 0);
});

test("failureReport never leaks raw errors and defaults unknown errors to a generic code",()=>{
  assert.deepEqual(failureReport(new YoutubeCacheError("YOUTUBE_CACHE_PUSH_FAILED")),
    {status:"failed",error:"YOUTUBE_CACHE_PUSH_FAILED"});
  assert.deepEqual(failureReport(new Error("some raw network detail")),
    {status:"failed",error:"YOUTUBE_CACHE_FAILED"});
});

test("Git implementation uses an explicit path and contains no broad add or force push",()=>{
  const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "fetch-youtube-cache.js"), "utf8");
  assert.ok(!/git",\s*\[\s*"add",\s*"-A"|git add -A|git add \./.test(source));
  assert.ok(!/--force|-f"\]/.test(source));
  assert.ok(!/merge|rebase/i.test(source));
});
