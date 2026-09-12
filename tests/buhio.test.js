"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { BUHIO_IMAGES, DIRECTORY, selectBuhio } = require("../scripts/lib/buhio");
const { generateArticle } = require("../scripts/article-generator");
const { buildArticleMarkdown } = require("../scripts/article-writer");
const { parseFrontmatter } = require("../scripts/lib/articles");
const { renderArticlePage } = require("../scripts/generate-blog");
const { isPublicFile } = require("../scripts/prepare-pages");

test("All six fixed PNG assets exist and are eligible for Pages", () => {
  for (const {file} of BUHIO_IMAGES) {
    const image = fs.readFileSync(path.join(__dirname, "..", DIRECTORY, file));
    assert.equal(image.subarray(0,8).toString("hex"), "89504e470d0a1a0a");
    assert.ok(isPublicFile(DIRECTORY + file));
  }
});
test("Content fallback covers six uses; invalid paths and unsafe text are replaced", () => {
  ["通常の説明", "やさしい案内", "ポイント解説", "成功事例", "意外な情報", "制度変更"].forEach((title, index) => {
    assert.equal(selectBuhio({title}).image, BUHIO_IMAGES[index].file);
  });
  const result = selectBuhio({title:"制度変更"}, {image:"../../bad.png",alt:"<script>bad</script>",comment:17});
  assert.equal(result.image, BUHIO_IMAGES[5].file);
  assert.ok(result.alt.includes("制度変更"));
  assert.ok(!result.alt.includes("<"));
});
test("Gemini selection survives validation, Markdown storage and HTML rendering", async () => {
  const topic = {title:"現場の改善事例",category:"IT活用",target:"職員",keyword:"改善",reason:"実務",angle:"現場",service:"IT支援"};
  const bodyMarkdown = ["## 導入", "職員が日々の仕事を振り返り、できることから一緒に整理します。".repeat(20), "## 現場でできること", "まずは記録の仕方を確認してみましょう。".repeat(30), "## まとめ", "小さな改善から始めましょう。".repeat(20)].join("\n\n");
  const buhio = {image:BUHIO_IMAGES[3].file,alt:"現場の改善を喜んで跳び上がるぶひお",comment:"記録の仕方を、みんなで確認してみよう。"};
  const article = await generateArticle({apiKey:"dummy", topic, request:async args => {
    assert.deepEqual(args.input.buhioImages, BUHIO_IMAGES);
    assert.ok(args.schema.required.includes("buhio"));
    assert.match(args.instructions, /結局どういうこと/);
    return JSON.stringify({title:topic.title,description:"職員ができる改善を紹介します。",bodyMarkdown,buhio});
  }});
  const built = buildArticleMarkdown({article,topic,date:"2026-09-12",slug:"buhio-test"});
  const parsed = parseFrontmatter(built.markdown);
  assert.deepEqual(parsed.data.buhio,buhio);
  const row = {slug:"buhio-test",data:{...parsed.data,published:true},body:parsed.body};
  const html = renderArticlePage(row,{"buhio-test":row},[row]);
  assert.equal((html.match(/class="buhio-note"/g)||[]).length,1);
  assert.ok(html.includes(`../${DIRECTORY}${buhio.image}`));
  assert.ok(html.includes(`alt="${buhio.alt}"`));
  assert.ok(html.indexOf('class="buhio-note"') < html.indexOf("<h2>導入</h2>"));
  assert.ok(html.includes(buhio.comment));
  const legacy = renderArticlePage({...row,data:{...row.data,buhio:undefined}}, {}, [row]);
  assert.ok(legacy.includes('class="buhio-note"'));
});
