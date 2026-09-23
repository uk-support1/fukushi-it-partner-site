"use strict";

// Downloads a video-sourced article's YouTube thumbnail once, at generation
// time, and saves it locally like every other image on this site (never
// hotlinked). Failure at any step (network, wrong content-type, oversized)
// simply yields null so the caller falls back to the normal curated hero
// image; a thumbnail is a nice-to-have, never a reason to fail Daily Blog.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const THUMBNAIL_HOST = "i.ytimg.com";
const MAX_THUMBNAIL_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 12000;
// Kept separate from assets/images/blog-library/hero/ so discoverImages()
// (the curated, diversified stock-photo pool) never sees these: each one is
// unique to its video already, not something to catalog and reselect later.
const THUMBNAIL_DIR = "assets/images/blog-library/hero-video";

// YouTube video IDs are always exactly 11 characters from this set. Enforcing
// that shape here (rather than accepting whatever a URL happens to contain)
// keeps a hallucinated or malformed "v="/"/shorts/" value from ever reaching
// the thumbnail file path or the video link built from it.
const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

function extractYoutubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "www.youtube.com") return null;
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([\w-]+)$/);
    if (shortsMatch) return VIDEO_ID_PATTERN.test(shortsMatch[1]) ? shortsMatch[1] : null;
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v");
      return id && VIDEO_ID_PATTERN.test(id) ? id : null;
    }
    return null;
  } catch { return null; }
}

async function fetchVideoThumbnail({ sources = [], root = path.join(__dirname, "..", ".."), fetchImpl = globalThis.fetch } = {}) {
  const videoSource = Array.isArray(sources) ? sources.find(item => item && item.kind === "video" && typeof item.url === "string") : null;
  if (!videoSource) return null;
  const videoId = extractYoutubeVideoId(videoSource.url);
  if (!videoId) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`https://${THUMBNAIL_HOST}/vi/${videoId}/hqdefault.jpg`, {
      redirect: "follow", signal: controller.signal
    });
    if (!response.ok || (response.url && new URL(response.url).hostname !== THUMBNAIL_HOST)) return null;
    const type = String(response.headers && response.headers.get && response.headers.get("content-type") || "");
    if (!/^image\/jpeg/i.test(type)) return null;
    const declared = Number(response.headers && response.headers.get && response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_THUMBNAIL_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_THUMBNAIL_BYTES) return null;

    const relativePath = `${THUMBNAIL_DIR}/${videoId}.jpg`;
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    return { image: relativePath, imageAlt: "", category: "video", series: "video-thumbnail", hash,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}` };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchVideoThumbnail, extractYoutubeVideoId, THUMBNAIL_DIR };
