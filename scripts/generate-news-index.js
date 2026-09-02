#!/usr/bin/env node
/*
 * Pages CMSで作成される content/news/*.md（YAML frontmatter付きMarkdown）を読み込み、
 * published: true の記事だけを対象に、投稿日が新しい順に並べた
 * data/news-index.json を生成する。
 *
 * 依存パッケージなし（Node.js標準モジュールのみ）。
 * 実行例: node scripts/generate-news-index.js
 *
 * どの記事が不正・非公開でスキップされたかは標準出力に警告ログとして
 * 出すが、スクリプト自体は必ず正常終了（exit code 0）する。
 */

"use strict";

const fs = require("fs");
const path = require("path");

const NEWS_DIR = path.join(__dirname, "..", "content", "news");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "news-index.json");
const EXCERPT_LENGTH = 80;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const data = {};
  match[1].split(/\r?\n/).forEach(function (line) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) return;
    const key = kv[1];
    let value = kv[2].trim();
    if (
      (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
      (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")
    ) {
      value = value.slice(1, -1);
    }
    if (value === "true") value = true;
    else if (value === "false") value = false;
    data[key] = value;
  });

  return { data: data, body: match[2] };
}

function stripMarkdown(md) {
  return String(md || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\r?\n+/g, " ")
    .trim();
}

function excerpt(md, len) {
  const text = stripMarkdown(md);
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function loadArticle(filename) {
  const filePath = path.join(NEWS_DIR, filename);
  const slug = filename.replace(/\.md$/i, "");

  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.warn("[skip] " + filename + ": ファイルを読み込めませんでした (" + err.message + ")");
    return null;
  }

  let parsed;
  try {
    parsed = parseFrontmatter(raw);
  } catch (err) {
    console.warn("[skip] " + filename + ": frontmatterの解析中にエラーが発生しました (" + err.message + ")");
    return null;
  }

  if (!parsed) {
    console.warn("[skip] " + filename + ": frontmatterの形式が不正です（---で囲まれていません）");
    return null;
  }

  const data = parsed.data;
  const body = parsed.body;

  // published:true 以外（false・未設定・不正な値）は非公開として静かにスキップする
  if (data.published !== true) {
    return null;
  }

  if (typeof data.title !== "string" || data.title === "") {
    console.warn("[skip] " + filename + ": titleが設定されていません（published:trueだが不正なfrontmatter）");
    return null;
  }

  if (!isValidDate(data.date)) {
    console.warn(
      "[skip] " + filename + ": dateがYYYY-MM-DD形式ではありません（値: " + JSON.stringify(data.date) + "）"
    );
    return null;
  }

  return {
    slug: slug,
    title: data.title,
    date: data.date,
    image: typeof data.image === "string" && data.image !== "" ? data.image : null,
    excerpt: excerpt(body, EXCERPT_LENGTH),
  };
}

function main() {
  let filenames = [];
  try {
    filenames = fs.readdirSync(NEWS_DIR).filter(function (f) {
      return /\.md$/i.test(f);
    });
  } catch (err) {
    console.warn(
      "content/news/ を読み込めませんでした。0件として出力します (" + err.message + ")"
    );
    filenames = [];
  }

  const articles = [];
  filenames.forEach(function (filename) {
    try {
      const article = loadArticle(filename);
      if (article) articles.push(article);
    } catch (err) {
      // 1記事の予期しないエラーで全体を落とさない
      console.warn("[skip] " + filename + ": 予期しないエラーのためスキップします (" + err.message + ")");
    }
  });

  articles.sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articles, null, 2) + "\n", "utf8");

  console.log("generated " + OUTPUT_FILE + " (" + articles.length + " article(s))");
}

main();
