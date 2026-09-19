"use strict";

const fs = require("fs");
const path = require("path");

// "video" sources are individual creators' commentary/experience, not official
// documents; article-generator.js treats them with extra care (see `kind`).
const DEFAULT_SOURCES = Object.freeze([
  { name: "厚生労働省", url: "https://www.mhlw.go.jp/stf/news.rdf", priority: 1 },
  { name: "福祉医療機構（WAM NET）", url: "https://www.wam.go.jp/gyoseiShiryou/new_rss", priority: 1 },
  { name: "デジタル庁", url: "https://www.digital.go.jp/rss/news.xml", priority: 2 },
  { name: "内閣府", url: "https://www.cao.go.jp/rss/news.rdf", priority: 4 },
  { name: "精神保健福祉士うさぎ", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCfG0XDjNIjHm2vmrChrL4SQ", priority: 3, kind: "video" },
  { name: "精神科医がこころの病気を解説するCh（益田裕介）", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC7C5oRm6cGgbjJdPPEVeNMA", priority: 3, kind: "video" },
  { name: "WithYouチャンネル（精神・発達専門の就労移行支援）", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYG77cJbgyh0clabzxFN6pg", priority: 3, kind: "video" },
  { name: "ケアきょう（介護職のためのチャンネル）", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCNkibDFHKRpY3KNm-jTTIsQ", priority: 3, kind: "video" }
]);
const ALLOWED_HOSTS = new Set(["www.mhlw.go.jp", "www.wam.go.jp", "www.digital.go.jp", "www.cao.go.jp", "www.youtube.com"]);
// Hosts whose article page is a JS-rendered app, not prose: enrichCandidate()
// would scrape UI/script noise instead of real text, so it is skipped for them.
const NO_ENRICH_HOSTS = new Set(["www.youtube.com"]);
const RELEVANT_TERMS = [
  "障害", "福祉", "就労", "雇用", "共同生活", "グループホーム", "精神", "こども", "子ども",
  "デジタル", "dx", "ai", "it", "情報", "システム", "業務", "効率", "広報", "ウェブ", "web",
  "ホームページ", "検索", "補助", "助成", "支援", "事業者", "法人", "手話", "介護"
];
const MAX_FEED_BYTES = 1_000_000;
const MAX_PAGE_BYTES = 1_500_000;
// Out of the final candidate list (max 10), no single source may take more
// than this many seats on the first pass. See collectLatestInfo.
const PER_SOURCE_CAP = 3;

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanText(value, max = 500) {
  return decodeXml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function tag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) return cleanText(match[1], 2000);
  }
  return "";
}

function linkOf(block) {
  const atom = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  return cleanText(atom ? atom[1] : tag(block, ["link"]), 2000);
}

function safeOfficialUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

function parseFeed(xml, source) {
  if (typeof xml !== "string" || Buffer.byteLength(xml, "utf8") > MAX_FEED_BYTES) return [];
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
  return blocks.map(block => {
    const title = tag(block, ["title"]);
    const url = safeOfficialUrl(linkOf(block));
    const rawDate = tag(block, ["dc:date", "pubDate", "published", "updated"]);
    const parsedDate = Date.parse(rawDate);
    const publishedAt = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : "";
    const summary = cleanText(tag(block, ["media:description", "description", "summary", "content", "content:encoded"]) || title);
    return title && url && publishedAt
      ? { title, url, publishedAt, source: source.name, summary, ...(source.kind ? { kind: source.kind } : {}) }
      : null;
  }).filter(Boolean);
}

function relevance(candidate) {
  const text = `${candidate.title} ${candidate.summary}`.normalize("NFKC").toLowerCase();
  return RELEVANT_TERMS.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

async function fetchFeed(source, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchImpl(source.url, {
      headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw new Error("FEED_HTTP_ERROR");
    const declared = Number(response.headers && response.headers.get && response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE");
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_FEED_BYTES) throw new Error("FEED_TOO_LARGE");
    return parseFeed(body, source);
  } finally { clearTimeout(timer); }
}

function pageSummary(html) {
  if (typeof html !== "string") return "";
  let body = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (main) body = main[1];
  return cleanText(body, 4000);
}

async function enrichCandidate(candidate, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchImpl(candidate.url, {headers:{Accept:"text/html"},redirect:"follow",signal:controller.signal});
    if (!response.ok || (response.url && !safeOfficialUrl(response.url))) return candidate;
    const type = String(response.headers && response.headers.get && response.headers.get("content-type") || "");
    const declared = Number(response.headers && response.headers.get && response.headers.get("content-length"));
    if (!/text\/html|application\/xhtml\+xml/i.test(type) || (Number.isFinite(declared) && declared > MAX_PAGE_BYTES)) return candidate;
    const body = await response.text();
    if (Buffer.byteLength(body,"utf8") > MAX_PAGE_BYTES) return candidate;
    const summary = pageSummary(body);
    return summary.length >= 100 ? {...candidate,summary} : candidate;
  } catch { return candidate; }
  finally { clearTimeout(timer); }
}

async function collectLatestInfo({fetchImpl = globalThis.fetch, now = new Date(), sources = DEFAULT_SOURCES, limit = 10, extraCandidates = []} = {}) {
  const settled = await Promise.allSettled(sources.map(source => fetchFeed(source, fetchImpl)));
  // A week keeps articles feeling timely; the evergreen fallback already covers
  // days when nothing relevant published this recently (see topic-selector.js).
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const rows = [];
  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    for (const item of result.value) {
      const score = relevance(item);
      const time = Date.parse(item.publishedAt);
      if (score > 0 && time >= cutoff && time <= now.getTime() + 24 * 60 * 60 * 1000) {
        rows.push({...item, score, priority:sources[index].priority});
      }
    }
  });
  // Pre-fetched candidates (e.g. the self-hosted YouTube cache) go through the
  // same relevance/freshness/dedup pipeline as a live-fetched source would.
  for (const item of extraCandidates) {
    if (!item || typeof item.title !== "string" || typeof item.publishedAt !== "string" || !safeOfficialUrl(item.url)) continue;
    const score = relevance(item);
    const time = Date.parse(item.publishedAt);
    if (score > 0 && time >= cutoff && time <= now.getTime() + 24 * 60 * 60 * 1000) {
      rows.push({...item, score, priority: item.priority ?? 3});
    }
  }
  const seenUrls = new Set(), seenTitles = new Set();
  const deduped = rows.sort((a,b) => b.score-a.score || Date.parse(b.publishedAt)-Date.parse(a.publishedAt) || a.priority-b.priority)
    .filter(item => {
      const title = item.title.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
      if (seenUrls.has(item.url) || seenTitles.has(title)) return false;
      seenUrls.add(item.url); seenTitles.add(title); return true;
    });
  const maxTotal = Math.max(3, Math.min(10, limit));
  // A single prolific source (e.g. a channel that repeats the same promotional
  // boilerplate in every description, inflating relevance for unrelated
  // videos too) must not crowd out every other source. Cap it, but only after
  // every source has had a fair shot at PER_SOURCE_CAP slots each; overflow
  // fills any remaining seats so this never shrinks the candidate count.
  const sourceCounts = new Map(), primary = [], overflow = [];
  for (const item of deduped) {
    const count = sourceCounts.get(item.source) || 0;
    if (count < PER_SOURCE_CAP) { primary.push(item); sourceCounts.set(item.source, count + 1); }
    else overflow.push(item);
  }
  const ranked = [...primary, ...overflow].slice(0, maxTotal).map(({score,priority,...item}) => item);
  const enrichable = item => { try { return !NO_ENRICH_HOSTS.has(new URL(item.url).hostname); } catch { return false; } };
  const candidates = await Promise.all(ranked.map(item => enrichable(item) ? enrichCandidate(item,fetchImpl) : item));
  return { candidates, attemptedSources:sources.length,
    successfulSources:settled.filter(result => result.status === "fulfilled").length };
}

const YOUTUBE_CACHE_MAX_AGE_DAYS = 7;
const YOUTUBE_CACHE_FILE = path.join(__dirname, "..", "data", "youtube-cache.json");

// Populated by the self-hosted youtube-cache workflow (scripts/fetch-youtube-cache.js),
// which runs on a home network that YouTube does not block, unlike GitHub's
// shared cloud runners. Stale or missing data safely yields no candidates.
function loadYoutubeCache({ file = YOUTUBE_CACHE_FILE, now = new Date(), maxAgeDays = YOUTUBE_CACHE_MAX_AGE_DAYS } = {}) {
  let data;
  try { data = JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
  if (!data || typeof data.fetchedAt !== "string" || !Array.isArray(data.candidates)) return [];
  const age = now.getTime() - Date.parse(data.fetchedAt);
  if (!Number.isFinite(age) || age < 0 || age > maxAgeDays * 24 * 60 * 60 * 1000) return [];
  return data.candidates.filter(item => item && typeof item.title === "string" && typeof item.url === "string" &&
    typeof item.publishedAt === "string" && typeof item.source === "string" && typeof item.summary === "string" &&
    safeOfficialUrl(item.url));
}

module.exports = { DEFAULT_SOURCES, ALLOWED_HOSTS, NO_ENRICH_HOSTS, YOUTUBE_CACHE_FILE, YOUTUBE_CACHE_MAX_AGE_DAYS, PER_SOURCE_CAP,
  parseFeed, collectLatestInfo, safeOfficialUrl, relevance, pageSummary, loadYoutubeCache };
