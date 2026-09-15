#!/usr/bin/env node
"use strict";

// One-time, content-reviewed rename. It keeps Markdown and generated HTML in
// sync before the normal metadata and page generators run.
const fs = require("fs");
const path = require("path");

const RENAMES = {
  "inline-welfare-consultation-01.png": "inline-welfare-consultation-01.png",
  "inline-welfare-consultation-02.png": "inline-welfare-consultation-02.png",
  "inline-welfare-consultation-03.png": "inline-welfare-team-support-01.png",
  "inline-welfare-consultation-04.png": "inline-recruit-interview-01.png",
  "inline-welfare-consultation-05.png": "inline-ai-chat-01.png",
  "inline-welfare-consultation-06.png": "inline-ai-workflow-01.png",
  "inline-welfare-consultation-07.png": "inline-welfare-digital-care-01.png",
  "inline-welfare-consultation-08.png": "inline-dx-paperless-01.png",
  "inline-welfare-consultation-09.png": "inline-web-site-review-01.png",
  "inline-web-design-01.png": "inline-web-design-01.png",
  "inline-web-design-02.png": "inline-web-design-02.png",
  "inline-web-design-03.png": "inline-web-site-search-01.png",
  "inline-web-design-04.png": "inline-seo-analytics-01.png",
  "inline-web-design-05.png": "inline-subsidy-application-01.png",
  "inline-web-design-06.png": "inline-subsidy-consultation-01.png",
  "inline-web-design-07.png": "inline-security-protection-01.png",
  "inline-web-design-08.png": "inline-security-protection-02.png",
  "inline-web-design-09.png": "inline-welfare-facility-01.png",
  "inline-welfare-web-support-01.png": "inline-welfare-web-support-01.png",
  "inline-welfare-web-support-02.png": "inline-web-design-03.png",
  "inline-welfare-web-support-03.png": "inline-web-design-04.png",
  "inline-welfare-web-support-04.png": "inline-web-planning-01.png",
  "inline-welfare-web-support-05.png": "inline-subsidy-application-02.png",
  "inline-welfare-web-support-06.png": "inline-subsidy-consultation-02.png",
  "inline-welfare-web-support-07.png": "inline-security-protection-03.png",
  "inline-welfare-web-support-08.png": "inline-security-protection-04.png",
  "inline-welfare-web-support-09.png": "inline-welfare-facility-02.png",
  "inline-recruit-interview-01.png": "inline-recruit-interview-02.png",
  "inline-recruit-interview-02.png": "inline-ai-chat-02.png",
  "inline-recruit-interview-03.png": "inline-ai-chat-03.png",
  "inline-recruit-interview-04.png": "inline-web-form-01.png",
  "inline-recruit-interview-05.png": "inline-web-update-01.png",
  "inline-recruit-interview-06.png": "inline-subsidy-application-03.png",
  "inline-recruit-interview-07.png": "inline-security-protection-05.png",
  "inline-recruit-interview-08.png": "inline-welfare-consultation-03.png",
  "inline-recruit-interview-09.png": "inline-dx-dashboard-01.png",
  "inline-web-planning-01.png": "inline-web-planning-02.png",
  "inline-web-planning-02.png": "inline-web-design-05.png",
  "inline-web-planning-03.png": "inline-seo-search-01.png",
  "inline-web-planning-04.png": "inline-seo-analytics-02.png",
  "inline-web-planning-05.png": "inline-subsidy-application-04.png",
  "inline-web-planning-06.png": "inline-welfare-consultation-04.png",
  "inline-web-planning-07.png": "inline-security-protection-06.png",
  "inline-web-planning-08.png": "inline-security-protection-07.png",
  "inline-web-planning-09.png": "inline-welfare-facility-03.png"
};

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function renameInlineImages({ root = path.join(__dirname, "..") } = {}) {
  const inlineDirectory = path.join(root, "assets", "images", "blog-library", "inline");
  const moves = Object.entries(RENAMES).filter(([from, to]) => from !== to && fs.existsSync(path.join(inlineDirectory, from)));
  const staged = moves.map(([from, to], index) => {
    const temporary = `.__inline-rename-${index}.tmp`;
    fs.renameSync(path.join(inlineDirectory, from), path.join(inlineDirectory, temporary));
    return [from, to, temporary];
  });
  for (const [, to, temporary] of staged) fs.renameSync(path.join(inlineDirectory, temporary), path.join(inlineDirectory, to));

  let updatedFiles = 0;
  for (const file of walk(root).filter(file => /\.(?:md|html|json)$/i.test(file) && !file.includes(`${path.sep}node_modules${path.sep}`))) {
    let text = fs.readFileSync(file, "utf8"), next = text;
    for (const [from] of Object.entries(RENAMES)) next = next.split(`assets/images/blog-library/inline/${from}`).join(`__INLINE_IMAGE_${from}__`);
    for (const [from, to] of Object.entries(RENAMES)) next = next.split(`__INLINE_IMAGE_${from}__`).join(`assets/images/blog-library/inline/${to}`);
    if (next !== text) { fs.writeFileSync(file, next, "utf8"); updatedFiles++; }
  }
  return { renamed: staged.length, updatedFiles };
}

if (require.main === module) console.log(JSON.stringify(renameInlineImages()));
module.exports = { RENAMES, renameInlineImages };
