"use strict";
const { Marked, Renderer } = require("marked");
const escape = value => String(value || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const safeUrl = url => !/^[\s\u0000-\u0020]*(?:javascript|vbscript|data):/i.test(url);

function createParser(depth, emphasis = []) {
  let sectionCount = 0;
  let inHeading = false;
  let inDecoration = false;
  const used = new Set();
  const parser = new Marked({ gfm: true, async: false });
  parser.use({ extensions: [{
    // Japanese closing punctuation before a following particle is intentionally supported.
    name: "japaneseEmphasis", level: "inline", start: src => src.search(/\*{1,2}[「『（【]/),
    tokenizer(src) {
      const match=/^(\*{1,2})([「『（【][^\n]+?[」』）】])\1(?!\*)/.exec(src);
      if(match)return {type:"japaneseEmphasis",raw:match[0],strong:match[1].length===2,tokens:this.lexer.inlineTokens(match[2])};
    },
    renderer(token) {const tag=token.strong?"strong":"em";return `<${tag}>${this.parser.parseInline(token.tokens)}</${tag}>`;}
  },{
    name: "marker", level: "inline", start: src => src.indexOf("=="),
    tokenizer(src) {
      const match = /^==([^=\n]+)==/.exec(src);
      if (match) return {type:"marker",raw:match[0],text:match[1],tokens:this.lexer.inlineTokens(match[1])};
    },
    renderer(token) { return `<span class="article-marker">${this.parser.parseInline(token.tokens)}</span>`; }
  },{
    name: "decorationTag", level: "inline", start: src => src.search(/\[(?:marker|strong|notice)\s*[:：]/),
    tokenizer(src) {
      const match = /^\[(marker|strong|notice)\s*[:：]\s*([^\]\n]+?)\s*\]/.exec(src);
      if (match) return {type:"decorationTag",raw:match[0],style:match[1],text:match[2],tokens:this.lexer.inlineTokens(match[2])};
    },
    renderer(token) {
      for (const item of emphasis) if (item.style !== "notice" && token.text.includes(item.text)) used.add(item);
      const outer=inDecoration;
      inDecoration = true;
      const body = this.parser.parseInline(token.tokens);
      inDecoration = outer;
      if (token.style === "strong") return `<strong>${body}</strong>`;
      if (token.style === "marker") return `<span class="article-marker">${body}</span>`;
      return body; // notice: the paragraph renderer turns the whole paragraph into a notice box
    }
  }], renderer: {
    heading({tokens,depth:level}) {
      if (level <= 2) sectionCount = 0;
      inHeading = true;
      const text = this.parser.parseInline(tokens);
      inHeading = false;
      const tag = Math.max(2, level);
      return `<h${tag}>${text}</h${tag}>\n`;
    },
    text(token) {
      if (token.tokens) return this.parser.parseInline(token.tokens);
      const raw = token.text;
      if (inHeading || inDecoration || sectionCount >= 2) return Renderer.prototype.text.call(this,token);
      const choices = emphasis.filter(item => item.style !== "notice" && !used.has(item) && raw.includes(item.text));
      if (!choices.length) return Renderer.prototype.text.call(this,token);
      let cursor = 0, result = "";
      for (const item of choices.sort((a,b) => raw.indexOf(a.text)-raw.indexOf(b.text))) {
        const index = raw.indexOf(item.text, cursor);
        if (index < 0 || sectionCount >= 2) continue;
        result += escape(raw.slice(cursor,index));
        result += item.style === "strong" ? `<strong>${escape(item.text)}</strong>` : `<span class="article-marker">${escape(item.text)}</span>`;
        cursor=index+item.text.length; used.add(item); sectionCount++;
      }
      return result+escape(raw.slice(cursor));
    },
    paragraph({tokens,text}) {
      const notice=emphasis.find(item=>item.style==="notice" && !used.has(item) && text.includes(item.text));
      const taggedNotice=tokens.some(t=>t.type==="decorationTag" && t.style==="notice");
      if(taggedNotice || (notice && sectionCount<2)) {
        if(notice) {used.add(notice);sectionCount++;}
        inDecoration=true;
        const body=this.parser.parseInline(tokens);inDecoration=false;
        return `<div class="article-notice" role="note"><p>${body}</p></div>\n`;
      }
      return `<p>${this.parser.parseInline(tokens)}</p>\n`;
    },
    image({href,title,text}) {
      if (!safeUrl(href)) return escape(text);
      const src = /^(?:https?:)?\/\//i.test(href) ? href : (depth === "blog" ? "../" : "") + href.replace(/^\/+/, "");
      return `<img src="${escape(src)}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ""} loading="lazy" class="article-inline-image">`;
    },
    link({href,title,tokens}) {
      const label=this.parser.parseInline(tokens);
      return safeUrl(href) ? `<a href="${escape(href)}"${title ? ` title="${escape(title)}"` : ""}>${label}</a>` : label;
    }
  }});
  return parser;
}

// Gemini sometimes writes decoration hints inline as "[marker:...]" despite the
// emphasis array. New drafts drop the wrapper (the emphasis array decorates the words);
// already-published articles render the tag as the decoration it asked for.
const INLINE_DECORATION_TAG=/\[(?:marker|strong|notice)\s*[:：]\s*([^\]\n]+?)\s*\]/g;
function stripInlineDecorationTags(body) {
  return String(body||"").replace(INLINE_DECORATION_TAG,"$1");
}

function markdownBodyToHtml(body, depth, emphasis = []) {
  // Historical CMS blocks contain hand-authored HTML; the AI validator still forbids HTML.
  // Recover the escaped heading form that some generated articles used by mistake.
  const normalized=String(body||"").replace(/^\s*\\(#{1,6}\s)/gm,"$1");
  return createParser(depth, emphasis).parse(normalized);
}
function assertNoMarkdownLeak(html) {
  // Code examples may legitimately show syntax. Check reader-visible prose, not URLs/attributes.
  const prose=html.replace(/<(script|style|pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi,"")
    .replace(/<[^>]+>/g,"\n");
  if(/(?:^|\s)\\?#{1,6}\s|[*`]|==[^=\n]+==|\[(?:marker|strong|notice)\s*[:：]|^\s*\+\s+\S/m.test(prose)) {
    throw Error("UNRENDERED_ARTICLE_MARKDOWN");
  }
}
module.exports = { stripInlineDecorationTags, markdownBodyToHtml, createParser, assertNoMarkdownLeak };
