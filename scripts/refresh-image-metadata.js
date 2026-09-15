#!/usr/bin/env node
"use strict";

// One-time/maintenance catalog builder. Normal publishing only reads the JSON.
const fs = require("fs");
const path = require("path");
const images = require("./lib/image-library");

function metadataFor(candidate) {
  const key = `${candidate.category}:${candidate.series}`;
  const groups = {
    "dx:workflow": { tags: ["PC", "Web", "デジタル", "業務", "情報管理"], scene: "PC作業", themes: ["digital"], technology_level: "strong" },
    "recruit:team": { tags: ["採用", "職員", "チーム", "協働", "事業所"], scene: "職員チーム", themes: ["recruit"], technology_level: "none" },
    "subsidy:consultation": { tags: ["補助金", "申請", "相談", "書類", "事業所"], scene: "補助金相談", themes: ["subsidy"], technology_level: "none" },
    "subsidy:planning": { tags: ["補助金", "計画", "予算", "書類", "相談"], scene: "申請計画", themes: ["subsidy"], technology_level: "none" },
    "welfare:care": { tags: ["福祉", "利用者", "支援", "ケア", "室内"], scene: "福祉支援", themes: ["welfare"], technology_level: "none" },
    "welfare:home": { tags: ["福祉", "グループホーム", "生活", "利用者", "事業所"], scene: "福祉事業所", themes: ["welfare"], technology_level: "none" },
    "welfare:support": { tags: ["福祉", "支援", "相談", "利用者", "情報提供"], scene: "福祉支援", themes: ["welfare"], technology_level: "none" },
    "welfare:support-team": { tags: ["福祉", "支援", "職員", "チーム", "相談"], scene: "支援チーム", themes: ["welfare"], technology_level: "none" },
    "welfare:consultation": { tags: ["福祉", "相談", "利用者", "支援", "対話"], scene: "福祉相談", themes: ["welfare"], technology_level: "none" },
    "welfare:team-support": { tags: ["福祉", "職員", "利用者", "相談", "支援"], scene: "福祉支援の打ち合わせ", themes: ["welfare"], technology_level: "none" },
    "welfare:digital-care": { tags: ["福祉", "生活支援", "職員", "タブレット", "事業所"], scene: "福祉事業所での情報確認", themes: ["welfare"], technology_level: "moderate" },
    "welfare:facility": { tags: ["福祉", "事業所", "相談", "利用者", "室内"], scene: "福祉事業所の風景", themes: ["welfare"], technology_level: "none" },
    "welfare:web-support": { tags: ["福祉", "利用者", "家族", "ホームページ", "情報提供"], scene: "福祉の情報相談", themes: ["welfare", "web"], technology_level: "moderate" },
    "recruit:interview": { tags: ["採用", "面談", "応募者", "職員", "対話"], scene: "採用面談", themes: ["recruit"], technology_level: "none" },
    "ai:chat": { tags: ["AI", "生成AI", "チャット", "文章作成", "PC"], scene: "生成AIの活用", themes: ["ai"], technology_level: "strong" },
    "ai:workflow": { tags: ["AI", "生成AI", "業務整理", "情報整理", "PC"], scene: "AIによる業務整理", themes: ["ai"], technology_level: "strong" },
    "dx:paperless": { tags: ["DX", "ペーパーレス", "業務効率化", "書類", "スキャン"], scene: "ペーパーレス業務", themes: ["digital"], technology_level: "strong" },
    "dx:dashboard": { tags: ["DX", "業務効率化", "データ", "タブレット", "PC"], scene: "デジタル業務管理", themes: ["digital"], technology_level: "strong" },
    "web:design": { tags: ["ホームページ", "Web", "デザイン", "PC", "サイト制作"], scene: "Webサイト制作", themes: ["web"], technology_level: "moderate" },
    "web:planning": { tags: ["ホームページ", "Web", "情報発信", "PC", "打ち合わせ"], scene: "Web企画", themes: ["web"], technology_level: "moderate" },
    "web:site-review": { tags: ["ホームページ", "Web", "サイト確認", "スマホ", "PC"], scene: "Webサイトの確認", themes: ["web"], technology_level: "moderate" },
    "web:site-search": { tags: ["ホームページ", "Web", "検索", "サイト設計", "PC"], scene: "Webサイトの検索画面", themes: ["web"], technology_level: "moderate" },
    "web:form": { tags: ["ホームページ", "Web", "フォーム", "スマホ", "PC"], scene: "Webフォームの確認", themes: ["web"], technology_level: "moderate" },
    "web:update": { tags: ["ホームページ", "Web", "サイト更新", "情報発信", "PC"], scene: "Webサイトの更新", themes: ["web"], technology_level: "moderate" },
    "seo:analytics": { tags: ["SEO", "検索", "アクセス分析", "集客", "グラフ"], scene: "アクセス分析", themes: ["seo"], technology_level: "moderate" },
    "seo:search": { tags: ["SEO", "検索", "キーワード", "集客", "PC"], scene: "検索結果の確認", themes: ["seo"], technology_level: "moderate" },
    "subsidy:application": { tags: ["補助金", "助成金", "申請書", "資金計画", "電卓"], scene: "補助金の申請準備", themes: ["subsidy"], technology_level: "none" },
    "security:protection": { tags: ["セキュリティ", "個人情報", "パスワード", "安全管理", "情報保護"], scene: "情報セキュリティ対策", themes: ["security"], technology_level: "strong" }
  };
  const named = candidate.category === "subsidy" && candidate.path.includes("budget") ? { tags: ["補助金", "予算", "計算", "書類"], scene: "予算検討", themes: ["subsidy"], technology_level: "none" } :
    candidate.category === "subsidy" && candidate.path.includes("consultation") ? { tags: ["補助金", "相談", "申請", "書類"], scene: "補助金相談", themes: ["subsidy"], technology_level: "none" } :
    candidate.category === "subsidy" && candidate.path.includes("website") ? { tags: ["補助金", "ホームページ", "相談", "書類"], scene: "補助金相談", themes: ["subsidy"], technology_level: "none" } : null;
  const categoryDefaults = {
    welfare: { tags: ["福祉", "支援", "相談", "利用者", "事業所"], scene: "福祉支援", themes: ["welfare"], technology_level: "none" },
    recruit: { tags: ["採用", "求人", "面談", "職員", "応募者"], scene: "採用活動", themes: ["recruit"], technology_level: "none" },
    ai: { tags: ["AI", "生成AI", "情報整理", "文章作成", "PC"], scene: "AI活用", themes: ["ai"], technology_level: "strong" },
    dx: { tags: ["DX", "業務効率化", "デジタル化", "情報管理", "PC"], scene: "デジタル業務", themes: ["digital"], technology_level: "strong" },
    web: { tags: ["ホームページ", "Web", "サイト制作", "情報発信", "PC"], scene: "Webサイト活用", themes: ["web"], technology_level: "moderate" },
    seo: { tags: ["SEO", "検索", "アクセス分析", "集客", "キーワード"], scene: "検索・アクセス分析", themes: ["seo"], technology_level: "moderate" },
    subsidy: { tags: ["補助金", "助成金", "申請", "書類", "資金計画"], scene: "補助金の申請準備", themes: ["subsidy"], technology_level: "none" },
    security: { tags: ["セキュリティ", "個人情報", "パスワード", "安全管理", "情報保護"], scene: "情報セキュリティ対策", themes: ["security"], technology_level: "strong" }
  };
  const base = named || groups[key] || categoryDefaults[candidate.category] || { tags: [candidate.category], scene: candidate.category, themes: [candidate.category], technology_level: "none" };
  const noPerson = new Set([
    "inline-subsidy-application-01.png", "inline-security-protection-05.png",
    "inline-seo-search-01.png", "inline-subsidy-application-04.png"
  ]);
  return { path: candidate.path, category: candidate.category, series: candidate.series, ...base,
    has_person: !noPerson.has(path.basename(candidate.path)) };
}

function refreshImageMetadata({ root = path.join(__dirname, ".."), kind = null } = {}) {
  const file = path.join(root, "data", "image-library.json");
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { version: 1, images: [] };
  const byPath = new Map((existing.images || []).map(item => [item.path, item]));
  const kinds = kind ? [kind] : ["hero", "inline"];
  const candidates = kinds.flatMap(imageKind => images.discoverImages({ root, kind: imageKind, catalog: false }));
  // Keep reviewed metadata after a canonical filename drops its descriptive
  // series suffix. Only genuinely new files receive inferred defaults.
  const catalog = candidates.map(candidate => byPath.get(candidate.path) || metadataFor(candidate));
  const document = { version: 1, generated_for: kind || "hero and inline", images: catalog };
  fs.writeFileSync(file, JSON.stringify(document, null, 2) + "\n", "utf8");
  return { file, images: catalog.length };
}
if (require.main === module) console.log(JSON.stringify(refreshImageMetadata()));
module.exports = { metadataFor, refreshImageMetadata };
