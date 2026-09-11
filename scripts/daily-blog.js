"use strict";
const { selectTopic, TopicError } = require("./topic-selector");

async function prepareDailyBlog({now = new Date(), env = process.env, request, load} = {}) {
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
  const result = await selectTopic({apiKey:env.OPENAI_API_KEY,model:env.OPENAI_MODEL,localDate,request,load});
  return {startedAt:now.toISOString(),localDate,timeZone:"Asia/Tokyo",status:"topic_selected",
    articlesCreated:0,shouldPublish:false,...result};
}

if(require.main === module) {
  prepareDailyBlog().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{
    // Never print raw API responses, headers, article contents, or exception messages.
    console.error(JSON.stringify({status:"failed",error:error instanceof TopicError ? error.code : "TOPIC_SELECTION_FAILED",articlesCreated:0,shouldPublish:false}));
    process.exitCode=1;
  });
}
module.exports={prepareDailyBlog};
