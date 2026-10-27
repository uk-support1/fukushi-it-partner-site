"use strict";
const fs = require("fs");
const lib = require("./lib/articles");
const { selectTopic, TopicError, existingArticleInfo, normalizeSourceUrl } = require("./topic-selector");
const { generateArticle } = require("./article-generator");
const { saveArticleDraft } = require("./article-writer");
const { collectLatestInfo, DEFAULT_SOURCES, loadYoutubeCache } = require("./latest-info");
const { fetchVideoThumbnail } = require("./lib/video-thumbnail");

const VIDEO_SOURCES = DEFAULT_SOURCES.filter(source => source.kind === "video");
const NEWEST_CANDIDATES = 5;

// generateArticle() already revises style/duplicate-heading problems itself; these
// are the cases where the model's output was simply unusable (wrong title,
// malformed JSON, a rule it could not satisfy in its own retries). A fresh
// attempt usually succeeds, so retry rather than lose the day. API/auth/quota
// errors are not in this list and still stop the run.
const RETRYABLE_ARTICLE_ERRORS = new Set(["ARTICLE_TITLE_MISMATCH", "INVALID_ARTICLE_JSON", "INVALID_ARTICLE_FIELDS",
  "INVALID_ARTICLE_LENGTH", "INVALID_ARTICLE_HEADINGS", "INVALID_ARTICLE_BODY", "INVALID_ARTICLE_DESCRIPTION",
  "INVALID_ARTICLE_EMPHASIS", "UNSAFE_ARTICLE_MARKDOWN", "INVALID_EDITORIAL_REVIEW", "REPETITIVE_ARTICLE_STYLE",
  "ARTICLE_EMPHASIS_RETRY_EXHAUSTED", "ARTICLE_LOCAL_STYLE_RETRY_EXHAUSTED", "ARTICLE_EDITORIAL_REVIEW_RETRY_EXHAUSTED"]);
const MAX_ARTICLE_ATTEMPTS = 3;

async function generateArticleWithRetry(args, diagnosticLog = message => console.log(message)) {
  for (let attempt = 1; ; attempt++) {
    try { return await generateArticle(args); }
    catch (error) {
      if (!(error instanceof TopicError) || !RETRYABLE_ARTICLE_ERRORS.has(error.code) || attempt >= MAX_ARTICLE_ATTEMPTS) throw error;
      diagnosticLog(JSON.stringify({event:"daily_blog_article_regenerate",attempt,code:error.code}));
    }
  }
}

// A live fetch that fails is worth another try (YouTube refuses cloud servers
// only some of the time), but not endlessly: after two total failures in a row
// the day is treated as blocked and the cache alone is used. Collection is
// optional either way; Gemini's evergreen path remains available.
async function collectWithRetry(collect, args, sleep, {attempts = 3, delayMs = 10000} = {}) {
  let best = {candidates:[],attemptedSources:0,successfulSources:0}, totalFailures = 0;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let result = null;
    try { result = await collect(args); } catch { /* counted as a failure below */ }
    if (result && Array.isArray(result.candidates) &&
        (attempt === 1 || (result.successfulSources || 0) >= (best.successfulSources || 0))) best = result;
    const attempted = result ? result.attemptedSources || 0 : 0;
    const succeeded = result ? result.successfulSources || 0 : 0;
    if (!result || attempted === 0 || succeeded === attempted) break;
    totalFailures = succeeded === 0 ? totalFailures + 1 : 0;
    if (totalFailures >= 2 || attempt === attempts) break;
    await sleep(delayMs);
  }
  return best;
}

function usedSourceKeys(load) {
  try {
    return new Set((load || existingArticleInfo)()
      .flatMap(article => Array.isArray(article.sourceUrls) ? article.sourceUrls : []).map(normalizeSourceUrl));
  } catch { return new Set(); }
}

function hasArticleDatedToday(localDate, articlesDir) {
  try { return lib.loadArticles(articlesDir).some(a => a && a.data && a.data.date === localDate); }
  catch { return false; }
}

async function prepareDailyBlog({now = new Date(), env = process.env, request, articleRequest, load,
  collect = collectLatestInfo, loadCache = loadYoutubeCache, fetchThumbnail = fetchVideoThumbnail,
  save = saveArticleDraft, articlesDir, alreadyPublishedToday = hasArticleDatedToday,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  // A second, later cron exists as a backup for when the primary 06:17 JST
  // trigger is delayed or silently dropped by GitHub (observed in production
  // on 2026-09-22, 09-23 and 09-24 — see docs/daily-blog.md). Both firings
  // are `schedule` events, so guard here: if today's date already has an
  // article, the backup run is a safe no-op instead of a second article.
  // workflow_dispatch (manual) runs are never guarded this way.
  if (env.DAILY_BLOG_EVENT_NAME === "schedule" && alreadyPublishedToday(localDate, articlesDir)) {
    return {startedAt:now.toISOString(),localDate,timeZone:"Asia/Tokyo",
      status:"already_published_today",articlesCreated:0,shouldPublish:false};
  }
  // The run only ever selects from the 4 YouTube channels; official
  // government/agency RSS sources are no longer used for topic selection (see
  // docs/daily-blog.md). By default it fetches the feeds live from the cloud
  // runner (works most days; a failed fetch is just swallowed) AND merges in the
  // cache the daily YouTube Cache workflow accumulates (keeps unused videos up
  // to 90 days, and covers a day a live fetch fails).
  // DAILY_BLOG_SOURCES_FILTER=cache / live isolates one path for debugging.
  const filter = env.DAILY_BLOG_SOURCES_FILTER;
  const sources = filter === "cache" ? [] : VIDEO_SOURCES;
  const extraCandidates = filter === "live" ? [] : loadCache({now});
  // Already-used videos are dropped before the top-10 cut so they can't crowd
  // out unused ones, and unused videos stay eligible for a month.
  const used = usedSourceKeys(load);
  const latest = await collectWithRetry(collect, {now, sources, extraCandidates, maxAgeDays:90, sortBy:"recent",
    exclude:item => used.has(normalizeSourceUrl(item.url))}, sleep);
  // Only the newest few go to the model: given ten it kept picking an older, "more useful"
  // video over a fresh one, and the goal is to write about the newest videos.
  const candidates = latest.candidates.length >= 3 ? latest.candidates.slice(0,NEWEST_CANDIDATES) : [];
  const selection = await selectTopic({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,localDate,
    latestInfo:candidates,request,load});
  const article = await generateArticleWithRetry({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,localDate,
    topic:selection.topic,sources:selection.sources,recentArticleStyles:selection.recentArticleStyles,request:articleRequest === undefined ? request : articleRequest});
  // A thumbnail is a nice-to-have (see docs/daily-blog.md); fetchThumbnail()
  // already resolves to null on any failure, so a network hiccup here can
  // never turn into a failed Daily Blog run, only a normal stock-photo hero.
  let videoThumbnail = null;
  try { videoThumbnail = await fetchThumbnail({sources:selection.sources}); } catch { /* stock hero fallback below */ }
  const draft = save({article,topic:selection.topic,sources:selection.sources,date:localDate,directory:articlesDir,videoThumbnail});
  return {startedAt:now.toISOString(),localDate,timeZone:"Asia/Tokyo",status:"draft_saved",
    articlesCreated:1,shouldPublish:false,latestInformation:{attemptedSources:latest.attemptedSources || 0,
      successfulSources:latest.successfulSources || 0,candidateCount:candidates.length},...selection,article,draft};
}

function failureReport(error) {
  const report = {status:"failed",error:error instanceof TopicError ? error.code : "TOPIC_SELECTION_FAILED",
    articlesCreated:0,shouldPublish:false};
  if (error instanceof TopicError && error.diagnostic) {
    for (const key of ["httpStatus","apiErrorStatus","apiErrorCode","message","finishReason","blockReason"]) {
      if (error.diagnostic[key] !== undefined) report[key] = error.diagnostic[key];
    }
  }
  return report;
}

function writeResultFile(result, resultFile) {
  if (!resultFile) return;
  try {
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + "\n",
      { encoding: "utf8", flag: "wx" });
  } catch {
    throw new TopicError("DAILY_RESULT_SAVE_FAILED");
  }
}

if(require.main === module) {
  prepareDailyBlog().then(result=>{
    writeResultFile(result,process.env.DAILY_BLOG_RESULT_FILE);
    console.log(JSON.stringify(result,null,2));
  }).catch(error=>{
    // The report is an explicit allowlist. Never print raw responses, headers,
    // request options, article contents, API keys, or arbitrary exceptions.
    console.error(JSON.stringify(failureReport(error)));
    process.exitCode=1;
  });
}
module.exports={prepareDailyBlog,failureReport,writeResultFile,hasArticleDatedToday};
