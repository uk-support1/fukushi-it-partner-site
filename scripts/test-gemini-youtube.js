"use strict";

// Throwaway diagnostic, not part of the production pipeline or test suite.
// Confirms whether Gemini's native YouTube URL understanding and its
// urlContext tool both (a) actually work and (b) stay compatible with the
// strict responseJsonSchema output the rest of this codebase depends on.
// Run only via .github/workflows/gemini-youtube-test.yml (workflow_dispatch).
// Delete this file and that workflow once the answer is known either way.

const MODEL = process.env.GEMINI_MODEL_TEST || "gemini-3.5-flash-lite";
const VIDEO_URL = "https://www.youtube.com/watch?v=k596ZRNsvsU";
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UCfG0XDjNIjHm2vmrChrL4SQ";

async function callGemini(body) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify(body)
    }
  );
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { httpStatus: response.status, ok: response.ok, parsed, rawLength: text.length };
}

async function testVideoUnderstanding() {
  console.log("\n=== Test 1: fileData YouTube URL + responseJsonSchema ===");
  const result = await callGemini({
    contents: [{
      role: "user",
      parts: [
        { fileData: { fileUri: VIDEO_URL } },
        { text: "この動画で話されている内容を100字程度の日本語で要約してください。個人を特定できる情報や誹謗中傷につながる内容は含めないでください。" }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object", additionalProperties: false, required: ["summary"],
        properties: { summary: { type: "string" } }
      }
    }
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function testUrlContextFeed() {
  console.log("\n=== Test 2: urlContext tool fetching the channel's own RSS feed ===");
  const result = await callGemini({
    contents: [{
      role: "user",
      parts: [{ text: `${FEED_URL} を取得し、直近の動画タイトルを新しい順に3件、日本語でJSONとして返してください。` }]
    }],
    tools: [{ urlContext: {} }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object", additionalProperties: false, required: ["titles"],
        properties: { titles: { type: "array", items: { type: "string" } } }
      }
    }
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) { console.error("GEMINI_API_KEY is not set."); process.exitCode = 1; return; }
  console.log("Model under test:", MODEL);
  const r1 = await testVideoUnderstanding();
  const r2 = await testUrlContextFeed();
  console.log("\n=== Summary ===");
  console.log("video understanding + JSON schema:", r1.ok ? "OK" : "FAILED (" + r1.httpStatus + ")");
  console.log("urlContext tool + JSON schema:", r2.ok ? "OK" : "FAILED (" + r2.httpStatus + ")");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
