"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {markdownBodyToHtml,assertNoMarkdownLeak}=require("../scripts/lib/markdown");
const {recentStyles,styleDiagnostics,styleProblems,similar,validateEmphasis,editorialReviewSchema}=require("../scripts/lib/editorial");
const {generateArticle}=require("../scripts/article-generator");
const lib=require("../scripts/lib/articles");
test("Markdown parses adjacent h1–h6, escaped headings, nested emphasis, lists, code and tables",()=>{
  const html=markdownBodyToHtml('# 大見出し\n本文\n## 区切り\n文章\n### セキュリティ意識の共有\n案内\n#### 小項目\n短文\n##### 詳細\n説明\n###### 補足\n説明\n\\### 旧見出し\n本文\n\n**重要な *言葉* **\n\n**太字**と*斜体*と`入力例`と``コード``\n\n* 項目\n  * 内側\n\n1. 最初\n2. 次\n\n> 引用\n\n|項目|値|\n|---|---|\n|確認|済|\n\n---\n\n==覚える一文==','blog');
  for(const tag of ['h2','h3','h4','h5','h6','strong','em','code','ul','ol','blockquote','table','hr'])assert.ok(html.includes('<'+tag),tag);
  assert.ok(html.includes('<h3>セキュリティ意識の共有</h3>'));
  assert.ok(html.includes('<h3>旧見出し</h3>'));
  assert.ok(html.includes('class="article-marker"'));
  // An intentionally invalid Markdown pair is blocked, not silently published.
  assert.throws(()=>assertNoMarkdownLeak(html),/UNRENDERED/);
  assert.doesNotThrow(()=>assertNoMarkdownLeak(markdownBodyToHtml('### 見出し\n**太字**と*斜体*と``コード``\n\n* 項目','blog')));
  const japanese=markdownBodyToHtml('**「暮らす場所」**が分かる。*「引用」*も読める。','blog');
  assert.ok(japanese.includes('<strong>「暮らす場所」</strong>が'));
  assert.ok(japanese.includes('<em>「引用」</em>も'));
  assert.doesNotThrow(()=>assertNoMarkdownLeak(japanese));
  assert.throws(()=>assertNoMarkdownLeak('<p>*閉じ忘れた強調</p>'),/UNRENDERED/);
  assert.throws(()=>assertNoMarkdownLeak('<p>`閉じ忘れたコード</p>'),/UNRENDERED/);
});
test("Decorations are escaped, capped per h2 and emitted once; notices wrap paragraphs",()=>{
  const body='## 入口\n短い重要語と覚える一文を読んでね。\n\n短い重要語を再掲。\n\n## 安全\n個人情報は入力しないでください。\n\n別の説明。';
  const html=markdownBodyToHtml(body,'blog',[{style:'strong',text:'重要語'},{style:'marker',text:'覚える一文'},{style:'notice',text:'個人情報は入力しない'}]);
  assert.equal((html.match(/<strong>/g)||[]).length,1);
  assert.equal((html.match(/article-marker/g)||[]).length,1);
  assert.equal((html.match(/article-notice/g)||[]).length,1);
  assert.ok(!markdownBodyToHtml('[危険](javascript:alert)\n\n![画像](data:abc)','blog').includes('href="javascript'));
  assert.ok(markdownBodyToHtml('![説明](assets/images/buhio/buhio-01-standing.png)','blog').includes('../assets/images/buhio/'));
});
test("Malformed, absent and whole-paragraph emphasis are rejected",()=>{
  for(const value of [[{text:'ない言葉',style:'strong'}],[{text:'短い段落。',style:'strong'}],[{text:'段落',style:'html'}],[{text:'<b>',style:'strong'}]])assert.throws(()=>validateEmphasis(value,'短い段落。'));
});
test("Latest ten published articles use date and same-day creation order",()=>{
  const rows=Array.from({length:12},(_,i)=>({slug:'a'+i,date:'2026-09-12',title:'記事'+i,headings:['項目'+i],published:true,buhioComment:'コメント'+i}));
  const order=rows.map(x=>x.slug).reverse();
  const recent=recentStyles([...rows,{slug:'draft',date:'2026-09-13',published:false}],order);
  assert.equal(recent.length,10);assert.equal(recent[0].slug,'a11');assert.equal(recent[9].slug,'a2');assert.equal(recent[0].comment,'コメント11');
});
const topic={title:'夜勤の引き継ぎ記録を整理する',category:'IT活用',target:'職員',keyword:'引き継ぎ',reason:'記録の改善',angle:'夜勤',service:'IT支援'};
const body=['## 夜勤前に申し送り欄を読む','交代時に記録の置き場所を確認すると、担当者が変わっても必要な情報を探しやすくなります。'.repeat(12),'## 連絡済みかを記録に残す','誰に連絡したかを残すことは、職員同士の確認に役立ちます。'.repeat(14),'## 朝の確認項目を決める','毎朝、必要な記録がそろったかを点検する時間を作りましょう。'.repeat(10)].join('\n\n');
const article={title:topic.title,description:'夜勤の記録を読みやすく整理します。',bodyMarkdown:body,buhio:{image:'buhio-03-pointing.png',alt:'夜勤の記録を案内するぶひお',comment:'誰に連絡したかを残すと、次の職員も確認しやすくなるね。'},emphasis:[{text:'記録の置き場所',style:'strong'},{text:'必要な記録がそろったかを点検する時間',style:'marker'}]};
const history=[{slug:'old',title:'家族への連絡',headings:['家族への電話時間を決める'],comment:'ご家族に連絡した内容は、次の担当も読める場所に残しておこう。',summary:'家族への連絡'}];
const captureDiagnostics=()=>{const lines=[];return {lines,diagnosticLog:line=>lines.push(JSON.parse(line))};};
test("Literal duplicate triggers revision, semantic duplicate triggers a second review",async()=>{
  let generated=0,reviews=0;
  const result=await generateArticle({apiKey:'dummy',topic,recentArticleStyles:history,diagnosticLog:()=>{},request:async args=>{
    if(args.schema===editorialReviewSchema){reviews++;return JSON.stringify({commentDuplicate:reviews===1,commentGrounded:true,headingDuplicates:[]});}
    generated++;
    if(generated===1)return JSON.stringify({...article,buhio:{...article.buhio,comment:history[0].comment}});
    assert.ok(args.input.revisionFeedback.length);
    return JSON.stringify({...article,buhio:{...article.buhio,comment:generated===2?article.buhio.comment:'朝の申し送りで記録の不足を点検する時間も取ってみよう。'}});
  }});
  assert.equal(generated,3);assert.equal(reviews,2);assert.ok(result.buhio.comment.includes('朝'));
});
test("Emphasis retries log a stable rule and exhaust with the emphasis error",async()=>{
  let calls=0;const diagnostics=captureDiagnostics();
  const invalid={...article,bodyMarkdown:body+'\n\nAPI_KEY_SHOULD_NEVER_APPEAR',emphasis:[{text:'本文にない強調',style:'strong'},{text:'必要な記録がそろったかを点検する時間',style:'marker'}]};
  await assert.rejects(generateArticle({apiKey:'secret-api-key',topic,sources:[{summary:'SOURCE_BODY_SHOULD_NEVER_APPEAR'}],diagnosticLog:diagnostics.diagnosticLog,request:async()=>{calls++;return JSON.stringify(invalid);}}),{code:'ARTICLE_EMPHASIS_RETRY_EXHAUSTED'});
  assert.equal(calls,3);assert.deepEqual(diagnostics.lines,[
    {event:'daily_blog_article_retry',attempt:1,stage:'emphasis',rules:['emphasis_text_not_found'],retry:true},
    {event:'daily_blog_article_retry',attempt:2,stage:'emphasis',rules:['emphasis_text_not_found'],retry:true},
    {event:'daily_blog_article_retry',attempt:3,stage:'emphasis',rules:['emphasis_text_not_found'],retry:false}
  ]);
  const output=JSON.stringify(diagnostics.lines);assert.ok(!output.includes('secret-api-key'));assert.ok(!output.includes('API_KEY_SHOULD_NEVER_APPEAR'));assert.ok(!output.includes('SOURCE_BODY_SHOULD_NEVER_APPEAR'));assert.ok(!output.includes('本文にない強調'));assert.ok(!output.includes('emphasisは本文と完全一致'));
});
test("Local style retries log rule IDs and exhaust with the local-style error",async()=>{
  let calls=0;const diagnostics=captureDiagnostics();
  const repeated={...article,buhio:{...article.buhio,comment:history[0].comment}};
  assert.deepEqual(styleDiagnostics(repeated,history).map(item=>item.rule),['duplicate_recent_buhio_comment']);
  await assert.rejects(generateArticle({apiKey:'dummy',topic,recentArticleStyles:history,diagnosticLog:diagnostics.diagnosticLog,request:async()=>{calls++;return JSON.stringify(repeated);}}),{code:'ARTICLE_LOCAL_STYLE_RETRY_EXHAUSTED'});
  assert.equal(calls,3);
  assert.deepEqual(diagnostics.lines,[
    {event:'daily_blog_article_retry',attempt:1,stage:'local_style',rules:['duplicate_recent_buhio_comment'],retry:true},
    {event:'daily_blog_article_retry',attempt:2,stage:'local_style',rules:['duplicate_recent_buhio_comment'],retry:true},
    {event:'daily_blog_article_retry',attempt:3,stage:'local_style',rules:['duplicate_recent_buhio_comment'],retry:false}
  ]);
  assert.ok(similar('安全な使い方を職員で確認する','安全な使い方を職員で確認しましょう'));
});
test("Editorial review retries log semantic rule IDs and exhaust with the review error",async()=>{
  let generated=0,reviews=0;const diagnostics=captureDiagnostics();
  await assert.rejects(generateArticle({apiKey:'dummy',topic,recentArticleStyles:history,diagnosticLog:diagnostics.diagnosticLog,request:async args=>{
    if(args.schema===editorialReviewSchema){reviews++;return JSON.stringify({commentDuplicate:false,commentGrounded:false,headingDuplicates:['別の見出し']});}
    generated++;return JSON.stringify(article);
  }}),{code:'ARTICLE_EDITORIAL_REVIEW_RETRY_EXHAUSTED'});
  assert.equal(generated,3);assert.equal(reviews,3);assert.deepEqual(diagnostics.lines,[
    {event:'daily_blog_article_retry',attempt:1,stage:'editorial_review',rules:['buhio_comment_not_grounded','duplicate_heading_semantic'],retry:true},
    {event:'daily_blog_article_retry',attempt:2,stage:'editorial_review',rules:['buhio_comment_not_grounded','duplicate_heading_semantic'],retry:true},
    {event:'daily_blog_article_retry',attempt:3,stage:'editorial_review',rules:['buhio_comment_not_grounded','duplicate_heading_semantic'],retry:false}
  ]);
});
test("Successful article generation keeps the existing result and emits no retry diagnostics",async()=>{
  const diagnostics=captureDiagnostics();
  const result=await generateArticle({apiKey:'dummy',topic,diagnosticLog:diagnostics.diagnosticLog,request:async()=>JSON.stringify(article)});
  assert.deepEqual(result,article);assert.deepEqual(diagnostics.lines,[]);
});
test("Invalid semantic review cannot approve an article",async()=>{
  await assert.rejects(generateArticle({apiKey:'dummy',topic,recentArticleStyles:history,request:async args=>args.schema===editorialReviewSchema?'{}':JSON.stringify(article)}),{code:'INVALID_EDITORIAL_REVIEW'});
});
test("Every existing managed article renders without Markdown leakage",()=>{
  for(const article of lib.loadArticles()) {
    if(article.data.emphasis) assert.doesNotThrow(()=>validateEmphasis(article.data.emphasis,article.body),article.slug);
    assert.doesNotThrow(()=>assertNoMarkdownLeak(lib.markdownBodyToHtml(article.body,'blog',article.data.emphasis)),article.slug);
  }
});
