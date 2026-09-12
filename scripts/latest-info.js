"use strict";

const DEFAULT_SOURCES = Object.freeze([
  { name: "厚生労働省", url: "https://www.mhlw.go.jp/stf/news.rdf", priority: 1 },
  { name: "デジタル庁", url: "https://www.digital.go.jp/rss/news.xml", priority: 2 },
  { name: "内閣府", url: "https://www.cao.go.jp/rss/news.rdf", priority: 4 }
]);
const ALLOWED_HOSTS = new Set(["www.mhlw.go.jp", "www.digital.go.jp", "www.cao.go.jp"]);
const RELEVANT_TERMS = [
  "障害", "福祉", "就労", "雇用", "共同生活", "グループホーム", "精神", "こども", "子ども",
  "デジタル", "dx", "ai", "it", "情報", "システム", "業務", "効率", "広報", "ウェブ", "web",
  "ホームページ", "検索", "補助", "助成", "支援", "事業者", "法人", "手話"
];
const MAX_FEED_BYTES = 1_000_000;
const MAX_PAGE_BYTES = 1_500_000;

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
    const summary = cleanText(tag(block, ["description", "summary", "content", "content:encoded"]) || title);
    return title && url && publishedAt ? { title, url, publishedAt, source: source.name, summary } : null;
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

async function collectLatestInfo({fetchImpl = globalThis.fetch, now = new Date(), sources = DEFAULT_SOURCES, limit = 10} = {}) {
  const settled = await Promise.allSettled(sources.map(source => fetchFeed(source, fetchImpl)));
  const cutoff = now.getTime() - 60 * 24 * 60 * 60 * 1000;
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
  const seenUrls = new Set(), seenTitles = new Set();
  const ranked = rows.sort((a,b) => b.score-a.score || Date.parse(b.publishedAt)-Date.parse(a.publishedAt) || a.priority-b.priority)
    .filter(item => {
      const title = item.title.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
      if (seenUrls.has(item.url) || seenTitles.has(title)) return false;
      seenUrls.add(item.url); seenTitles.add(title); return true;
    }).slice(0, Math.max(3, Math.min(10, limit)))
    .map(({score,priority,...item}) => item);
  const candidates = await Promise.all(ranked.map(item => enrichCandidate(item,fetchImpl)));
  return { candidates, attemptedSources:sources.length,
    successfulSources:settled.filter(result => result.status === "fulfilled").length };
}

module.exports = { DEFAULT_SOURCES, ALLOWED_HOSTS, parseFeed, collectLatestInfo, safeOfficialUrl, relevance, pageSummary };
