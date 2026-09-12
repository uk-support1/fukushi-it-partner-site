"use strict";
/*
 * 「お役立ち講座」（content/courses/*.md）専用のMarkdown→HTML変換。
 *
 * 既存ブログの scripts/lib/markdown.js とは完全に独立したファイル。
 * ブログ側の変換処理・テンプレートには一切変更を加えないため、
 * 講座で必要な独自記法（SUMMARY/BUHIO/POINT/CAUTION/MARK）は
 * このファイルだけで完結させる。
 *
 * 通常のMarkdown（## / ### / **太字** / 1. 番号付きリスト等）は
 * npm marked（既存ブログ側と同じバージョンを使用、追加依存なし）の
 * 標準機能をそのまま使う。
 */

const { Marked } = require("marked");
const { BUHIO_IMAGES, DIRECTORY: BUHIO_DIRECTORY } = require("./buhio");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function safeUrl(url) {
  return !/^\s*(?:javascript|vbscript|data):/i.test(String(url || "").trim());
}

// [BUHIO type="..."] の type と、既存の6種類のぶひお画像（assets/images/buhio/）との
// 対応表。画像そのものは既存素材をそのまま使い、新規生成・変更は行わない。
const BUHIO_TYPE_MAP = {
  point: { file: "buhio-03-pointing.png", label: "POINT" },
  caution: { file: "buhio-05-surprised.png", label: "注意" },
  important: { file: "buhio-06-important.png", label: "重要" },
  success: { file: "buhio-04-jumping.png", label: "" },
  greeting: { file: "buhio-02-waving.png", label: "" },
  note: { file: "buhio-01-standing.png", label: "ひとこと" },
};
const DEFAULT_BUHIO_TYPE = "note";

function buhioForType(type) {
  const key = typeof type === "string" && BUHIO_TYPE_MAP[type] ? type : DEFAULT_BUHIO_TYPE;
  const entry = BUHIO_TYPE_MAP[key];
  // BUHIO_IMAGESに実在するファイルだけを使う（既存素材との整合チェック）。
  const known = BUHIO_IMAGES.some((img) => img.file === entry.file);
  return known ? entry : BUHIO_TYPE_MAP[DEFAULT_BUHIO_TYPE];
}

// 見出しテキストからアンカーID用の簡易スラッグを作る（自動目次で使用）。
function slugifyHeading(text, seen) {
  const base =
    String(text)
      .trim()
      .toLowerCase()
      .replace(/[\s　]+/g, "-")
      .replace(/[^\p{L}\p{N}_-]/gu, "")
      .slice(0, 60) || "section";
  let id = base;
  let n = 2;
  while (seen.has(id)) {
    id = base + "-" + n;
    n += 1;
  }
  seen.add(id);
  return id;
}

// [TAG] ... [/TAG] 形式のブロック拡張を作る共通ヘルパー。
// innerParse:true の場合、中身をブロックMarkdownとして再帰的に解釈する
// （POINT/CAUTION/SUMMARYのように箇条書き等を含められるようにするため）。
function blockExtension(options) {
  const name = options.name;
  const tag = options.tag;
  const className = options.className;
  const innerParse = options.innerParse;
  const open = new RegExp("^\\[" + tag + "\\]\\r?\\n?");
  const closeToken = "[/" + tag + "]";
  return {
    name: name,
    level: "block",
    start(src) {
      return src.search(new RegExp("\\[" + tag + "\\]"));
    },
    tokenizer(src) {
      const openMatch = open.exec(src);
      if (!openMatch) return undefined;
      const rest = src.slice(openMatch[0].length);
      const closeIndex = rest.indexOf(closeToken);
      if (closeIndex < 0) return undefined;
      const inner = rest.slice(0, closeIndex);
      const raw = src.slice(0, openMatch[0].length + closeIndex + closeToken.length);
      const token = { type: name, raw: raw, tokens: [] };
      if (innerParse) {
        this.lexer.blockTokens(inner.trim(), token.tokens);
      } else {
        token.text = inner.trim();
      }
      return token;
    },
    renderer(token) {
      const body = innerParse
        ? this.parser.parse(token.tokens)
        : "<p>" + this.parser.parseInline(this.lexer.inlineTokens(token.text)) + "</p>\n";
      return '<div class="' + className + '">' + body + "</div>\n";
    },
  };
}

function summaryExtension() {
  const base = blockExtension({ name: "courseSummary", tag: "SUMMARY", className: "course-summary", innerParse: true });
  base.renderer = function (token) {
    const body = this.parser.parse(token.tokens);
    return '<div class="course-summary"><p class="course-summary-label">この記事でわかること</p>' + body + "</div>\n";
  };
  return base;
}

function pointExtension() {
  return blockExtension({ name: "coursePoint", tag: "POINT", className: "course-point", innerParse: true });
}

function cautionExtension() {
  const base = blockExtension({ name: "courseCaution", tag: "CAUTION", className: "course-caution", innerParse: true });
  base.renderer = function (token) {
    const body = this.parser.parse(token.tokens);
    return '<div class="course-caution"><p class="course-caution-label">注意</p>' + body + "</div>\n";
  };
  return base;
}

function buhioExtension() {
  // type属性は未知の値でも受理し、buhioForType()側のフォールバックへ委ねる
  // （記法ミスでBUHIOブロックごと未変換にならないようにするため）。
  const openRe = /^\[BUHIO(?:\s+type="([a-zA-Z0-9_-]+)")?\]\r?\n?/;
  const closeToken = "[/BUHIO]";
  return {
    name: "courseBuhio",
    level: "block",
    start(src) {
      return src.search(/\[BUHIO/);
    },
    tokenizer(src) {
      const openMatch = openRe.exec(src);
      if (!openMatch) return undefined;
      const rest = src.slice(openMatch[0].length);
      const closeIndex = rest.indexOf(closeToken);
      if (closeIndex < 0) return undefined;
      const inner = rest.slice(0, closeIndex).trim();
      const raw = src.slice(0, openMatch[0].length + closeIndex + closeToken.length);
      return {
        type: "courseBuhio",
        raw: raw,
        buhioType: openMatch[1] || "",
        text: inner,
        tokens: this.lexer.inlineTokens(inner),
      };
    },
    renderer(token) {
      const meta = buhioForType(token.buhioType);
      const comment = this.parser.parseInline(token.tokens);
      const labelHtml = meta.label ? '<span class="course-buhio-tag">' + escapeHtml(meta.label) + "</span>" : "";
      return (
        '<div class="course-buhio">' +
        '<img src="../' + BUHIO_DIRECTORY + meta.file + '" alt="ぶひお" width="96" height="96" loading="lazy" decoding="async" class="course-buhio-img">' +
        '<div class="course-buhio-bubble">' +
        '<p class="course-buhio-name">ぶひお' + labelHtml + "</p>" +
        '<p class="course-buhio-comment">' + comment + "</p>" +
        "</div>" +
        "</div>\n"
      );
    },
  };
}

function markExtension() {
  return {
    name: "courseMark",
    level: "inline",
    start(src) {
      return src.indexOf("[MARK]");
    },
    tokenizer(src) {
      const match = /^\[MARK\]([\s\S]+?)\[\/MARK\]/.exec(src);
      if (!match) return undefined;
      return { type: "courseMark", raw: match[0], text: match[1], tokens: this.lexer.inlineTokens(match[1]) };
    },
    renderer(token) {
      return '<span class="course-mark">' + this.parser.parseInline(token.tokens) + "</span>";
    },
  };
}

function createCourseParser(depth) {
  const seenIds = new Set();
  const headings = [];
  const parser = new Marked({ gfm: true, async: false });
  parser.use({
    extensions: [summaryExtension(), pointExtension(), cautionExtension(), buhioExtension(), markExtension()],
    renderer: {
      heading(headingToken) {
        const tokens = headingToken.tokens;
        const level = headingToken.depth;
        const text = this.parser.parseInline(tokens);
        const plain = tokens.map((t) => (Object.prototype.hasOwnProperty.call(t, "text") ? t.text : "")).join("");
        if (level === 2 || level === 3) {
          const id = slugifyHeading(plain, seenIds);
          headings.push({ level: level, id: id, text: plain });
          return "<h" + level + ' id="' + id + '">' + text + "</h" + level + ">\n";
        }
        const tag = Math.max(2, Math.min(3, level));
        return "<h" + tag + ">" + text + "</h" + tag + ">\n";
      },
      image(imageToken) {
        const href = imageToken.href;
        const title = imageToken.title;
        const text = imageToken.text;
        if (!safeUrl(href)) return escapeHtml(text);
        const isAbsolute = /^(?:https?:)?\/\//i.test(href);
        const src = isAbsolute ? href : (depth === "course" ? "../" : "") + href.replace(/^\/+/, "");
        return (
          '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(text) + '"' +
          (title ? ' title="' + escapeHtml(title) + '"' : "") +
          ' loading="lazy" class="course-inline-image">'
        );
      },
      link(linkToken) {
        const href = linkToken.href;
        const title = linkToken.title;
        const label = this.parser.parseInline(linkToken.tokens);
        if (!safeUrl(href)) return label;
        return '<a href="' + escapeHtml(href) + '"' + (title ? ' title="' + escapeHtml(title) + '"' : "") + ">" + label + "</a>";
      },
    },
  });
  return { parser: parser, headings: headings };
}

// body: content/courses/<slug>.md の本文（front matter除く）
// depth: "course"（blog/相当の1階層下）を指定するとimg相対パスを補正
// 戻り値: { html, headings } … headingsは自動目次生成に使う
function courseBodyToHtml(body, depth) {
  const normalized = String(body || "").replace(/\r\n/g, "\n");
  const parsed = createCourseParser(depth);
  const html = parsed.parser.parse(normalized);
  return { html: html, headings: parsed.headings };
}

module.exports = { courseBodyToHtml: courseBodyToHtml, slugifyHeading: slugifyHeading, BUHIO_TYPE_MAP: BUHIO_TYPE_MAP };
