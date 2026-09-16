"use strict";
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const normalize = text => String(text).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
function similar(a,b) {
  a=normalize(a);b=normalize(b);
  if (!a || !b) return false;
  if(a===b || (Math.min(a.length,b.length)>=8 && (a.includes(b)||b.includes(a)))) return true;
  const grams=s=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
  const x=grams(a),y=grams(b);
  return 2*[...x].filter(g=>y.has(g)).length/(x.size+y.size)>=0.65;
}
function headingsOf(body) {
  return [...String(body||"").matchAll(/^\s*\\?#{2,6}\s+(.+?)\s*#*\s*$/gm)].map(m=>m[1].replace(/[*`]/g,""));
}
function creationOrder(root=path.resolve(__dirname,"../..")) {
  try {
    // Same-day continuous trial articles need commit order, not alphabetical slug order.
    return [...new Set(execFileSync("git",["log","--diff-filter=A","--format=","--name-only","--","content/articles"],{cwd:root,encoding:"utf8",stdio:["ignore","pipe","ignore"]}).split(/\r?\n/).filter(Boolean).map(file=>path.basename(file,".md")))];
  } catch { return []; }
}
function recentStyles(articles, order=creationOrder()) {
  const rank=slug=>order.includes(slug)?order.indexOf(slug):Number.MAX_SAFE_INTEGER;
  return articles.filter(a=>a.published!==false).slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")) || rank(a.slug)-rank(b.slug))
    .slice(0,10).map(a=>({slug:a.slug,title:a.title,headings:a.headings||[],comment:a.buhioComment||"",summary:String(a.summary||"").slice(0,600)}));
}
function styleDiagnostics(article, history) {
  const diagnostics=[];
  const add=(rule,feedback)=>diagnostics.push({rule,feedback});
  try {
    const {markdownBodyToHtml,assertNoMarkdownLeak}=require("./markdown");
    assertNoMarkdownLeak(markdownBodyToHtml(article.bodyMarkdown,"blog",article.emphasis||[]));
  } catch {add("markdown_leak","Markdown記号が本文に露出しない正しい見出し・リスト構文に修正する");}
  if(/\*\*|==[^=]+==/.test(article.bodyMarkdown)) add("direct_markdown_emphasis","本文中の太字・マーカー記号はemphasisの指定に移す");
  const headings=headingsOf(article.bodyMarkdown);
  const fixed=/^(今回の最新情報|何が発表・変更されたのか|何が変わるのか|福祉事業者にどう関係するのか|福祉事業者への影響|現場で考えるべきポイント|福祉ITパートナーとしての見解|福祉事業所としての見解|まとめ)$/;
  if(headings.some(h=>fixed.test(h))) add("forbidden_fixed_heading","固定見出しを使わず、節の内容に固有の問いを付ける");
  if(headings.some((h,i)=>headings.slice(0,i).some(old=>similar(h,old)))) add("duplicate_internal_heading","記事内の見出し同士の重複を避ける");
  if(headings.some(h=>history.some(a=>a.headings.some(old=>similar(h,old))))) add("duplicate_recent_heading","直近10記事と似た見出しを別の問い・切り口にする");
  const comment=article.buhio?.comment||"";
  if(comment.length<20 || comment.length>60) add("invalid_buhio_comment_length","ぶひおコメントを20〜60文字にする");
  if(history.some(a=>a.comment && similar(comment,a.comment))) add("duplicate_recent_buhio_comment","ぶひおコメントを直近10記事と異なる具体的な行動・要点にする");
  if(!Array.isArray(article.emphasis) || !article.emphasis.some(e=>e.style==="strong") || !article.emphasis.some(e=>e.style==="marker")) add("missing_required_emphasis","本文から短い重要語と重要文をemphasisに指定する");
  return diagnostics;
}
function styleProblems(article, history) {
  return styleDiagnostics(article,history).map(item=>item.feedback);
}
function emphasisError(rule) {
  const error=Error("INVALID_ARTICLE_EMPHASIS");
  error.rule=rule;
  return error;
}
function validateEmphasis(value, body) {
  if(!Array.isArray(value)) throw emphasisError("emphasis_not_array");
  if(value.length>16) throw emphasisError("too_many_emphasis");
  const used=new Set();
  const counts=new Map();
  return value.map(item=>{
    if(!item || Object.keys(item).sort().join(",")!=="style,text" || !["strong","marker","notice"].includes(item.style) ||
       typeof item.text!=="string" || item.text.length<2 || item.text.length>120 || /[<>\r\n*`=]/.test(item.text)) throw emphasisError("invalid_emphasis_format");
    if(!body.includes(item.text)) throw emphasisError("emphasis_text_not_found");
    if(used.has(item.text)) throw emphasisError("duplicate_emphasis_text");
    let position=body.indexOf(item.text);
    while(position>=0 && /^\s*#{1,6}\s/.test(body.slice(0,position).split(/\r?\n/).pop())) position=body.indexOf(item.text,position+item.text.length);
    if(position<0) throw emphasisError("emphasis_targets_heading");
    const section=(body.slice(0,position).match(/^##\s/gm)||[]).length;
    counts.set(section,(counts.get(section)||0)+1);
    if(counts.get(section)>2) throw emphasisError("too_many_emphasis_in_section");
    const line=body.slice(0,position).split(/\r?\n/).pop();
    const paragraph=body.split(/\n\s*\n/).find(p=>p.includes(item.text))?.trim();
    if(/^#{1,6}\s/.test(line)) throw emphasisError("emphasis_targets_heading");
    if(item.style==="strong" && paragraph===item.text) throw emphasisError("strong_is_whole_paragraph");
    if(item.style==="strong" && item.text.length>30) throw emphasisError("strong_too_long");
    used.add(item.text);return {text:item.text,style:item.style};
  });
}
const editorialReviewSchema={type:"object",additionalProperties:false,required:["commentDuplicate","headingDuplicates","commentGrounded"],properties:{
  commentDuplicate:{type:"boolean"},commentGrounded:{type:"boolean"},headingDuplicates:{type:"array",items:{type:"string"}}
}};
module.exports={similar,headingsOf,creationOrder,recentStyles,styleDiagnostics,styleProblems,validateEmphasis,editorialReviewSchema};
