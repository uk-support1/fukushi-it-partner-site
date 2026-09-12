"use strict";

const { TopicError, requestGemini, resolveGeminiModel } = require("./topic-selector");

const ARTICLE_FIELDS = ["title", "description", "bodyMarkdown"];
const ARTICLE_MIN_CHARS = 1200;
const ARTICLE_MAX_CHARS = 3500;
const articleSchema = {
  type: "object",
  additionalProperties: false,
  required: ARTICLE_FIELDS,
  properties: {
    title: { type: "string", description: "選定テーマと完全に同じ記事タイトル" },
    description: { type: "string", description: "検索結果に表示する120字程度の日本語説明文" },
    bodyMarkdown: { type: "string", description: "見出しを含む日本語Markdown本文" }
  }
};

function fail(code) { throw new TopicError(code); }

function validateArticle(raw, topic) {
  if (typeof raw !== "string" || raw.length > 20000) fail("INVALID_ARTICLE_JSON");
  let value;
  try { value = JSON.parse(raw); } catch { fail("INVALID_ARTICLE_JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== ARTICLE_FIELDS.length || ARTICLE_FIELDS.some(key => !Object.hasOwn(value, key))) {
    fail("INVALID_ARTICLE_FIELDS");
  }
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 140 ||
      value.title.trim() !== topic.title.trim()) fail("ARTICLE_TITLE_MISMATCH");
  if (typeof value.description !== "string" || !value.description.trim() || value.description.length > 200 ||
      /[<>\u0000-\u001f\u007f]/.test(value.description)) fail("INVALID_ARTICLE_DESCRIPTION");
  if (typeof value.bodyMarkdown !== "string") fail("INVALID_ARTICLE_BODY");
  const body = value.bodyMarkdown.trim();
  if (body.length < ARTICLE_MIN_CHARS || body.length > ARTICLE_MAX_CHARS) fail("INVALID_ARTICLE_LENGTH");
  if ((body.match(/^##\s+.+$/gm) || []).length < 3 || /^#\s+/m.test(body)) fail("INVALID_ARTICLE_HEADINGS");
  if (/^---\s*$/m.test(body) || /<[^>]+>/.test(body) || /https?:\/\/|\bwww\./i.test(body) ||
      /!?\[[^\]]*\]\([^)]+\)/.test(body)) fail("UNSAFE_ARTICLE_MARKDOWN");
  return { title: value.title.trim(), description: value.description.trim(), bodyMarkdown: body };
}

async function generateArticle({apiKey, model, localDate, topic, sources = [], request = requestGemini}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) fail("GEMINI_API_KEY_MISSING");
  model = resolveGeminiModel(model);
  if (!topic || typeof topic !== "object" || ["title","category","target","keyword","reason","angle","service"]
      .some(key => typeof topic[key] !== "string" || !topic[key].trim())) fail("INVALID_ARTICLE_TOPIC");

  const timely = Array.isArray(sources) && sources.length > 0;
  const instructions = "あなたは福祉ITパートナーの編集・執筆担当です。選定済みテーマから、日本語の実務的なブログ記事を作成してください。" +
    "読者は障害福祉事業所、就労支援事業所、グループホーム、福祉事業を運営する法人や担当者です。専門用語を控え、営業色を強くせず、同じ内容を繰り返さないでください。" +
    "本文は1,500〜2,500文字程度とし、H1は使わず、既存記事と同じく##と必要に応じて###、段落、箇条書きを使います。導入、基礎的な説明、実務への影響、今できること、まとめを自然に構成し、Q&Aは読者の疑問解消に必要な場合だけ含めます。" +
    "タイトルは入力されたtopic.titleを一字一句変えません。front matter、画像、URL、Markdownリンク、関連記事、日付、slug、出典一覧は出力しません。出典一覧はコード側で追加します。" +
    "存在しない制度、法律、補助金、自治体、サービス事例、URL、根拠のない数値や統計を作りません。" +
    (timely
      ? "入力されたsourceInformationだけを最新情報の事実根拠として使い、原文を転載せず要約・再構成します。候補の概要から確認できない詳細は断定しません。## 今回の最新情報、## 何が発表・変更されたのか、## 福祉事業者にどう関係するのか、## 現場で考えるべきポイント、## 福祉ITパートナーとしての見解、## まとめ、の順で構成します。事実と当社の考察を明確に分け、当社見解では小規模事業者の対応、IT・AIによる業務改善、情報発信・集客、利用者や家族への影響をテーマに即して検討します。"
      : "制度、法律、補助金、報酬改定、金額、期限など最新性の確認が必要な事項は、確認済みの一次情報が入力にないため一般論に留め、断定しません。");
  const raw = await request({apiKey, model, schema:articleSchema, instructions, input:{
    localDate,
    topic,
    ...(timely ? {sourceInformation:sources} : {}),
    outputRequirements:{language:"ja",targetCharacters:"1500-2500",headingLevels:["##","###"],externalUrls:false}
  }});
  return validateArticle(raw, topic);
}

module.exports = { generateArticle, validateArticle, articleSchema, ARTICLE_MIN_CHARS, ARTICLE_MAX_CHARS };
