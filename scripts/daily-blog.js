"use strict";

// Entry point for the future editorial pipeline. This version is deliberately
// side-effect free: no API calls, filesystem writes, Git commands or generation.
function prepareDailyBlog(now = new Date()) {
  return {
    startedAt: now.toISOString(),
    localDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(now),
    timeZone: "Asia/Tokyo",
    status: "skipped",
    reason: "article_generation_not_implemented",
    articlesCreated: 0,
    shouldPublish: false
  };
}

if (require.main === module) {
  console.log(JSON.stringify(prepareDailyBlog(), null, 2));
}

module.exports = { prepareDailyBlog };
