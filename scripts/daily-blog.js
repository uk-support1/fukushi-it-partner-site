"use strict";
const fs = require("fs");
const lib = require("./lib/articles");
const { selectTopic, TopicError } = require("./topic-selector");
const { generateArticle } = require("./article-generator");
const { saveArticleDraft } = require("./article-writer");
const { collectLatestInfo, DEFAULT_SOURCES, loadYoutubeCache } = require("./latest-info");
const { fetchVideoThumbnail } = require("./lib/video-thumbnail");

const VIDEO_SOURCES = DEFAULT_SOURCES.filter(source => source.kind === "video");

function hasArticleDatedToday(localDate, articlesDir) {
  try { return lib.loadArticles(articlesDir).some(a => a && a.data && a.data.date === localDate); }
  catch { return false; }
}

async function prepareDailyBlog({now = new Date(), env = process.env, request, articleRequest, load,
  collect = collectLatestInfo, loadCache = loadYoutubeCache, fetchThumbnail = fetchVideoThumbnail,
  save = saveArticleDraft, articlesDir, alreadyPublishedToday = hasArticleDatedToday} = {}) {
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
  // The scheduled run only ever selects from the 4 YouTube channels; official
  // government/agency RSS sources are no longer used for topic selection (see
  // docs/daily-blog.md). GitHub's shared cloud runners get intermittently
  // blocked fetching YouTube feeds directly, so it reads the cache a
  // self-hosted runner keeps refreshed instead of live-fetching. workflow_dispatch
  // can still isolate a live YouTube fetch to debug that cloud-runner block.
  const liveDebug = env.DAILY_BLOG_SOURCES_FILTER === "live";
  const sources = liveDebug ? VIDEO_SOURCES : [];
  const extraCandidates = liveDebug ? [] : loadCache({now});
  let latest = {candidates:[],attemptedSources:0,successfulSources:0};
  try {
    const collected = await collect({now, sources, extraCandidates});
    if (collected && Array.isArray(collected.candidates)) latest = collected;
  } catch {
    // Collection is optional. Gemini's established evergreen path remains available.
  }
  const candidates = latest.candidates.length >= 3 ? latest.candidates.slice(0,10) : [];
  const selection = await selectTopic({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,localDate,
    latestInfo:candidates,request,load});
  const article = await generateArticle({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,localDate,
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
