"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("fs"),path=require("path"),cp=require("child_process"),crypto=require("crypto");
const {existingArticleInfo,validateTopic,validateReview,requestGemini,selectTopic,topicSchema,DEFAULT_GEMINI_MODEL}=require("../scripts/topic-selector");
const {prepareDailyBlog,failureReport}=require("../scripts/daily-blog");
const {generateArticle,validateArticle,articleSchema}=require("../scripts/article-generator");
const YAML=require("yaml");
const ROOT=path.resolve(__dirname,"..");
const articles=[{slug:"vacancy",title:"グループホームの空室情報をホームページで伝える方法",category:"空室対策",summary:"空室情報を掲載して入居相談を増やす",headings:["掲載すべき情報"]}];
const topic={title:"福祉事業所の採用応募フォームで入力負担を減らす設計",category:"採用",target:"福祉事業所の採用担当者",keyword:"福祉 採用 応募フォーム",reason:"空室案内ではなく職員応募時の離脱に着目",angle:"応募入力項目を減らし途中離脱を抑える",service:"ホームページ改善支援"};
const env={GEMINI_API_KEY:"test-only-not-a-real-key",GEMINI_MODEL:"gemini-3.5-flash-lite"};
const review=rows=>JSON.stringify({comparisons:rows.map(a=>({slug:a.slug,duplicate:false,reason:"解決する課題が異なる"}))});
const ok=text=>({ok:true,status:200,text:async()=>JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text}]}}]})});
const articleBody=[
  "福祉事業所の採用ページでは、応募する方が迷わず次の行動へ進める情報整理が大切です。現場の負担にも配慮しながら、できるところから見直していきましょう。",
  "## 応募する方が知りたい情報を整理する",
  "仕事内容や勤務場所、応募後の流れを分かりやすくまとめます。担当者だけで決めず、実際に問い合わせを受ける職員の声も確認すると、説明が不足している箇所を見つけやすくなります。".repeat(5),
  "## 入力項目を必要なものに絞る",
  "最初の連絡で確認する内容と、面談後に確認できる内容を分けます。入力欄の目的を一つずつ確認し、その時点で不要なものを減らすと、応募する方にも担当者にも扱いやすいフォームになります。".repeat(5),
  "## スマートフォンで操作を確認する",
  "採用情報から応募フォームまでを実際に操作し、文字の読みやすさやボタンの位置、エラー表示を確認します。公開後も職員が定期的に試すことで、小さな使いにくさに気づきやすくなります。".repeat(5),
  "## まとめ｜小さな改善から始める",
  "応募フォームは、一度に作り直す必要はありません。質問を一つ減らす、案内文を分かりやすくするなど、確認できた課題から順番に整えることが、応募しやすい入口づくりにつながります。".repeat(4)
].join("\n\n");
const generatedArticle={title:topic.title,description:"福祉事業所の採用応募フォームについて、入力負担を減らし応募しやすい入口を整える実務的なポイントを紹介します。",bodyMarkdown:articleBody};
test("1/2: published Markdown context includes title/category/body/headings; drafts excluded",()=>{
  const real=existingArticleInfo();assert.ok(real.length>=9);assert.ok(real.every(a=>a.title&&a.category&&a.summary&&Array.isArray(a.headings)));
  const row={slug:"one",data:{published:true,title:"Title",type:"column"},body:"## Heading\n\nBody"};
  const data=existingArticleInfo([row,{...row,slug:"draft",data:{...row.data,published:false}}]);
  assert.equal(data.length,1);assert.ok(data[0].summary.includes("Body"));assert.deepEqual(data[0].headings,["Heading"]);
});
test("Workflow keeps 06:00 JST schedule, manual trigger, read-only token and secret/variable wiring",()=>{
  const workflow=YAML.parse(fs.readFileSync(path.join(ROOT,".github/workflows/daily-blog.yml"),"utf8"));
  assert.equal(workflow.on.schedule[0].cron,"0 21 * * *");
  assert.deepEqual(workflow.on.workflow_dispatch,{});
  assert.deepEqual(workflow.permissions,{contents:"read"});
  const select=workflow.jobs.start.steps.find(step=>step.name==="Select today's topic");
  assert.equal(select.env.GEMINI_API_KEY,"${{ secrets.GEMINI_API_KEY }}");
  assert.equal(select.env.GEMINI_MODEL,"${{ vars.GEMINI_MODEL }}");
});
test("Missing key stops safely; missing model defaults to Flash-Lite",async()=>{
  let called=false;const request=async()=>{called=true;},load=()=>{called=true;return articles;};
  await assert.rejects(selectTopic({apiKey:"",model:"gemini-3.5-flash-lite",request,load}),{code:"GEMINI_API_KEY_MISSING"});
  assert.equal(called,false);
  let selectedModel;
  let count=0;
  await selectTopic({apiKey:"dummy",model:"",load:()=>articles,request:async args=>{
    selectedModel=args.model;return ++count===1?JSON.stringify(topic):review(articles);
  }});
  assert.equal(selectedModel,DEFAULT_GEMINI_MODEL);
  const result=cp.spawnSync(process.execPath,["scripts/daily-blog.js"],{cwd:ROOT,encoding:"utf8",env:{...process.env,GEMINI_API_KEY:"",GEMINI_MODEL:""}});
  assert.equal(result.status,1);assert.equal(result.stdout,"");assert.equal(JSON.parse(result.stderr).error,"GEMINI_API_KEY_MISSING");
});
test("Gemini 3.5 Flash can be selected and 2.5/unapproved models are rejected",async()=>{
  let count=0,selectedModel;
  await selectTopic({apiKey:"dummy",model:"gemini-3.5-flash",load:()=>articles,request:async args=>{
    selectedModel=args.model;return ++count===1?JSON.stringify(topic):review(articles);
  }});
  assert.equal(selectedModel,"gemini-3.5-flash");
  for (const model of ["gemini-2.5-flash-lite","gemini-2.5-flash","gemini-3.5-pro"]) {
    let called=false;
    await assert.rejects(selectTopic({apiKey:"dummy",model,load:()=>{called=true;},request:async()=>{called=true;}}),{code:"GEMINI_MODEL_NOT_ALLOWED"});
    assert.equal(called,false);
  }
});
test("Topic selection flows into article generation and never publishes",async()=>{
  const requests=[];const result=await prepareDailyBlog({env,now:new Date("2026-09-11T21:00:00Z"),load:()=>articles,request:async args=>{
    requests.push(args);return requests.length===1?JSON.stringify(topic):requests.length===2?review(articles):JSON.stringify(generatedArticle);
  }});
  assert.equal(result.localDate,"2026-09-12");assert.deepEqual(result.topic,topic);assert.deepEqual(result.article,generatedArticle);
  assert.equal(result.status,"article_generated");assert.equal(result.shouldPublish,false);assert.equal(result.articlesCreated,0);
  assert.equal(requests.length,3);assert.deepEqual(requests[0].input.existingArticles,articles);assert.deepEqual(requests[1].input.candidate,topic);
  assert.deepEqual(requests[2].input.topic,topic);assert.deepEqual(requests[2].schema,articleSchema);
});
test("Article JSON returns title, description and bodyMarkdown",async()=>{
  const requests=[];
  const result=await generateArticle({apiKey:"dummy",model:DEFAULT_GEMINI_MODEL,localDate:"2026-09-12",topic,request:async args=>{
    requests.push(args);return JSON.stringify(generatedArticle);
  }});
  assert.deepEqual(result,generatedArticle);assert.equal(requests.length,1);assert.deepEqual(requests[0].input.topic,topic);
  assert.equal(requests[0].input.outputRequirements.language,"ja");assert.equal(requests[0].model,DEFAULT_GEMINI_MODEL);
  assert.match(requests[0].instructions,/存在しない制度/);assert.match(requests[0].instructions,/一般論に留め/);
});
test("Article validation rejects empty body, malformed JSON, missing fields and changed title",()=>{
  assert.deepEqual(validateArticle(JSON.stringify(generatedArticle),topic),generatedArticle);
  for(const raw of ["not JSON",JSON.stringify({...generatedArticle,bodyMarkdown:""}),
    JSON.stringify({title:topic.title,bodyMarkdown:articleBody}),JSON.stringify({...generatedArticle,title:"別のタイトル"})]) {
    assert.throws(()=>validateArticle(raw,topic));
  }
});
test("Gemini failure stops article generation",async()=>{
  await assert.rejects(generateArticle({apiKey:"dummy",model:DEFAULT_GEMINI_MODEL,localDate:"2026-09-12",topic,
    request:async()=>{throw new (require("../scripts/topic-selector").TopicError)("GEMINI_HTTP_ERROR",{httpStatus:429,apiErrorStatus:"RESOURCE_EXHAUSTED",apiErrorCode:429,message:"Quota exceeded"});}}),
  {code:"GEMINI_HTTP_ERROR"});
});
test("5/6: malformed JSON, missing/extra fields, invalid categories and HTML rejected",()=>{
  for(const raw of ["not JSON","```json\n{}\n```","[]",JSON.stringify({title:"only title"}),JSON.stringify({...topic,extra:true}),JSON.stringify({...topic,category:"other"}),JSON.stringify({...topic,title:"<script>bad</script>"})])assert.throws(()=>validateTopic(raw,articles));
  assert.deepEqual(validateTopic(JSON.stringify(topic),articles),topic);
});
test("Duplicate titles and near titles rejected locally",()=>{
  for(const title of [articles[0].title,articles[0].title+"とは？"])assert.throws(()=>validateTopic(JSON.stringify({...topic,title}),articles),{code:"DUPLICATE_TOPIC"});
});
test("Semantically duplicate paraphrases rejected by independent review",async()=>{
  let count=0;
  await assert.rejects(selectTopic({apiKey:"dummy",model:DEFAULT_GEMINI_MODEL,load:()=>articles,request:async()=>++count===1?JSON.stringify({...topic,title:"入居相談を増やすウェブ上の募集案内",angle:"住まいの空き状況を案内する"}):JSON.stringify({comparisons:[{slug:"vacancy",duplicate:true,reason:"同じ空室案内の課題と解決策"}]})}),{code:"DUPLICATE_TOPIC"});
});
test("Incomplete/invalid semantic review fails closed",()=>{
  for(const raw of ["{}",review([]),review([{slug:"unknown"}]),JSON.stringify({comparisons:[{slug:"vacancy",duplicate:"false",reason:"reason"}]})])assert.throws(()=>validateReview(raw,articles));
  assert.throws(()=>validateReview(review([articles[0],articles[0]]),[articles[0],{...articles[0],slug:"other"}]));
});
test("Gemini request uses generateContent, API-key header and structured JSON",async()=>{
  const text=await requestGemini({apiKey:"dummy",model:DEFAULT_GEMINI_MODEL,instructions:"instructions",input:{articles},schema:topicSchema},async(url,options)=>{
    assert.equal(url,"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    assert.equal(options.headers["x-goog-api-key"],"dummy");assert.equal(options.headers.Authorization,undefined);
    const body=JSON.parse(options.body);
    assert.equal(body.systemInstruction.parts[0].text,"instructions");
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text),{articles});
    assert.equal(body.generationConfig.responseMimeType,"application/json");
    assert.deepEqual(body.generationConfig.responseJsonSchema,topicSchema);
    assert.equal(body.generationConfig.maxOutputTokens,8000);
    assert.ok(!options.body.includes("dummy"));assert.equal(options.redirect,"error");assert.ok(options.signal);
    return ok(JSON.stringify(topic));
  });assert.deepEqual(JSON.parse(text),topic);
});
test("Malformed responses, timeout and request failures are rejected without raw messages",async()=>{
  const args={apiKey:"secret-test-value",model:DEFAULT_GEMINI_MODEL,schema:topicSchema,input:{},instructions:"test"};
  const cases=[async()=>{throw new Error("secret-test-value");},async()=>{const e=new Error("secret-test-value");e.name="TimeoutError";throw e;},async()=>({ok:true,status:200,text:async()=>"not JSON"}),async()=>({ok:true,status:200,text:async()=>JSON.stringify({candidates:[]})})];
  for(const fetch of cases)await assert.rejects(requestGemini(args,fetch),e=>!e.message.includes("secret-test-value")&&!!e.code);
});
test("400/401/403/429 expose allowlisted Gemini diagnostics without secrets",async()=>{
  const apiKey="AIzaTestSecretValue123456789012345";
  const cases=[
    [400,"INVALID_ARGUMENT","Invalid request"],
    [401,"UNAUTHENTICATED",`Invalid API key: ${apiKey}`],
    [403,"PERMISSION_DENIED","x-goog-api-key is not permitted"],
    [429,"RESOURCE_EXHAUSTED","Quota exceeded"]
  ];
  for(const [status,apiStatus,message] of cases) {
    let caught;
    try {
      await requestGemini({apiKey,model:DEFAULT_GEMINI_MODEL,schema:topicSchema,input:{},instructions:"test"},async()=>({
        ok:false,status,text:async()=>JSON.stringify({error:{code:status,status:apiStatus,message},request:{"x-goog-api-key":apiKey}})
      }));
    } catch(error) { caught=error; }
    assert.equal(caught.code,"GEMINI_HTTP_ERROR");
    assert.deepEqual(Object.keys(caught.diagnostic),["httpStatus","apiErrorStatus","apiErrorCode","message"]);
    const report=JSON.stringify(failureReport(caught));
    assert.equal(JSON.parse(report).httpStatus,status);
    assert.equal(JSON.parse(report).apiErrorStatus,apiStatus);
    assert.equal(JSON.parse(report).apiErrorCode,status);
    assert.ok(JSON.parse(report).message);
    assert.ok(!report.includes(apiKey));
    assert.ok(!report.includes('"request"'));
  }
});
test("Abnormal finishReason and prompt blockReason are reported safely",async()=>{
  const args={apiKey:"secret-value",model:DEFAULT_GEMINI_MODEL,schema:topicSchema,input:{},instructions:"test"};
  await assert.rejects(requestGemini(args,async()=>({ok:true,status:200,text:async()=>JSON.stringify({candidates:[{finishReason:"MAX_TOKENS",content:{parts:[]}}]})})),error=>{
    const report=failureReport(error);return report.error==="GEMINI_FINISH_REASON"&&report.finishReason==="MAX_TOKENS"&&!JSON.stringify(report).includes("secret-value");
  });
  await assert.rejects(requestGemini(args,async()=>({ok:true,status:200,text:async()=>JSON.stringify({promptFeedback:{blockReason:"SAFETY"}})})),error=>{
    const report=failureReport(error);return report.error==="GEMINI_BLOCKED"&&report.blockReason==="SAFETY"&&!JSON.stringify(report).includes("secret-value");
  });
});
test("7/8: real articles + mocked API do not write tracked or untracked files",async()=>{
  const files=cp.execFileSync("git",["ls-files","-z"],{cwd:ROOT,encoding:"utf8"}).split("\0").filter(Boolean);
  const hashes=()=>files.map(f=>crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,f))).digest("hex"));
  const status=()=>cp.execFileSync("git",["status","--porcelain","--untracked-files=all"],{cwd:ROOT,encoding:"utf8"});
  const before=hashes(),beforeStatus=status();let count=0;
  await prepareDailyBlog({env,request:async args=>++count===1?JSON.stringify(topic):count===2?review(args.input.existingArticles):JSON.stringify(generatedArticle)});
  assert.deepEqual(hashes(),before);assert.equal(status(),beforeStatus);
});
