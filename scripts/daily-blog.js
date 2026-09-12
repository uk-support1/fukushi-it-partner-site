"use strict";
const fs = require("fs");
const { selectTopic, TopicError } = require("./topic-selector");
const { generateArticle } = require("./article-generator");
const { saveArticleDraft } = require("./article-writer");
const { collectLatestInfo } = require("./latest-info");

async function prepareDailyBlog({now = new Date(), env = process.env, request, articleRequest, load,
  collect = collectLatestInfo, save = saveArticleDraft, articlesDir} = {}) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  let latest = {candidates:[],attemptedSources:0,successfulSources:0};
  try {
    const collected = await collect({now});
    if (collected && Array.isArray(collected.candidates)) latest = collected;
  } catch {
    // Collection is optional. Gemini's established evergreen path remains available.
  }
  const candidates = latest.candidates.length >= 3 ? latest.candidates.slice(0,10) : [];
  const selection = await selectTopic({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,localDate,
    latestInfo:candidates,request,load});
  const article = await generateArticle({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,localDate,
    topic:selection.topic,sources:selection.sources,request:articleRequest === undefined ? request : articleRequest});
  const draft = save({article,topic:selection.topic,sources:selection.sources,date:localDate,directory:articlesDir});
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
module.exports={prepareDailyBlog,failureReport,writeResultFile};
