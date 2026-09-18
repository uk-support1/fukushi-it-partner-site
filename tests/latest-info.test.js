"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseFeed, collectLatestInfo, safeOfficialUrl, DEFAULT_SOURCES, ALLOWED_HOSTS, NO_ENRICH_HOSTS, loadYoutubeCache } = require("../scripts/latest-info");
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

test("the welfare-industry WAM NET source is allowed and generic news sites like Yahoo are not",()=>{
  assert.ok(DEFAULT_SOURCES.some(item=>item.url==="https://www.wam.go.jp/gyoseiShiryou/new_rss"));
  assert.ok(ALLOWED_HOSTS.has("www.wam.go.jp"));
  assert.equal(safeOfficialUrl("https://news.yahoo.co.jp/pickup/1"),null);
  assert.equal(safeOfficialUrl("https://www.wam.go.jp/gyoseiShiryou/detail?gno=1"),"https://www.wam.go.jp/gyoseiShiryou/detail?gno=1");
});

test("the four requested YouTube channels are registered as video-kind sources with real channel RSS URLs",()=>{
  const expected=["精神保健福祉士うさぎ","精神科医がこころの病気を解説するCh（益田裕介）","WithYouチャンネル（精神・発達専門の就労移行支援）","ケアきょう（介護職のためのチャンネル）"];
  const videoSources=DEFAULT_SOURCES.filter(item=>item.kind==="video");
  assert.equal(videoSources.length,4);
  for(const name of expected) assert.ok(videoSources.some(item=>item.name===name),name);
  for(const item of videoSources) {
    assert.match(item.url,/^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC/);
    assert.ok(ALLOWED_HOSTS.has(new URL(item.url).hostname));
  }
  assert.ok(NO_ENRICH_HOSTS.has("www.youtube.com"));
});

test("a YouTube Atom entry is parsed with its kind and real media:description, not just the title",()=>{
  const atom=`<feed xmlns:media="http://search.yahoo.com/mrss/"><entry><title>就労移行支援の見学で見るべきポイント</title>` +
    `<link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/><published>2026-09-16T09:00:00+00:00</published>` +
    `<media:group><media:description>精神・発達障害の就労移行支援を選ぶときに確認したい3つの視点を紹介します。</media:description></media:group></entry></feed>`;
  const [candidate]=parseFeed(atom,{name:"WithYouチャンネル（精神・発達専門の就労移行支援）",url:"https://www.youtube.com/feeds/videos.xml?channel_id=UCYG77cJbgyh0clabzxFN6pg",kind:"video"});
  assert.equal(candidate.url,"https://www.youtube.com/watch?v=abc123");
  assert.equal(candidate.kind,"video");
  assert.equal(candidate.summary,"精神・発達障害の就労移行支援を選ぶときに確認したい3つの視点を紹介します。");
});

test("YouTube candidates skip page enrichment (a JS app, not prose) while official candidates still get enriched",async()=>{
  const youtubeAtom=`<feed><entry><title>介護職の夜勤の乗り切り方</title><link rel="alternate" href="https://www.youtube.com/watch?v=xyz789"/>` +
    `<published>2026-09-16T00:00:00+00:00</published><summary>介護職員向けの夜勤対応のコツを紹介する動画です。</summary></entry></feed>`;
  const sources=[
    {name:"ケアきょう（介護職のためのチャンネル）",url:"https://www.youtube.com/feeds/videos.xml?channel_id=UCNkibDFHKRpY3KNm-jTTIsQ",priority:3,kind:"video"},
    source
  ];
  const officialBody=feed([item("福祉事業者の業務効率化","https://www.mhlw.go.jp/c","2026-09-16")]);
  const fetched=[];
  const result=await collectLatestInfo({now:new Date("2026-09-17T00:00:00Z"),sources,fetchImpl:async url=>{
    fetched.push(url);
    if(url.includes("youtube.com/feeds")) return response(youtubeAtom);
    if(url.includes("youtube.com/watch")) throw new Error("must not scrape the YouTube watch page");
    if(url===source.url) return response(officialBody);
    const page=`<main>${"厚生労働省の公式ページ本文がここに入ります。".repeat(5)}</main>`;
    return {ok:true,status:200,headers:{get:name=>name==="content-type"?"text/html; charset=utf-8":String(Buffer.byteLength(page))},text:async()=>page};
  }});
  assert.equal(fetched.filter(url=>url.includes("youtube.com/watch")).length,0);
  const youtubeCandidate=result.candidates.find(item=>item.url.includes("youtube.com/watch"));
  assert.equal(youtubeCandidate.summary,"介護職員向けの夜勤対応のコツを紹介する動画です。");
  const officialCandidate=result.candidates.find(item=>item.url==="https://www.mhlw.go.jp/c");
  assert.match(officialCandidate.summary,/厚生労働省の公式ページ本文/);
});

test("collectLatestInfo merges extraCandidates through the same relevance/freshness/dedup pipeline",async()=>{
  const fresh={title:"就労移行支援の見学ポイント",url:"https://www.youtube.com/watch?v=cached1",publishedAt:"2026-09-16T00:00:00.000Z",source:"WithYouチャンネル",summary:"就労移行支援の見学で確認したい点を紹介します。",kind:"video"};
  const stale={title:"古い動画",url:"https://www.youtube.com/watch?v=stale",publishedAt:"2026-01-01T00:00:00.000Z",source:"WithYouチャンネル",summary:"障害福祉に関する古い動画です。"};
  const irrelevant={title:"今日のランチ",url:"https://www.youtube.com/watch?v=off-topic",publishedAt:"2026-09-16T00:00:00.000Z",source:"WithYouチャンネル",summary:"今日食べたお昼ご飯の感想を話す雑談回です。"};
  const unsafeHost={title:"許可されていないホスト",url:"https://example.com/a",publishedAt:"2026-09-16T00:00:00.000Z",source:"不明"};
  const result=await collectLatestInfo({now:new Date("2026-09-17T00:00:00Z"),sources:[],fetchImpl:async()=>{throw new Error("no live sources expected");},
    extraCandidates:[fresh,stale,unsafeHost,irrelevant]});
  assert.deepEqual(result.candidates.map(item=>item.url),["https://www.youtube.com/watch?v=cached1"]);
});

test("loadYoutubeCache returns fresh cached candidates and safely ignores missing, stale, or corrupt files",t=>{
  const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),"youtube-cache-")),"youtube-cache.json");
  t.after(()=>fs.rmSync(path.dirname(file),{recursive:true,force:true}));
  assert.deepEqual(loadYoutubeCache({file}),[]);
  const candidate={title:"障がい者施設のクッキーについて",url:"https://www.youtube.com/watch?v=k596ZRNsvsU",publishedAt:"2026-09-16T09:00:39.000Z",source:"精神保健福祉士うさぎ",summary:"福祉施設に関する動画です。",kind:"video"};
  fs.writeFileSync(file,JSON.stringify({fetchedAt:"2026-09-16T09:00:00.000Z",candidates:[candidate]}));
  assert.deepEqual(loadYoutubeCache({file,now:new Date("2026-09-17T00:00:00Z")}),[candidate]);
  assert.deepEqual(loadYoutubeCache({file,now:new Date("2026-09-24T00:00:00Z")}),[],"9 days old exceeds the 7-day default");
  fs.writeFileSync(file,JSON.stringify({fetchedAt:"2026-09-16T09:00:00.000Z",candidates:[{...candidate,url:"https://example.com/not-allowed"}]}));
  assert.deepEqual(loadYoutubeCache({file,now:new Date("2026-09-17T00:00:00Z")}),[]);
  fs.writeFileSync(file,"not json");
  assert.deepEqual(loadYoutubeCache({file}),[]);
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
    "## 厚生労働省のデジタル化資料を読む","厚生労働省から障害福祉事業者向けの資料が公表されました。".repeat(12),
    "## 公表資料から読み取れる取り組み","公表資料で示された内容を、確認できる範囲で整理します。".repeat(12),
    "## 情報管理の手順を見直す材料に","日々の業務や情報管理を見直す材料になります。".repeat(12),
    "## 業務の棚卸しで着手点を探す","現在の業務を棚卸しし、小さな改善から検討します。".repeat(12),
    "## 当社は目的と優先順位を重視します","小規模事業者では目的と優先順位を明確にすることが大切です。".repeat(12),
    "## 自事業所に合う進め方を選ぼう","一次情報を確認しながら自事業所に合う進め方を選びます。".repeat(10)
  ].join("\n\n"),buhio:{image:"buhio-03-pointing.png",alt:"デジタル化資料を案内するぶひお",comment:"資料を読んだら、今の業務で見直せる手順を一つ探してみよう。"},
  emphasis:[{text:"確認できる範囲",style:"strong"},{text:"目的と優先順位を明確にすることが大切です。",style:"marker"}]};
  const review=JSON.stringify({comparisons:[{slug:"old",duplicate:false,reason:"新規資料の実務活用であり採用ページとは異なる"}]});
  let calls=0;
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"latest-draft-"));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const result=await prepareDailyBlog({now:new Date("2026-09-11T21:00:00Z"),env:{GEMINI_API_KEY:"dummy"},articlesDir:directory,
    collect:async()=>({candidates,attemptedSources:3,successfulSources:3}),load:()=>existing,request:async args=>{
      calls++;
      if(Object.hasOwn(args.schema.properties,"commentDuplicate")) return JSON.stringify({commentDuplicate:false,commentGrounded:true,headingDuplicates:[]});
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

test("A source URL already used by the previous article is removed before topic selection",async()=>{
  const latest=["a","b","c"].map(id=>({title:id,url:`https://www.mhlw.go.jp/${id}`,publishedAt:"2026-09-12T00:00:00Z",source:"厚生労働省",summary:"福祉"}));
  let count=0;
  const result=await selectTopic({apiKey:"dummy",localDate:"2026-09-12",latestInfo:latest,
    load:()=>[{slug:"previous",title:"前の記事",category:"IT活用",date:"2026-09-12",published:true,summary:"前の記事",headings:[],sourceUrls:[latest[0].url]}],
    request:async args=>{count++;assert.equal(args.input.latestInformationCandidates,undefined);return count===1
      ?JSON.stringify({title:"福祉事業所の広報計画",category:"福祉事業所の広報",target:"福祉事業者",keyword:"福祉 広報",reason:"別テーマ",angle:"月次計画",service:"広報支援"})
      :JSON.stringify({comparisons:[{slug:"previous",duplicate:false,reason:"異なるテーマ"}]});}});
  assert.equal(result.contentMode,"evergreen");
});
