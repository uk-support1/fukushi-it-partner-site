"use strict";

// Throwaway diagnostic, not part of the production pipeline or test suite.
// Round 2: test 1 (fileData YouTube URL understanding) already confirmed
// working with responseJsonSchema. This round digs into why urlContext +
// responseJsonSchema returned no candidate text, by trying variants and
// printing finishReason/promptFeedback/urlContextMetadata explicitly.
// Delete this file and its workflow once the answer is known either way.

const MODEL = process.env.GEMINI_MODEL_TEST || "gemini-3.5-flash-lite";
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
  return { httpStatus: response.status, ok: response.ok, parsed, rawLength: text.length, raw: text };
}

function report(label, result) {
  console.log(`\n=== ${label} ===`);
  const candidate = result.parsed && Array.isArray(result.parsed.candidates) ? result.parsed.candidates[0] : null;
  console.log("httpStatus:", result.httpStatus, "rawLength:", result.rawLength);
  console.log("promptFeedback:", JSON.stringify(result.parsed && result.parsed.promptFeedback));
  console.log("finishReason:", candidate && candidate.finishReason);
  console.log("urlContextMetadata:", JSON.stringify(candidate && candidate.urlContextMetadata));
  console.log("groundingMetadata present:", Boolean(candidate && candidate.groundingMetadata));
  const parts = candidate && candidate.content && candidate.content.parts;
  console.log("part count:", Array.isArray(parts) ? parts.length : 0);
  if (Array.isArray(parts)) parts.forEach((part, i) => console.log(`part[${i}] keys:`, Object.keys(part), part.text ? "text=" + part.text.slice(0, 300) : ""));
  if (!candidate) console.log("FULL RAW (no candidate found):", result.raw.slice(0, 3000));
  return result;
}

async function main() {
  if (!process.env.GEMINI_API_KEY) { console.error("GEMINI_API_KEY is not set."); process.exitCode = 1; return; }
  console.log("Model under test:", MODEL);

  report("2a: urlContext + responseJsonSchema + explicit maxOutputTokens", await callGemini({
    contents: [{ role: "user", parts: [{ text: `${FEED_URL} を取得し、直近の動画タイトルを新しい順に3件、日本語でJSONとして返してください。` }] }],
    tools: [{ urlContext: {} }],
    generationConfig: {
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object", additionalProperties: false, required: ["titles"], properties: { titles: { type: "array", items: { type: "string" } } } }
    }
  }));

  report("2b: urlContext + plain text, no JSON schema at all", await callGemini({
    contents: [{ role: "user", parts: [{ text: `${FEED_URL} を取得し、直近の動画タイトルを新しい順に3件、日本語の箇条書きで書いてください。` }] }],
    tools: [{ urlContext: {} }],
    generationConfig: { maxOutputTokens: 8000 }
  }));

  report("2c: urlContext + legacy responseSchema (not responseJsonSchema)", await callGemini({
    contents: [{ role: "user", parts: [{ text: `${FEED_URL} を取得し、直近の動画タイトルを新しい順に3件、日本語でJSONとして返してください。` }] }],
    tools: [{ urlContext: {} }],
    generationConfig: {
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { titles: { type: "ARRAY", items: { type: "STRING" } } }, required: ["titles"] }
    }
  }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
