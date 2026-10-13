"use strict";

// ブログ自動投稿の安定化：
//   ① 記事内画像の候補が足りなくても、記事内画像を省略して投稿を続けられる
//   ② 自動投稿が失敗したら、ワークフローが失敗として検知でき、管理者へ通知（GitHub Issue）される
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const YAML = require("yaml");
const images = require("../scripts/lib/image-library");
const lib = require("../scripts/lib/articles");
const { markdownBodyToHtml } = require("../scripts/lib/markdown");
const { saveArticleDraft, inlineImage, warnInlineImageOmitted } = require("../scripts/article-writer");
const notify = require("../scripts/notify-workflow-failure");

const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 画像：一時フォルダに小さな画像ライブラリを作って検証する
// ---------------------------------------------------------------------------
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "blog-resilience-"));
  const articles = path.join(root, "content", "articles");
  fs.mkdirSync(articles, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, articles };
}
// 内容が違う（ハッシュが違う）記事内画像を置く
function inlineFile(root, name) {
  const file = path.join(root, "assets", "images", "blog-library", "inline", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "image-bytes-of-" + name);
  return "assets/images/blog-library/inline/" + name;
}
// 過去の公開記事（記事内画像の使用履歴になる）
function usedBy(articles, slug, date, inlinePath) {
  fs.writeFileSync(path.join(articles, slug + ".md"), "---\n" + YAML.stringify({
    type: "column", title: slug, date, slug, image: "assets/images/hero.png", image_category: "welfare",
    image_role: "hero", inline_image: inlinePath, published: true
  }).trimEnd() + "\n---\n\n本文\n");
}

const topic = { title: "採用ページの改善", category: "採用", target: "福祉事業所", keyword: "採用", reason: "確認", angle: "改善", service: "支援" };
const body = "## 最初の確認\n\n" + "本文".repeat(250) + "\n\n## 次の確認\n\n" + "本文".repeat(250) + "\n\n## まとめ\n\n" + "本文".repeat(250);
const articleInput = { title: topic.title, description: "説明".repeat(20), bodyMarkdown: body };

function save(value, date = "2026-10-20") {
  const saved = saveArticleDraft({ article: articleInput, topic, date, directory: value.articles, imageRoot: value.root });
  return { saved, parsed: lib.parseFrontmatter(fs.readFileSync(saved.filePath, "utf8")) };
}
function captureWarnings(fn) {
  const logs = [];
  const original = { log: console.log, warn: console.warn };
  console.log = (...args) => logs.push(args.join(" "));
  console.warn = (...args) => logs.push(args.join(" "));
  try { return { value: fn(), logs }; } finally { console.log = original.log; console.warn = original.warn; }
}

test("通常：直近10本で未使用の画像があれば、それを記事内画像に使う（警告なし）", t => {
  const value = fixture(t);
  inlineFile(value.root, "inline-recruit-001.png"); inlineFile(value.root, "inline-recruit-002.png");
  const { value: result, logs } = captureWarnings(() => save(value));
  assert.match(result.parsed.data.inline_image, /inline-recruit-00[12]\.png$/);
  assert.equal((result.parsed.body.match(/!\[[^\]]*\]\(assets\/images\/blog-library\/inline\//g) || []).length, 1);
  assert.ok(!logs.some(line => /記事内画像/.test(line)), "no omission warning");
});

test("優先カテゴリ（採用）の画像を使い切っても、ほかのカテゴリの未使用画像があればそれを使う", t => {
  const value = fixture(t);
  const a = inlineFile(value.root, "inline-recruit-001.png");
  const b = inlineFile(value.root, "inline-recruit-002.png");
  const other = inlineFile(value.root, "inline-welfare-001.png");
  usedBy(value.articles, "post-1", "2026-10-01", a);
  usedBy(value.articles, "post-2", "2026-10-02", b);
  const { value: result, logs } = captureWarnings(() => save(value));
  assert.equal(result.parsed.data.inline_image, other, "falls back to the unused image of another category");
  assert.ok(!logs.some(line => /記事内画像/.test(line)));
});

test("全カテゴリの候補を使い切ったら、記事内画像を省略して投稿を続け、警告を残す", t => {
  const value = fixture(t);
  const a = inlineFile(value.root, "inline-recruit-001.png");
  const b = inlineFile(value.root, "inline-welfare-001.png");
  usedBy(value.articles, "post-1", "2026-10-01", a);
  usedBy(value.articles, "post-2", "2026-10-02", b);
  const { value: result, logs } = captureWarnings(() => save(value));
  assert.equal(result.parsed.data.inline_image, undefined);
  assert.equal(result.saved.metadata.inline_image, undefined);
  assert.ok(logs.some(line => /記事内画像なしで公開します/.test(line)), "an omission warning is logged");
});

test("記事内画像を省略しても、Markdown・HTMLの構造は崩れず、空白や説明文も残らない", t => {
  const value = fixture(t);
  usedBy(value.articles, "post-1", "2026-10-01", inlineFile(value.root, "inline-recruit-001.png"));
  const { value: result } = captureWarnings(() => save(value));
  const raw = fs.readFileSync(result.saved.filePath, "utf8");
  const text = result.parsed.body;
  assert.equal(text.trim(), body.trim(), "the body is exactly the authored body");
  assert.ok(!/!\[[^\]]*\]\(/.test(text), "no image markdown remains");
  assert.ok(!/\n{3,}/.test(text), "no extra blank lines");
  for (const key of ["inline_image", "inline_image_alt", "inline_image_category", "inline_image_series", "inline_image_hash", "inline_image_selection"]) {
    assert.ok(!(key in result.parsed.data), key + " is not written");
  }
  assert.match(raw, /^---\n[\s\S]*\n---\n\n## 最初の確認/);
  const html = markdownBodyToHtml(text);
  assert.ok(!/<img/.test(html), "no empty image element");
  assert.equal((html.match(/<h2/g) || []).length, 3, "all three sections render");
});

test("画像を省略した記事も、ほかの記事と同じように読み込め、通常の記事として生成できる", t => {
  const value = fixture(t);
  usedBy(value.articles, "post-1", "2026-10-01", inlineFile(value.root, "inline-recruit-001.png"));
  const { value: result } = captureWarnings(() => save(value));
  const loaded = lib.loadArticles(value.articles).find(item => item.slug === result.saved.slug);
  assert.ok(loaded, "the draft is loadable");
  assert.equal(loaded.data.title, topic.title);
  // 公開用の前提（記事内画像は最大1枚）も満たす
  assert.ok((loaded.body.match(/!\[[^\]]*\]\(assets\/images\/blog-library\/inline\//g) || []).length <= 1);
  // 記事内画像の履歴には載らない（重複判定の邪魔をしない）
  assert.ok(!images.usageHistory({ root: value.root, articlesDir: value.articles, kind: "inline" }).some(use => use.article === result.saved.slug));
});

test("直接呼んでも、候補が尽きたとき omitWhenExhausted なら null、従来の呼び出しは再利用する（ヒーロー等の既存仕様は変えない）", t => {
  const value = fixture(t);
  usedBy(value.articles, "post-1", "2026-10-01", inlineFile(value.root, "inline-recruit-001.png"));
  const options = { root: value.root, articlesDir: value.articles, content: { title: "採用面談の準備", body: "応募者と職員の面談" } };
  assert.equal(inlineImage("採用", { ...options, omitWhenExhausted: true }), null);
  const legacy = inlineImage("採用", options);
  assert.ok(legacy && /inline-recruit-001\.png$/.test(legacy.image), "legacy callers still get a reused image instead of nothing");
});

test("省略の警告は、GitHub Actions では警告アノテーション形式で出る", () => {
  const before = process.env.GITHUB_ACTIONS;
  process.env.GITHUB_ACTIONS = "true";
  try {
    const { logs } = captureWarnings(() => warnInlineImageOmitted("採用"));
    assert.ok(logs.some(line => line.startsWith("::warning title=") && /採用/.test(line)));
  } finally {
    if (before === undefined) delete process.env.GITHUB_ACTIONS; else process.env.GITHUB_ACTIONS = before;
  }
});

// ---------------------------------------------------------------------------
// 失敗の検知：エラーが握りつぶされず、ワークフローが失敗として扱われる
// ---------------------------------------------------------------------------
const workflow = YAML.parse(fs.readFileSync(path.join(ROOT, ".github", "workflows", "daily-blog.yml"), "utf8"));

test("Daily Blog：公開に関わるジョブ・ステップに、エラーを握りつぶす設定がない", () => {
  for (const name of ["start", "deploy"]) {
    const job = workflow.jobs[name];
    assert.notEqual(job["continue-on-error"], true, name + " must not continue on error");
    for (const step of job.steps) {
      assert.notEqual(step["continue-on-error"], true, `${name}: "${step.name || step.uses}" must not continue on error`);
      if (typeof step.run === "string") {
        assert.ok(!/\|\|\s*true|\|\|\s*:|set \+e|exit 0/.test(step.run), `${name}: "${step.name}" swallows errors`);
      }
    }
  }
});

test("Daily Blog：失敗通知ジョブは、公開ジョブが失敗したときだけ動き、通知の失敗が公開に影響しない", () => {
  const job = workflow.jobs["notify-failure"];
  assert.ok(job, "notify-failure job exists");
  assert.deepEqual([...job.needs].sort(), ["deploy", "start"]);
  assert.match(String(job.if), /failure\(\)/);
  assert.equal(job["continue-on-error"], true, "a notification problem must not turn into a second failure");
  assert.equal(job.permissions.issues, "write");
  const commands = job.steps.map(step => String(step.run || "")).join("\n");
  assert.match(commands, /scripts\/notify-workflow-failure\.js failure/);
  // 公開ジョブは通知ジョブに依存しない（通知が詰まっても公開は進む）
  for (const name of ["start", "deploy", "continue-trial"]) {
    assert.ok(![].concat(workflow.jobs[name].needs || []).includes("notify-failure"));
  }
});

test("Daily Blog：復旧ジョブは、成功したときだけ失敗Issueを閉じる", () => {
  const job = workflow.jobs["recover-failure-issue"];
  assert.ok(job);
  assert.match(String(job.if), /needs\.start\.result == 'success'/);
  assert.match(String(job.if), /needs\.deploy\.result != 'failure'/);
  assert.equal(job["continue-on-error"], true);
  assert.match(job.steps.map(step => String(step.run || "")).join("\n"), /notify-workflow-failure\.js recover/);
});

test("Daily Blog：通知テスト用の疑似失敗は、記事を作る前（最初の段階）で必ず失敗する", () => {
  const input = workflow.on.workflow_dispatch.inputs.simulate_failure;
  assert.equal(input.type, "boolean");
  assert.equal(input.default, false, "off by default");
  const steps = workflow.jobs.start.steps;
  const simulate = steps.findIndex(step => /inputs\.simulate_failure == true/.test(String(step.if || "")));
  const topic = steps.findIndex(step => step.id === "select-topic");
  const publish = steps.findIndex(step => /publish-draft/.test(String(step.run || "")));
  assert.ok(simulate >= 0 && simulate < topic && topic < publish, "the simulated failure runs before topic selection and publication");
  assert.match(steps[simulate].run, /exit 1/);
});

test("自動投稿スクリプトは、エラー時に終了コード1で終わる（ワークフローが失敗として検知できる）", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "blog-fail-"));
  try {
    const noKey = { ...process.env, DAILY_BLOG_SOURCES_FILTER: "cache", DAILY_BLOG_EVENT_NAME: "workflow_dispatch" };
    delete noKey.GEMINI_API_KEY; delete noKey.DAILY_BLOG_RESULT_FILE;
    const daily = spawnSync(process.execPath, [path.join(ROOT, "scripts", "daily-blog.js")], { env: noKey, encoding: "utf8", cwd: empty });
    assert.equal(daily.status, 1, "daily-blog.js exits 1 when topic selection fails");
    assert.match(daily.stderr, /"status":"failed"/);
    const missing = { ...process.env, DAILY_BLOG_RESULT_FILE: path.join(empty, "nope.json"), DAILY_DRAFT_COMMIT_RESULT_FILE: path.join(empty, "nope2.json") };
    for (const script of ["commit-draft.js", "publish-draft.js"]) {
      const run = spawnSync(process.execPath, [path.join(ROOT, "scripts", script)], { env: missing, encoding: "utf8", cwd: empty });
      assert.equal(run.status, 1, script + " exits 1 when its input is missing");
    }
  } finally { fs.rmSync(empty, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// 失敗通知スクリプト（GitHub Issue）
// ---------------------------------------------------------------------------
function fakeGh({ open = null, jobs = [], failCreateWithAssignee = false, failAll = false, logText = "" } = {}) {
  const calls = [];
  const gh = (args, input) => {
    calls.push({ args, input });
    if (failAll) throw new Error("gh: unreachable");
    const [a, b] = args;
    if (a === "api") return String(b).endsWith("/logs") ? logText : JSON.stringify({ jobs });
    if (a === "label") return "";
    if (a === "issue" && b === "list") return JSON.stringify(open ? [open] : []);
    if (a === "issue" && b === "create") {
      if (failCreateWithAssignee && args.includes("--assignee")) throw new Error("assignee not allowed");
      return "https://github.com/uk-support1/fukushi-it-partner-site/issues/42\n";
    }
    return "";
  };
  return { gh, calls };
}
const ENV = { GITHUB_REPOSITORY: "uk-support1/fukushi-it-partner-site", GITHUB_RUN_ID: "123456", GITHUB_WORKFLOW: "Daily Blog",
  GITHUB_EVENT_NAME: "schedule", GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY_OWNER: "uk-support1" };
const FAILED_JOBS = [{ name: "start", conclusion: "failure", html_url: "https://github.com/x/y/actions/runs/123456/job/9",
  steps: [{ name: "Run tests", conclusion: "success" }, { name: "Select today's topic", conclusion: "failure" }] },
{ name: "notify-failure", conclusion: null, steps: [] }];

test("失敗通知：日時・ワークフロー名・原因確認URL・失敗したステップを含むIssueを作る", () => {
  const { gh, calls } = fakeGh({ jobs: FAILED_JOBS });
  const result = notify.notifyFailure({ env: ENV, gh, now: new Date("2026-10-14T21:30:00Z") });
  assert.equal(result.action, "created");
  const create = calls.find(call => call.args[0] === "issue" && call.args[1] === "create");
  assert.ok(create.args.includes("--assignee") && create.args.includes("uk-support1"), "assigned to the owner so a notification is always sent");
  assert.ok(create.args.includes(notify.LABEL));
  assert.match(create.args[create.args.indexOf("--title") + 1], /^【自動投稿エラー】Daily Blog が失敗しました（2026-10-15）$/);
  for (const expected of ["2026-10-15 06:30", "Daily Blog", "定時実行", "Select today's topic",
    "https://github.com/uk-support1/fukushi-it-partner-site/actions/runs/123456"]) {
    assert.ok(create.input.includes(expected), "the report mentions " + expected);
  }
  assert.ok(!create.input.includes("notify-failure"), "only really failed jobs are listed");
});

test("失敗通知：同じ状態が続くときは新しいIssueを作らず、開いているIssueにコメントする", () => {
  const { gh, calls } = fakeGh({ open: { number: 7, url: "https://github.com/x/y/issues/7" }, jobs: FAILED_JOBS });
  const result = notify.notifyFailure({ env: ENV, gh });
  assert.equal(result.action, "commented");
  assert.ok(calls.some(call => call.args[1] === "comment" && call.args[2] === "7" && call.input.includes("Daily Blog")));
  assert.ok(!calls.some(call => call.args[0] === "issue" && call.args[1] === "create"));
});

test("失敗通知：担当者を設定できなくても、Issueは作る／疑似失敗には【テスト】が付く", () => {
  const { gh, calls } = fakeGh({ failCreateWithAssignee: true });
  const result = notify.notifyFailure({ env: { ...ENV, NOTIFY_SIMULATED: "true" }, gh });
  assert.equal(result.action, "created");
  const creates = calls.filter(call => call.args[0] === "issue" && call.args[1] === "create");
  assert.equal(creates.length, 2, "retried without assignee");
  assert.ok(!creates[1].args.includes("--assignee"));
  assert.match(creates[1].args[creates[1].args.indexOf("--title") + 1], /^【テスト】/);
  assert.match(creates[1].input, /疑似失敗/);
});

test("失敗通知：通知自体が失敗しても例外にならず、警告だけ残して終了する（公開処理に影響しない）", () => {
  const { gh } = fakeGh({ failAll: true });
  const { value, logs } = captureWarnings(() => notify.main("failure", { env: ENV, gh }));
  assert.equal(value.action, "error");
  assert.ok(logs.some(line => line.startsWith("::warning title=失敗通知を送れませんでした")));
  const script = spawnSync(process.execPath, [path.join(ROOT, "scripts", "notify-workflow-failure.js"), "failure"],
    { env: { PATH: "", SystemRoot: process.env.SystemRoot || "" }, encoding: "utf8" });
  assert.equal(script.status, 0, "the script itself never fails the job");
});

test("復旧：成功したら、開いている失敗Issueを閉じる。なければ何もしない", () => {
  const withIssue = fakeGh({ open: { number: 7, url: "https://github.com/x/y/issues/7" } });
  assert.equal(notify.recover({ env: ENV, gh: withIssue.gh }).action, "closed");
  assert.ok(withIssue.calls.some(call => call.args[1] === "close" && call.args[2] === "7"));
  const none = fakeGh();
  assert.equal(notify.recover({ env: ENV, gh: none.gh }).action, "none");
  assert.ok(!none.calls.some(call => call.args[1] === "close" || call.args[1] === "comment"));
});

// ---------------------------------------------------------------------------
// Generate Blog（サイトの生成・公開）の失敗通知
// ---------------------------------------------------------------------------
const generate = YAML.parse(fs.readFileSync(path.join(ROOT, ".github", "workflows", "generate-blog.yml"), "utf8"));
const GENERATE_ENV = { ...ENV, GITHUB_WORKFLOW: "Generate Blog", GITHUB_EVENT_NAME: "push", GITHUB_RUN_ID: "777" };
const TEST_LOG = [
  "2026-10-13T04:26:05.9999999Z ℹ pass 161",
  "2026-10-13T04:26:05.9999999Z ℹ fail 1",
  "2026-10-13T04:26:06.0068617Z ✖ failing tests:",
  "2026-10-13T04:26:06.0068841Z ",
  "2026-10-13T04:26:06.0070619Z test at tests/image-library.test.js:294:1",
  "2026-10-13T04:26:06.0070620Z ✖ published heroes are hash-unique within the recent window, and the latest ten inline images are hash-unique (282.273377ms)",
  "2026-10-13T04:26:06.0072219Z   AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 9 !== 10"
].join("\n");
const TEST_FAILED_JOBS = [{ id: 55, name: "build-blog", conclusion: "failure", html_url: "https://github.com/x/y/actions/runs/777/job/55",
  steps: [{ name: "Run npm test", conclusion: "failure" }, { name: "Run node scripts/generate-blog.js", conclusion: "skipped" }] }];

test("Generate Blog：テスト（npm test）の失敗はジョブの失敗になり、握りつぶす設定がない", () => {
  for (const name of ["build-blog", "deploy"]) {
    const job = generate.jobs[name];
    assert.notEqual(job["continue-on-error"], true);
    for (const step of job.steps) {
      assert.notEqual(step["continue-on-error"], true, `${name}: "${step.name || step.uses || step.run}" must not continue on error`);
      if (typeof step.run === "string") assert.ok(!/\|\|\s*true|\|\|\s*:|set \+e|exit 0/.test(step.run), `${name}: "${step.run}" swallows errors`);
    }
  }
  const steps = generate.jobs["build-blog"].steps;
  const npmTest = steps.findIndex(step => step.run === "npm test");
  const generateStep = steps.findIndex(step => /scripts\/generate-blog\.js/.test(String(step.run || "")));
  assert.ok(npmTest >= 0 && npmTest < generateStep, "image-duplication etc. are caught by npm test before anything is generated or published");
});

test("Generate Blog：失敗通知ジョブは、build-blog か deploy が失敗したときだけ動き、公開には影響しない", () => {
  const job = generate.jobs["notify-failure"];
  assert.ok(job);
  assert.deepEqual([...job.needs].sort(), ["build-blog", "deploy"]);
  assert.match(String(job.if), /failure\(\)/);
  assert.equal(job["continue-on-error"], true);
  assert.equal(job.permissions.issues, "write");
  assert.match(job.steps.map(step => String(step.run || "")).join("\n"), /notify-workflow-failure\.js failure/);
  for (const name of ["build-blog", "deploy"]) {
    assert.ok(![].concat(generate.jobs[name].needs || []).some(dep => /notify|recover/.test(dep)), "publishing never waits for the notification");
  }
});

test("Generate Blog：復旧ジョブは、生成・公開まで成功したときだけ失敗Issueを閉じる", () => {
  const job = generate.jobs["recover-failure-issue"];
  assert.ok(job);
  assert.match(String(job.if), /needs\.build-blog\.result == 'success'/);
  assert.match(String(job.if), /needs\.deploy\.result == 'success'/);
  assert.equal(job["continue-on-error"], true);
  assert.match(job.steps.map(step => String(step.run || "")).join("\n"), /notify-workflow-failure\.js recover/);
});

test("Generate Blog：通知テスト用の疑似失敗は、生成・コミット・公開より前に必ず失敗し、サイトを変更しない", () => {
  const input = generate.on.workflow_dispatch.inputs.simulate_failure;
  assert.equal(input.type, "boolean");
  assert.equal(input.default, false);
  const steps = generate.jobs["build-blog"].steps;
  const simulate = steps.findIndex(step => /inputs\.simulate_failure == true/.test(String(step.if || "")));
  const firstRealStep = steps.findIndex(step => /npm ci|npm test|generate-blog|git push|prepare-pages/.test(String(step.run || "")));
  assert.ok(simulate >= 0 && simulate < firstRealStep);
  assert.match(steps[simulate].run, /exit 1/);
  assert.equal(generate.on.push.branches[0], "main", "normal pushes still deploy as before");
});

test("Daily Blog と Generate Blog は、ラベル・題名・本文で区別でき、互いのIssueに触れない", () => {
  const daily = notify.runInfo(ENV);
  const gen = notify.runInfo(GENERATE_ENV);
  assert.equal(daily.settings.label, "daily-blog-failure");
  assert.equal(gen.settings.label, "generate-blog-failure");
  const a = fakeGh({ jobs: FAILED_JOBS }); notify.notifyFailure({ env: ENV, gh: a.gh });
  const b = fakeGh({ jobs: TEST_FAILED_JOBS, logText: TEST_LOG }); notify.notifyFailure({ env: GENERATE_ENV, gh: b.gh });
  const titleOf = calls => { const c = calls.find(call => call.args[0] === "issue" && call.args[1] === "create"); return c.args[c.args.indexOf("--title") + 1]; };
  assert.match(titleOf(a.calls), /^【自動投稿エラー】Daily Blog が失敗しました/);
  assert.match(titleOf(b.calls), /^【公開エラー】Generate Blog が失敗しました/);
  const listLabel = calls => { const c = calls.find(call => call.args[0] === "issue" && call.args[1] === "list"); return c.args[c.args.indexOf("--label") + 1]; };
  assert.equal(listLabel(a.calls), "daily-blog-failure");
  assert.equal(listLabel(b.calls), "generate-blog-failure");
  // 復旧も自分のラベルだけを見る
  const r = fakeGh({ open: { number: 3, url: "u" } }); notify.recover({ env: GENERATE_ENV, gh: r.gh });
  assert.equal(listLabel(r.calls), "generate-blog-failure");
});

test("Generate Blog の失敗通知：テスト失敗（画像の重複など）のテスト名・日時・失敗箇所・ログURLを載せる", () => {
  const { gh, calls } = fakeGh({ jobs: TEST_FAILED_JOBS, logText: TEST_LOG });
  const result = notify.notifyFailure({ env: GENERATE_ENV, gh, now: new Date("2026-10-13T04:26:00Z") });
  assert.equal(result.action, "created");
  assert.equal(result.label, "generate-blog-failure");
  const create = calls.find(call => call.args[0] === "issue" && call.args[1] === "create");
  for (const expected of ["2026-10-13 13:26", "Generate Blog（公開エラー）", "mainへのpush", "Run npm test",
    "published heroes are hash-unique within the recent window", "https://github.com/uk-support1/fukushi-it-partner-site/actions/runs/777",
    "サイトの更新やブログの公開は止まったまま", "次に Generate Blog が成功すると"]) {
    assert.ok(create.input.includes(expected), "the report mentions: " + expected);
  }
  assert.ok(create.args.includes("generate-blog-failure"));
});

test("Generate Blog：同じ障害が続くときは既存Issueにコメントを追加し、復旧したら閉じる", () => {
  const open = { number: 9, url: "https://github.com/x/y/issues/9" };
  const again = fakeGh({ open, jobs: TEST_FAILED_JOBS, logText: TEST_LOG });
  assert.equal(notify.notifyFailure({ env: GENERATE_ENV, gh: again.gh }).action, "commented");
  assert.ok(again.calls.some(call => call.args[1] === "comment" && call.args[2] === "9"));
  assert.ok(!again.calls.some(call => call.args[0] === "issue" && call.args[1] === "create"));
  const fixed = fakeGh({ open });
  assert.equal(notify.recover({ env: GENERATE_ENV, gh: fixed.gh }).action, "closed");
  assert.ok(fixed.calls.some(call => call.args[1] === "close" && call.args[2] === "9"));
});

test("失敗したテスト名の取り出し：色付けの制御文字が混ざった本物のログ形式でも読める", () => {
  const colored = "2026-10-13T04:26:06.0068617Z \u001b[31m✖ failing tests:\u001b[39m\n2026-10-13T04:26:06.0070620Z \u001b[31m✖ sample failing case (12.5ms)\u001b[39m";
  assert.deepEqual(notify.failingTestNames(colored), ["sample failing case"]);
});

test("ログ取得で制御文字の出力を許可するオプションを付け、古いghで使えなくても通知は続く", () => {
  const calls = [];
  const gh = args => {
    calls.push(args);
    if (args[1] && String(args[1]).endsWith("/logs")) { if (args.includes("--allow-escape-sequences")) throw new Error("unknown flag"); return TEST_LOG; }
    return JSON.stringify({ jobs: TEST_FAILED_JOBS });
  };
  const failed = notify.failedSteps(notify.runInfo(GENERATE_ENV), gh);
  assert.ok(calls.some(args => args.includes("--allow-escape-sequences")), "the option is tried first");
  assert.equal(failed[0].tests.length, 1, "falls back and still finds the failing test");
});

test("失敗したテスト名の取り出し：タイムスタンプ付きログから最大5件、重複なし", () => {
  assert.deepEqual(notify.failingTestNames(TEST_LOG), ["published heroes are hash-unique within the recent window, and the latest ten inline images are hash-unique"]);
  assert.deepEqual(notify.failingTestNames("all good"), []);
  const many = ["✖ failing tests:", ...Array.from({ length: 8 }, (_, i) => `✖ case ${i % 7} (1.5ms)`)].join("\n");
  assert.equal(notify.failingTestNames(many).length, 5);
  assert.equal(new Set(notify.failingTestNames(many)).size, 5);
});

test("Generate Blog の通知が失敗しても、例外にならず終了コード0（サイトの公開に影響しない）", () => {
  const { gh } = fakeGh({ failAll: true });
  const { value } = captureWarnings(() => notify.main("failure", { env: GENERATE_ENV, gh }));
  assert.equal(value.action, "error");
});

test("ほかのワークフローでも、名前から専用ラベルを決めて通知できる", () => {
  assert.equal(notify.workflowSettings("Generate Course").label, "generate-course-failure");
});
