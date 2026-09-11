"use strict";
const { selectTopic, TopicError } = require("./topic-selector");

async function prepareDailyBlog({now = new Date(), env = process.env, request, load} = {}) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  const result = await selectTopic({apiKey:env.GEMINI_API_KEY,model:env.GEMINI_MODEL,localDate,request,load});
  return {startedAt:now.toISOString(),localDate,timeZone:"Asia/Tokyo",status:"topic_selected",
    articlesCreated:0,shouldPublish:false,...result};
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

if(require.main === module) {
  prepareDailyBlog().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{
    // The report is an explicit allowlist. Never print raw responses, headers,
    // request options, article contents, API keys, or arbitrary exceptions.
    console.error(JSON.stringify(failureReport(error)));
    process.exitCode=1;
  });
}
module.exports={prepareDailyBlog,failureReport};
