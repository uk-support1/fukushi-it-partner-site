"use strict";

// These profiles are deliberately text-only. Image understanding happens when
// the catalog is curated, never during the daily publication job.
const STRONG_THEMES = ["ai", "security", "subsidy", "recruit"];

function includes(text, pattern) { return pattern.test(text); }

function articleImageProfile({ title = "", body = "", category = "" } = {}) {
  const focus = `${title}\n${category}`.toLowerCase();
  const text = `${focus}\n${body}`.toLowerCase();
  const themes = new Set();
  // Strong themes must be the article's stated subject, not a passing body
  // mention such as a homepage article listing "採用" as one possible use.
  if (includes(focus, /ai|人工知能|生成ai|チャットgpt/)) themes.add("ai");
  if (includes(focus, /補助金|助成金|申請|交付/)) themes.add("subsidy");
  if (includes(focus, /セキュリティ|個人情報|パスワード|情報漏えい|マイナンバー/)) themes.add("security");
  if (includes(focus, /採用|求人|応募|雇用|職員募集|スタッフ募集/)) themes.add("recruit");
  if (includes(text, /it|デジタル|システム|クラウド|連携|pc|パソコン|業務効率/)) themes.add("digital");
  if (includes(text, /ホームページ|ウェブサイト|webサイト|サイト制作|googleマップ|検索|seo|アクセシビリティ/)) themes.add("web");
  if (includes(text, /福祉|障害|利用者|家族|支援|事業所|グループホーム|就労/)) themes.add("welfare");

  const preferredTags = new Set(), preferredScenes = new Set();
  if (themes.has("recruit")) { ["採用", "面談", "職員", "チーム"].forEach(value => preferredTags.add(value)); preferredScenes.add("採用面談"); }
  else if (themes.has("subsidy")) { ["補助金", "申請", "相談", "書類"].forEach(value => preferredTags.add(value)); preferredScenes.add("補助金相談"); }
  else if (themes.has("ai")) { ["AI", "デジタル", "PC"].forEach(value => preferredTags.add(value)); preferredScenes.add("AI活用"); }
  else if (themes.has("security")) { ["セキュリティ", "PC", "情報管理"].forEach(value => preferredTags.add(value)); preferredScenes.add("情報管理"); }
  else if (themes.has("digital") || (themes.has("web") && !themes.has("welfare"))) { ["PC", "Web", "デジタル", "業務"].forEach(value => preferredTags.add(value)); preferredScenes.add("PC作業"); }
  else { ["福祉", "支援", "相談", "利用者", "事業所"].forEach(value => preferredTags.add(value)); preferredScenes.add("福祉支援"); }
  // A welfare website article is about reassurance and information provision
  // unless it explicitly discusses a technical/digital subject.
  if (themes.has("welfare") && themes.has("web") && !themes.has("digital")) {
    ["福祉", "支援", "相談", "利用者", "情報提供"].forEach(value => preferredTags.add(value));
    preferredScenes.add("福祉支援");
  }
  return { themes: [...themes], preferredTags: [...preferredTags], preferredScenes: [...preferredScenes], excludedThemes: STRONG_THEMES.filter(theme => !themes.has(theme)), allowTechnology: themes.has("digital") || themes.has("ai") || themes.has("security") || (themes.has("web") && !themes.has("welfare")) };
}

function scoreImage(candidate, profile) {
  if (!profile) return 0;
  const tags = new Set(candidate.tags || []), scenes = new Set(candidate.scenes || [candidate.scene].filter(Boolean));
  const tagScore = profile.preferredTags.reduce((score, tag) => score + (tags.has(tag) ? 3 : 0), 0);
  const sceneScore = profile.preferredScenes.reduce((score, scene) => score + (scenes.has(scene) ? 5 : 0), 0);
  const themeScore = (candidate.themes || []).reduce((score, theme) => score + (profile.themes.includes(theme) ? 4 : 0), 0);
  return tagScore + sceneScore + themeScore;
}

function isExcluded(candidate, profile) {
  if (!profile) return false;
  if ((candidate.themes || []).some(theme => profile.excludedThemes.includes(theme))) return true;
  return candidate.technology_level === "strong" && !profile.allowTechnology;
}

module.exports = { articleImageProfile, scoreImage, isExcluded };
