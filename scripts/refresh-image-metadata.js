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
    "welfare:web-support": { tags: ["福祉", "利用者", "家族", "ホームページ", "情報提供"], scene: "福祉の情報相談", themes: ["welfare", "web"], technology_level: "moderate" },
    "recruit:interview": { tags: ["採用", "面談", "応募者", "職員", "対話"], scene: "採用面談", themes: ["recruit"], technology_level: "none" },
    "web:design": { tags: ["ホームページ", "Web", "デザイン", "PC", "打ち合わせ"], scene: "Web制作打ち合わせ", themes: ["web"], technology_level: "moderate" },
    "web:planning": { tags: ["ホームページ", "Web", "情報発信", "PC", "打ち合わせ"], scene: "Web企画", themes: ["web"], technology_level: "moderate" }
  };
  const named = candidate.category === "subsidy" && candidate.path.includes("budget") ? { tags: ["補助金", "予算", "計算", "書類"], scene: "予算検討", themes: ["subsidy"], technology_level: "none" } :
    candidate.category === "subsidy" && candidate.path.includes("consultation") ? { tags: ["補助金", "相談", "申請", "書類"], scene: "補助金相談", themes: ["subsidy"], technology_level: "none" } :
    candidate.category === "subsidy" && candidate.path.includes("website") ? { tags: ["補助金", "ホームページ", "相談", "書類"], scene: "補助金相談", themes: ["subsidy"], technology_level: "none" } : null;
  const base = named || groups[key] || { tags: [candidate.category], scene: candidate.category, themes: [candidate.category], technology_level: "none" };
  return { path: candidate.path, category: candidate.category, series: candidate.series, ...base, has_person: !candidate.path.includes("budget") };
}

function refreshImageMetadata({ root = path.join(__dirname, ".."), kind = null } = {}) {
  const file = path.join(root, "data", "image-library.json");
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { version: 1, images: [] };
  const byPath = new Map((existing.images || []).map(item => [item.path, item]));
  const kinds = kind ? [kind] : ["hero", "inline"];
  const candidates = kinds.flatMap(imageKind => images.discoverImages({ root, kind: imageKind }));
  const catalog = candidates.map(candidate => candidate.path.includes("/inline/") ? metadataFor(candidate) : (byPath.get(candidate.path) || metadataFor(candidate)));
  const document = { version: 1, generated_for: kind || "hero and inline", images: catalog };
  fs.writeFileSync(file, JSON.stringify(document, null, 2) + "\n", "utf8");
  return { file, images: catalog.length };
}
if (require.main === module) console.log(JSON.stringify(refreshImageMetadata()));
module.exports = { metadataFor, refreshImageMetadata };
