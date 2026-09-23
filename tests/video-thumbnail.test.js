"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { fetchVideoThumbnail, extractYoutubeVideoId, THUMBNAIL_DIR } = require("../scripts/lib/video-thumbnail");

function fixtureRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "video-thumbnail-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5]);
function imageResponse({ body = jpegBytes, contentType = "image/jpeg", ok = true, status = 200, url } = {}) {
  return {
    ok, status, url,
    headers: { get: name => name === "content-type" ? contentType : name === "content-length" ? String(body.byteLength) : null },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
  };
}

const videoSource = { title: "動画タイトル", url: "https://www.youtube.com/watch?v=k596ZRNsvsU",
  publishedAt: "2026-09-16T09:00:39.000Z", source: "精神保健福祉士うさぎ", summary: "説明", kind: "video" };
const officialSource = { title: "資料", url: "https://www.mhlw.go.jp/a", publishedAt: "2026-09-16T00:00:00.000Z", source: "厚生労働省", summary: "説明" };

test("extractYoutubeVideoId reads both /watch?v= and /shorts/ forms, and rejects non-YouTube URLs",()=>{
  assert.equal(extractYoutubeVideoId("https://www.youtube.com/watch?v=k596ZRNsvsU"),"k596ZRNsvsU");
  assert.equal(extractYoutubeVideoId("https://www.youtube.com/shorts/k596ZRNsvsU"),"k596ZRNsvsU");
  assert.equal(extractYoutubeVideoId("https://example.com/watch?v=k596ZRNsvsU"),null);
  assert.equal(extractYoutubeVideoId("not a url"),null);
});

test("extractYoutubeVideoId rejects an id that isn't exactly 11 safe characters (regression: path traversal via v=)",()=>{
  assert.equal(extractYoutubeVideoId("https://www.youtube.com/watch?v=../../etc/passwd"),null);
  assert.equal(extractYoutubeVideoId("https://www.youtube.com/watch?v=tooshort"),null);
  assert.equal(extractYoutubeVideoId("https://www.youtube.com/watch?v=waytoolongtobeanid"),null);
  assert.equal(extractYoutubeVideoId("https://www.youtube.com/shorts/../../etc/passwd"),null);
});

test("downloads and saves the thumbnail, returning a hero-shaped result with a real sha256 hash",async t=>{
  const root = fixtureRoot(t);
  let requestedUrl;
  const result = await fetchVideoThumbnail({ sources: [officialSource, videoSource], root,
    fetchImpl: async url => { requestedUrl = url; return imageResponse({ url: "https://i.ytimg.com/vi/k596ZRNsvsU/hqdefault.jpg" }); } });
  assert.equal(requestedUrl, "https://i.ytimg.com/vi/k596ZRNsvsU/hqdefault.jpg");
  const expectedPath = `${THUMBNAIL_DIR}/k596ZRNsvsU.jpg`;
  assert.deepEqual(result, { image: expectedPath, imageAlt: "", category: "video", series: "video-thumbnail",
    hash: crypto.createHash("sha256").update(jpegBytes).digest("hex"),
    videoUrl: "https://www.youtube.com/watch?v=k596ZRNsvsU" });
  assert.deepEqual(fs.readFileSync(path.join(root, expectedPath)), jpegBytes);
});

test("no video-kind source in the list means no fetch is attempted at all",async t=>{
  const root = fixtureRoot(t);
  const result = await fetchVideoThumbnail({ sources: [officialSource], root, fetchImpl: async () => { throw new Error("must not fetch"); } });
  assert.equal(result, null);
});

test("every failure mode falls back to null instead of throwing, and never writes a file",async t=>{
  const cases = {
    "HTTP error": async () => imageResponse({ ok: false, status: 404 }),
    "wrong content-type": async () => imageResponse({ contentType: "text/html" }),
    "declared content-length too large": async () => ({
      ok: true, status: 200,
      headers: { get: name => name === "content-type" ? "image/jpeg" : name === "content-length" ? "5000000" : null },
      arrayBuffer: async () => jpegBytes.buffer
    }),
    "network error": async () => { throw new Error("network down"); },
    "aborted/timeout-shaped error": async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; },
    "redirected off the thumbnail host": async () => imageResponse({ url: "https://evil.example.com/vi/k596ZRNsvsU/hqdefault.jpg" })
  };
  for (const [label, fetchImpl] of Object.entries(cases)) {
    const root = fixtureRoot(t);
    const result = await fetchVideoThumbnail({ sources: [videoSource], root, fetchImpl });
    assert.equal(result, null, label);
    assert.equal(fs.existsSync(path.join(root, THUMBNAIL_DIR)), false, label);
  }
});

test("an oversized body is rejected even if the content-length header understates it",async t=>{
  const root = fixtureRoot(t);
  const big = Buffer.alloc(3_000_000, 1);
  const result = await fetchVideoThumbnail({ sources: [videoSource], root, fetchImpl: async () => ({
    ok: true, status: 200,
    headers: { get: name => name === "content-type" ? "image/jpeg" : name === "content-length" ? "10" : null },
    arrayBuffer: async () => big.buffer
  }) });
  assert.equal(result, null);
  assert.equal(fs.existsSync(path.join(root, THUMBNAIL_DIR)), false);
});
