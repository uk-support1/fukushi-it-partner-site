"use strict";

// GitHub Actions の失敗通知（GitHub Issue 方式・無料）。
//   node scripts/notify-workflow-failure.js failure   … 失敗したとき：Issueを作る（既にあれば追記）
//   node scripts/notify-workflow-failure.js recover   … 成功したとき：開いている失敗Issueを閉じる
//
// Issueが作られると、リポジトリ所有者へGitHubのメール／モバイル通知が届きます。
// 通知に失敗しても、ブログの公開処理には影響させません（このスクリプトは常に終了コード0で終わり、
// 失敗したときはActionsのログに警告を残します）。

const { execFileSync } = require("child_process");

const LABEL = "daily-blog-failure";

function defaultGh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] });
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
  return {
    repo,
    runId,
    workflow: env.GITHUB_WORKFLOW || "Daily Blog",
    event: env.GITHUB_EVENT_NAME || "",
    owner: env.GITHUB_REPOSITORY_OWNER || "",
    runUrl: repo && runId ? `${server}/${repo}/actions/runs/${runId}` : "",
    simulated: env.NOTIFY_SIMULATED === "true"
  };
}

// 失敗したジョブ／ステップを取得する（取れなくても通知自体は出す）
function failedSteps(info, gh) {
  if (!info.repo || !info.runId) return [];
  try {
    const raw = gh(["api", `repos/${info.repo}/actions/runs/${info.runId}/jobs`, "--paginate"]);
    const data = JSON.parse(raw);
    const jobs = Array.isArray(data) ? data : (data.jobs || []);
    return jobs.filter(job => job.conclusion === "failure").map(job => ({
      job: job.name,
      url: job.html_url,
      steps: (job.steps || []).filter(step => step.conclusion === "failure").map(step => step.name)
    }));
  } catch {
    return [];
  }
}

function eventLabel(event) {
  return { schedule: "定時実行（schedule）", workflow_dispatch: "手動実行（workflow_dispatch）" }[event] || event || "不明";
}

function buildFailureReport(info, failed, now) {
  const when = jst(now);
  const lines = [];
  if (info.simulated) lines.push("> ⚠️ これは通知の動作確認用の疑似失敗です（実際の投稿エラーではありません）。", "");
  lines.push(
    `## ${info.workflow} の自動投稿が失敗しました`,
    "",
    `- 失敗した日時（日本時間）: ${when}`,
    `- ワークフロー名: ${info.workflow}`,
    `- 実行のきっかけ: ${eventLabel(info.event)}`
  );
  if (failed.length) {
    lines.push("- 失敗した箇所:");
    for (const item of failed) {
      const steps = item.steps.length ? `（ステップ: ${item.steps.join("、")}）` : "";
      lines.push(`  - ジョブ「${item.job}」${steps}${item.url ? ` — ${item.url}` : ""}`);
    }
  } else {
    lines.push("- 失敗した箇所: 実行ログで確認してください");
  }
  lines.push(
    `- 原因を確認するURL: ${info.runUrl || "（URLを取得できませんでした）"}`,
    "",
    "### 次にやること",
    "1. 上の「原因を確認するURL」を開き、赤い × が付いたステップのログを確認します。",
    "2. 原因を直したあと、GitHub の Actions → Daily Blog → Run workflow で手動実行できます。",
    "3. 次に自動投稿が成功すると、この Issue は自動的に閉じられます。",
    "",
    "※ 同じ状態が続いている間は、新しいIssueは作らず、このIssueにコメントが追加されます。"
  );
  const date = when.slice(0, 10);
  return {
    title: `${info.simulated ? "【テスト】" : ""}【自動投稿エラー】${info.workflow} が失敗しました（${date}）`,
    body: lines.join("\n")
  };
}

function findOpenIssue(gh) {
  const raw = gh(["issue", "list", "--label", LABEL, "--state", "open", "--json", "number,url", "--limit", "1"]);
  const list = JSON.parse(raw || "[]");
  return list.length ? list[0] : null;
}

function ensureLabel(gh) {
  try {
    gh(["label", "create", LABEL, "--color", "B60205", "--description", "ブログ自動投稿の失敗通知", "--force"]);
  } catch { /* ラベルが作れなくてもIssue作成は続ける */ }
}

function notifyFailure({ env = process.env, gh = defaultGh, now = new Date() } = {}) {
  const info = runInfo(env);
  const report = buildFailureReport(info, failedSteps(info, gh), now);
  ensureLabel(gh);
  const existing = findOpenIssue(gh);
  if (existing) {
    gh(["issue", "comment", String(existing.number), "--body-file", "-"], report.body);
    return { action: "commented", url: existing.url };
  }
  const base = ["issue", "create", "--title", report.title, "--body-file", "-", "--label", LABEL];
  let url;
  try {
    // 担当者に設定すると、必ずGitHubからの通知が届く
    url = gh(info.owner ? [...base, "--assignee", info.owner] : base, report.body);
  } catch {
    url = gh(base, report.body);
  }
  return { action: "created", url: String(url || "").trim() };
}

function recover({ env = process.env, gh = defaultGh, now = new Date() } = {}) {
  const info = runInfo(env);
  const existing = findOpenIssue(gh);
  if (!existing) return { action: "none" };
  const body = `✅ 自動投稿が復旧しました（${jst(now)} 日本時間）。\n\n成功した実行: ${info.runUrl || "（URL不明）"}\n\nこのIssueを自動で閉じます。`;
  gh(["issue", "comment", String(existing.number), "--body-file", "-"], body);
  gh(["issue", "close", String(existing.number)]);
  return { action: "closed", url: existing.url };
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

module.exports = { LABEL, jst, runInfo, failedSteps, buildFailureReport, notifyFailure, recover, main };
