"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseFeed, collectLatestInfo, safeOfficialUrl } = require("../scripts/latest-info");
const { selectTopic, latestTopicSchema } = require("../scripts/topic-selector");
const { prepareDailyBlog } = require("../scripts/daily-blog");

const source = {name:"厚生労働省",url:"https://www.mhlw.go.jp/stf/news.rdf",priority:1};
const item = (title, url, date, summary="障害福祉事業者のデジタル活用に関する更新です") =>
  `<item><title><![CDATA[${title}]]></title><link>${url}</link><dc:date>${date}</dc:date><description>${summary}</description></item>`;
const feed = rows => `<?xml version="1.0"?><rdf:RDF>${rows.join("")}</rdf:RDF>`;
const response = body => ({ok:true,status:200,headers:{get:()=>String(Buffer.byteLength(body))},text:async()=>body});

test("Official RSS/Atom entries are normalized and non-official URLs are rejected",()=>{
  const rss=parseFeed(feed([item("障害福祉の更新","https://www.mhlw.go.jp/a","2026-09-11")]),source);
  assert.equal(rss.length,1);assert.equal(rss[0].source,"厚生労働省");assert.equal(rss[0].publishedAt,"2026-09-11T00:00:00.000Z");
  const atom=`<feed><entry><title>福祉DX</title><link href="https://www.digital.go.jp/news/a"/><updated>2026-09-10T00:00:00Z</updated><summary>事業者向け情報</summary></entry></feed>`;
  assert.equal(parseFeed(atom,{name:"デジタル庁"})[0].url,"https://www.digital.go.jp/news/a");
  assert.equal(safeOfficialUrl("https://example.com/fake"),null);
});

test("Collector tolerates one failed feed and returns three to ten relevant recent candidates",async()=>{
  const sources=[source,{name:"失敗する公的機関",url:"https://www.cao.go.jp/rss/news.rdf",priority:4}];
  const body=feed([
    item("障害福祉サービスのデジタル化","https://www.mhlw.go.jp/a","2026-09-11"),
    item("就労支援事業者向け情報","https://www.mhlw.go.jp/b","2026-09-10"),
    item("福祉事業者の業務効率化","https://www.mhlw.go.jp/c","2026-09-09"),
    item("無関係なお知らせ","https://www.mhlw.go.jp/d","2026-09-08","一般のお知らせ")
  ]);
  const result=await collectLatestInfo({now:new Date("2026-09-12T00:00:00Z"),sources,fetchImpl:async url=>{
    if(url.includes("cao.go.jp")) throw new Error("offline");
    return response(body);
  }});
  assert.equal(result.successfulSources,1);assert.equal(result.attemptedSources,2);
  assert.equal(result.candidates.length,3);assert.ok(result.candidates.every(row=>row.title&&row.url&&row.publishedAt&&row.source&&row.summary));
});

test("Latest candidates reach Gemini and trusted sources are appended to the temporary Markdown",async t=>{
  const candidates=[
    {title:"障害福祉のデジタル化資料",url:"https://www.mhlw.go.jp/a",publishedAt:"2026-09-11T00:00:00.000Z",source:"厚生労働省",summary:"障害福祉事業者向けのデジタル化資料を公開"},
    {title:"行政手続のオンライン化",url:"https://www.digital.go.jp/news/b",publishedAt:"2026-09-10T00:00:00.000Z",source:"デジタル庁",summary:"オンライン手続に関する更新"},
    {title:"AI活用に関する会議",url:"https://www.cao.go.jp/news/c",publishedAt:"2026-09-09T00:00:00.000Z",source:"内閣府",summary:"AI活用の会議資料を公開"}
  ];
  const existing=[{slug:"old",title:"採用ページの作り方",category:"採用",date:"2026-09-01",published:true,summary:"採用",headings:[]}];
  const topic={title:"障害福祉事業者が考えるデジタル化資料の実務活用",category:"IT活用",target:"障害福祉事業者",keyword:"障害福祉 デジタル化",reason:"新しい一次情報を現場で活用するため",angle:"小規模事業者が着手点を整理する",service:"IT活用支援",sourceUrls:[candidates[0].url],importance:"standard"};
  const article={title:topic.title,description:"厚生労働省の新しい資料をもとに、障害福祉事業者がデジタル化を実務へ生かす際の考え方を整理します。",bodyMarkdown:[
    "公表された情報の要点を確認し、事業所での取り組み方を整理します。",
    "## 今回の最新情報","厚生労働省から障害福祉事業者向けの資料が公表されました。".repeat(12),
    "## 何が発表・変更されたのか","公表資料で示された内容を、確認できる範囲で整理します。".repeat(12),
    "## 福祉事業者にどう関係するのか","日々の業務や情報管理を見直す材料になります。".repeat(12),
    "## 現場で考えるべきポイント","現在の業務を棚卸しし、小さな改善から検討します。".repeat(12),
    "## 福祉ITパートナーとしての見解","小規模事業者では目的と優先順位を明確にすることが大切です。".repeat(12),
    "## まとめ","一次情報を確認しながら自事業所に合う進め方を選びます。".repeat(10)
  ].join("\n\n")};
  const review=JSON.stringify({comparisons:[{slug:"old",duplicate:false,reason:"新規資料の実務活用であり採用ページとは異なる"}]});
  let calls=0;
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"latest-draft-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const result=await prepareDailyBlog({now:new Date("2026-09-11T21:00:00Z"),env:{GEMINI_API_KEY:"dummy"},articlesDir:directory,
    collect:async()=>({candidates,attemptedSources:3,successfulSources:3}),load:()=>existing,request:async args=>{
      calls++;
      if(calls===1){assert.deepEqual(args.schema,latestTopicSchema);assert.deepEqual(args.input.latestInformationCandidates,candidates);return JSON.stringify(topic);}
      if(calls===2)return review;
      assert.deepEqual(args.input.sourceInformation,[candidates[0]]);return JSON.stringify(article);
    }});
  const markdown=fs.readFileSync(result.draft.filePath,"utf8");
  assert.equal(result.contentMode,"latest_info");assert.equal(result.latestInformation.candidateCount,3);
  assert.match(markdown,/## 出典・参考情報/);assert.match(markdown,/\[厚生労働省｜障害福祉のデジタル化資料\]\(https:\/\/www\.mhlw\.go\.jp\/a\)/);
  assert.equal(result.shouldPublish,false);assert.equal(result.articlesCreated,1);
});

test("Fewer than three candidates automatically uses the established evergreen path",async()=>{
  let count=0;
  const result=await selectTopic({apiKey:"dummy",localDate:"2026-09-12",latestInfo:[],load:()=>[],request:async args=>{
    count++;return count===1?JSON.stringify({title:"福祉事業所の広報計画",category:"福祉事業所の広報",target:"福祉事業者",keyword:"福祉 広報",reason:"情報発信を整える",angle:"月次計画を作る",service:"広報支援"}):JSON.stringify({comparisons:[]});
  }});
  assert.equal(result.contentMode,"evergreen");assert.deepEqual(result.sources,[]);
});
