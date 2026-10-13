"use strict";

// GitHub Actions の失敗通知（GitHub Issue 方式・無料）。Daily Blog と Generate Blog で共通に使います。
//   node scripts/notify-workflow-failure.js failure   … 失敗したとき：Issueを作る（既にあれば追記）
//   node scripts/notify-workflow-failure.js recover   … 成功したとき：開いている失敗Issueを閉じる
//
// ワークフローごとにラベル（daily-blog-failure / generate-blog-failure）とIssueの題名を分けるので、
// どちらの失敗かがひと目でわかり、片方の復旧でもう片方のIssueが閉じられることもありません。
// Issueが作られると、リポジトリ所有者へGitHubのメール／モバイル通知が届きます。
// 通知に失敗しても、公開処理には影響させません（このスクリプトは常に終了コード0で終わり、
// 失敗したときはActionsのログに警告を残します）。

const { execFileSync } = require("child_process");

// ワークフローごとの設定。ここにないワークフローも、ラベルは「<名前>-failure」になる。
const WORKFLOWS = {
  "Daily Blog": {
    label: "daily-blog-failure",
    kind: "自動投稿エラー",
    what: "毎日のブログ自動投稿",
    next: [
      "原因を直したあと、GitHub の Actions → Daily Blog → Run workflow で手動実行できます。"
    ]
  },
  "Generate Blog": {
    label: "generate-blog-failure",
    kind: "公開エラー",
    what: "サイトの生成・公開（デプロイ）",
    next: [
      "失敗したステップが「npm test」の場合は、テスト（画像の重複など）が原因です。下の「失敗したテスト」を確認してください。",
      "原因を直して main に push するか、Actions → Generate Blog → Run workflow（または Re-run failed jobs）で再実行できます。",
      "それまでの間、サイトの更新やブログの公開は止まったままになります。"
    ]
  }
};
const LABEL = WORKFLOWS["Daily Blog"].label; // 既存の呼び出し・テスト互換のため残す

function workflowSettings(workflow) {
  const name = String(workflow || "Daily Blog");
  if (WORKFLOWS[name]) return WORKFLOWS[name];
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workflow";
  return { label: slug + "-failure", kind: "ワークフローエラー", what: name, next: [
    "原因を直したあと、Actions から再実行してください。"
  ] };
}

function defaultGh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

function jst(date) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(date).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function runInfo(env) {
  const repo = env.GITHUB_REPOSITORY || "";
  const server = env.GITHUB_SERVER_URL || "https://github.com";
  const runId = env.GITHUB_RUN_ID || "";
  const workflow = env.GITHUB_WORKFLOW || "Daily Blog";
  return {
    repo,
    runId,
    workflow,
    settings: workflowSettings(workflow),
    event: env.GITHUB_EVENT_NAME || "",
    owner: env.GITHUB_REPOSITORY_OWNER || "",
    runUrl: repo && runId ? `${server}/${repo}/actions/runs/${runId}` : "",
    simulated: env.NOTIFY_SIMULATED === "true"
  };
}

// ログから「失敗したテスト」の名前を取り出す（node --test の "✖ failing tests:" 以降の "✖ <名前> (…ms)" 行）
function failingTestNames(logText) {
  const lines = String(logText || "").split(/\r?\n/).map(line => line.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s?/, ""));
  const start = lines.findIndex(line => /✖\s*failing tests:/.test(line));
  if (start < 0) return [];
  const names = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^✖\s+(.+?)\s+\([\d.]+ms\)\s*$/);
    if (match && !names.includes(match[1])) names.push(match[1].slice(0, 200));
  }
  return names.slice(0, 5);
}

// 失敗したジョブ／ステップ（とテスト名）を取得する。取れなくても通知自体は出す。
function failedSteps(info, gh) {
  if (!info.repo || !info.runId) return [];
  let jobs;
  try {
    const raw = gh(["api", `repos/${info.repo}/actions/runs/${info.runId}/jobs`, "--paginate"]);
    const data = JSON.parse(raw);
    jobs = Array.isArray(data) ? data : (data.jobs || []);
  } catch {
    return [];
  }
  return jobs.filter(job => job.conclusion === "failure").map(job => {
    const steps = (job.steps || []).filter(step => step.conclusion === "failure").map(step => step.name);
    let tests = [];
    if (steps.some(name => /test/i.test(name)) && job.id) {
      try { tests = failingTestNames(gh(["api", `repos/${info.repo}/actions/jobs/${job.id}/logs`])); } catch { /* ログが取れなくても続ける */ }
    }
    return { job: job.name, url: job.html_url, steps, tests };
  });
}

function eventLabel(event) {
  return { schedule: "定時実行（schedule）", workflow_dispatch: "手動実行（workflow_dispatch）", push: "mainへのpush" }[event] || event || "不明";
}

function buildFailureReport(info, failed, now) {
  const when = jst(now);
  const { settings } = info;
  const lines = [];
  if (info.simulated) lines.push("> ⚠️ これは通知の動作確認用の疑似失敗です（実際のエラーではありません）。", "");
  lines.push(
    `## ${info.workflow} が失敗しました（${settings.what}）`,
    "",
    `- 失敗した日時（日本時間）: ${when}`,
    `- ワークフロー名: ${info.workflow}（${settings.kind}）`,
    `- 実行のきっかけ: ${eventLabel(info.event)}`
  );
  if (failed.length) {
    lines.push("- 失敗した箇所:");
    for (const item of failed) {
      const steps = item.steps.length ? `（ステップ: ${item.steps.join("、")}）` : "";
      lines.push(`  - ジョブ「${item.job}」${steps}${item.url ? ` — ${item.url}` : ""}`);
    }
    const tests = failed.flatMap(item => item.tests);
    if (tests.length) {
      lines.push("- 失敗したテスト:");
      for (const name of tests) lines.push(`  - ${name}`);
    }
  } else {
    lines.push("- 失敗した箇所: 実行ログで確認してください");
  }
  lines.push(`- 原因を確認するURL: ${info.runUrl || "（URLを取得できませんでした）"}`, "", "### 次にやること",
    "1. 上の「原因を確認するURL」を開き、赤い × が付いたステップのログを確認します。");
  settings.next.forEach((text, index) => lines.push(`${index + 2}. ${text}`));
  lines.push(`${settings.next.length + 2}. 次に ${info.workflow} が成功すると、この Issue は自動的に閉じられます。`, "",
    "※ 同じ状態が続いている間は、新しいIssueは作らず、このIssueにコメントが追加されます。");
  const date = when.slice(0, 10);
  return {
    title: `${info.simulated ? "【テスト】" : ""}【${settings.kind}】${info.workflow} が失敗しました（${date}）`,
    body: lines.join("\n")
  };
}

function findOpenIssue(gh, label) {
  const raw = gh(["issue", "list", "--label", label, "--state", "open", "--json", "number,url", "--limit", "1"]);
  const list = JSON.parse(raw || "[]");
  return list.length ? list[0] : null;
}

function ensureLabel(gh, label, workflow) {
  try {
    gh(["label", "create", label, "--color", "B60205", "--description", `${workflow} の失敗通知`, "--force"]);
  } catch { /* ラベルが作れなくてもIssue作成は続ける */ }
}

function notifyFailure({ env = process.env, gh = defaultGh, now = new Date() } = {}) {
  const info = runInfo(env);
  const label = info.settings.label;
  const report = buildFailureReport(info, failedSteps(info, gh), now);
  ensureLabel(gh, label, info.workflow);
  const existing = findOpenIssue(gh, label);
  if (existing) {
    gh(["issue", "comment", String(existing.number), "--body-file", "-"], report.body);
    return { action: "commented", url: existing.url, label };
  }
  const base = ["issue", "create", "--title", report.title, "--body-file", "-", "--label", label];
  let url;
  try {
    // 担当者に設定すると、必ずGitHubからの通知が届く
    url = gh(info.owner ? [...base, "--assignee", info.owner] : base, report.body);
  } catch {
    url = gh(base, report.body);
  }
  return { action: "created", url: String(url || "").trim(), label };
}

function recover({ env = process.env, gh = defaultGh, now = new Date() } = {}) {
  const info = runInfo(env);
  const label = info.settings.label;
  const existing = findOpenIssue(gh, label);
  if (!existing) return { action: "none", label };
  const body = `✅ ${info.workflow} が復旧しました（${jst(now)} 日本時間）。\n\n成功した実行: ${info.runUrl || "（URL不明）"}\n\nこのIssueを自動で閉じます。`;
  gh(["issue", "comment", String(existing.number), "--body-file", "-"], body);
  gh(["issue", "close", String(existing.number)]);
  return { action: "closed", url: existing.url, label };
}

function main(mode, options) {
  try {
    const result = mode === "recover" ? recover(options) : notifyFailure(options);
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    // 通知の失敗でワークフローを壊さない。ログに警告だけ残す。
    const message = String(error && error.message ? error.message : error).split("\n")[0].slice(0, 300);
    console.log(`::warning title=失敗通知を送れませんでした::${message}`);
    return { action: "error" };
  }
}

if (require.main === module) {
  main(process.argv[2] === "recover" ? "recover" : "failure");
  process.exitCode = 0;
}

module.exports = { LABEL, WORKFLOWS, workflowSettings, jst, runInfo, failingTestNames, failedSteps, buildFailureReport, notifyFailure, recover, main };
