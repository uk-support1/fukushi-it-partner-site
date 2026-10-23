"use strict";
// PHPの脆弱性（2026年10月）確認結果の報告書を、入力のJSONから作る。
//   node marketing/coconala/templates/report/report.js <input.json> [--out <dir>] [--no-pdf]
//   → <out>/<入力ファイル名>.md（チャットで送る用）と .pdf（納品用・A4）を書き出す。
// 判定（◎△！？・対象外）は、番号から提案する。最終判断は人が行い、入力の status で上書きできる。
// 修正版の番号を変えるときは、01-fact-check-php-vulnerability.md と下の FIXED を合わせて直す。
const fs = require("fs");
const path = require("path");

// ---- 公式情報（2026-10-23確認。01-fact-check-php-vulnerability.md） -------------------------------
const FIXED = { "8.5": "8.5.12", "8.4": "8.4.27", "8.3": "8.3.36", "8.2": "8.2.35" };
const EOL_8_2 = "2026年12月31日";
const SOURCES = [
  ["PHP公式 セキュリティ告知", "https://www.php.net/archive/2026.php"],
  ["IPA 注意喚起（2026-10-22）", "https://www.ipa.go.jp/security/security-alert/2026/alert20261022.html"],
  ["JPCERT/CC 注意喚起（JPCERT-AT-2026-0033）", "https://www.jpcert.or.jp/at/2026/at260033.html"],
  ["WordPress公式（日本語） 告知（2026-10-21）", "https://ja.wordpress.org/2026/10/21/critical-php-security-release/"],
];

const STATUS = {
  ok:     { mark: "◎", label: "対応済み",       color: "#2c6b54", bg: "#e8f4ee" },
  update: { mark: "△", label: "更新が必要",     color: "#d97f3f", bg: "#fdf1e7" },
  eol:    { mark: "！", label: "サポート終了の版", color: "#b4533f", bg: "#f7e7e2" },
  check:  { mark: "？", label: "要確認",         color: "#5b7083", bg: "#e6ecf1" },
  none:   { mark: "－", label: "対象外",         color: "#5b6562", bg: "#eef1ef" },
};
const MANAGED = { customer: "お客様が管理画面で選べる", host: "サーバー会社が管理している", unknown: "確認できていない" };

// ---- 判定の提案（04-listing-copy.md「判定のきまり」と同じ） ---------------------------------------
function parseVersion(v) {
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v || ""));
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: m[3] === undefined ? null : +m[3], series: `${m[1]}.${m[2]}` };
}
function judge(input) {
  if (input.uses_php === false) return { status: "none", reasons: ["PHPを使っていないとのご説明・画面でした"] };
  const v = parseVersion(input.php_version);
  if (!v) return { status: "check", reasons: ["PHPの番号を確認できませんでした"] };
  const rank = v.major * 100 + v.minor;
  const patchable = !!input.provider_patch_possible;
  const hostManaged = input.php_managed_by === "host";
  if (rank < 802) {
    return patchable
      ? { status: "check", reasons: ["8.1以前ですが、提供元が番号を変えずに修正している可能性があります"] }
      : { status: "eol", reasons: ["8.1以前は、PHPプロジェクトの更新が出ません"] };
  }
  const fixed = FIXED[v.series];
  if (!fixed) return { status: "check", reasons: [`${v.series}系は、公式の修正版の一覧（8.2〜8.5系）にありません。公式の最新情報をご確認ください`] };
  if (v.patch === null) return { status: "check", reasons: ["番号の最後の数字まで確認できませんでした"] };
  const fixedPatch = +fixed.split(".")[2];
  if (v.patch >= fixedPatch) return { status: "ok", reasons: [`${v.series}系の修正版（${fixed}）以上の番号でした`] };
  if (patchable) return { status: "check", reasons: ["番号は修正版より前ですが、提供元が番号を変えずに修正している可能性があります"] };
  if (hostManaged) return { status: "check", reasons: ["番号は修正版より前ですが、サーバー会社がPHPを管理しているため、修正の適用状況の確認が必要です"] };
  return { status: "update", reasons: [`${v.series}系の修正版（${fixed}）より前の番号でした`] };
}

// ---- 文面 -----------------------------------------------------------------------------------------
function buildModel(input) {
  const j = judge(input);
  const status = input.status && input.status !== "auto" ? input.status : j.status;
  const st = STATUS[status];
  if (!st) throw new Error("status は auto / ok / update / eol / check / none のどれかです: " + input.status);
  const v = parseVersion(input.php_version);
  const ver = v ? String(input.php_version).trim() : "確認できませんでした";
  const fixedForSeries = v && FIXED[v.series];
  const series = v ? v.series : "";
  const note82 = v && v.series === "8.2" ? `なお、8.2系は${EOL_8_2}でセキュリティ更新が終わります。早めに8.3系以上への切り替えを計画することをおすすめします。` : "";

  const conclusion = {
    ok: `いただいた画面では、PHPの番号は ${ver} でした。今回の修正版（${fixedForSeries || "各系列の修正版"}）以上の番号です。今回の件について、新しい対応は必要ないとみられます。${note82}`,
    update: `いただいた画面では、PHPの番号は ${ver} でした。今回の修正版（${fixedForSeries || "各系列の修正版"}）より前の番号です。更新をおすすめします。`,
    eol: `いただいた画面では、PHPの番号は ${ver} でした。8.1以前の版は、PHPプロジェクトからの更新が出ません（今回の修正版も出ていません）。サポート中の版への切り替えをおすすめします。`,
    check: `いただいた情報では、今回の脆弱性に該当するかを判断できませんでした。${(input.unknown_reason || j.reasons.join("。")) ? "（理由：" + (input.unknown_reason || j.reasons.join("。")) + "）" : ""}無理に判定せず、確認先をご案内します。`,
    none: `PHPを使っていないサイトとお見受けしました。今回のPHPの脆弱性の対象にはならないとみられます。同じサーバーに、PHPで動く別のサイト（古いWordPressなど）が残っていないかも、念のためご確認ください。`,
  }[status];

  const confirmRows = [
    ["サイトのURL", input.site_url || "（未記入）"],
    ["サーバー会社", input.host || "確認できていません"],
    ["PHPの番号", ver],
    ["確認に使った情報", input.evidence || "（未記入）"],
    ["PHPの管理", MANAGED[input.php_managed_by] || MANAGED.unknown],
    ["確認日", input.report_date || "（未記入）"],
  ];

  const relation = [
    "2026年10月21日、PHPの重大な脆弱性2件（CVE-2026-109618・CVE-2026-109619）の修正版が公開されました。公式は、すべての利用者に、速やかな更新を強く呼びかけています。完全な対策は、修正版への更新です（設定の変更だけでは、完全な対策になりません）。",
    "PHPの番号が同じでも、サーバー会社やOSの提供元が、番号を変えずに修正を済ませている場合があります。そのため、番号だけで判断できないときは「要確認」とお伝えしています。",
  ];
  const versionTable = [
    ["8.5系", FIXED["8.5"], ""], ["8.4系", FIXED["8.4"], ""], ["8.3系", FIXED["8.3"], ""],
    ["8.2系", FIXED["8.2"], `${EOL_8_2}でセキュリティ更新が終了`], ["8.1以前", "（修正版なし）", "PHPプロジェクトの更新は出ません"],
  ].map(([s, f, n]) => ({ series: s, fixed: f, note: n, mine: v && (s.startsWith(series) || (s === "8.1以前" && v.major * 100 + v.minor < 802)) }));

  const updateSteps = [
    "更新の前に、サーバー会社のお知らせで、すでに今回の修正が適用されていないかを確認します（番号が変わらないまま修正されている場合があります）。",
    "適用されていなければ、更新の前にバックアップを取ります。",
    "サーバーの管理画面で、修正版以上の番号へ切り替えます。切り替えたあと、トップページ・主要なページ・問い合わせフォーム・管理画面が、正しく表示されるかを確認します。",
    "表示が崩れるなどの不具合が出たときは、元の番号に戻して、原因（古いテーマ・プラグインなど）を確認します。**元に戻した状態では、今回の脆弱性への対応になりません。**",
    "ご自身で行うのが難しい場合は、制作会社・サーバー会社にご相談ください。",
  ];
  const actions = {
    ok: ["今回の件について、新しい対応は必要ないとみられます。",
      "WordPress本体・テーマ・プラグインの更新は、別の作業です。更新の通知が出ていないか、ときどきご確認ください。",
      ...(note82 ? [note82] : [])],
    update: updateSteps,
    eol: ["サーバー会社に、サポート中の版（8.3系以上）へ切り替えられるかを確認してください。",
      "切り替えられる場合は、バックアップを取り、切り替えて、表示を確認します（上の「△更新が必要」と同じ手順）。",
      "切り替えられない場合（古いサーバー・古いテーマやプラグインなど）は、下の「続け方の選択肢」をご検討ください。",
      "サーバー会社やOSの提供元が、独自に修正を提供している場合があります。下の文例で確認してください。"],
    check: ["下の文例を使って、サーバー会社（または制作会社）に、お問い合わせください。",
      input.rereport_offer ? "回答（修正の適用の有無・日付・動作中の番号）が届きましたら、トークルームでお知らせください。内容に応じて、ご報告をし直します（1回、追加料金はかかりません）。" : "回答が届きましたら、トークルームでお知らせください。",
      "お客様側で変えられる設定があるかは、サーバー会社にご確認ください。設定の変更だけでは完全な対策にならないため、この報告書では、具体的な設定値はご案内していません。"],
    none: ["特にありません。", "念のため、同じサーバーにPHPで動く別のサイト（古いWordPressなど）が残っていないかを、ご確認ください。"],
  }[status];

  const hostQuestions = (status === "check" || status === "eol" || (status === "update" && input.php_managed_by === "host")) ? [
    `お世話になっております。契約中のホームページ（${input.site_url || "サイトのURL"}）について、次の点を教えてください。`,
    "1. 2026年10月21日に公開されたPHPの脆弱性（CVE-2026-109618、CVE-2026-109619）の修正は、適用済みでしょうか。適用済みの場合は、その日付も教えてください。（更新ではなく、緩和策のみの場合は、その旨も教えてください）",
    "2. 現在、このサイトで動いているPHPのバージョンを教えてください。",
    "3. PHPのバージョンは、お客様側の管理画面で選べますか。選べる場合は、変更の方法を教えてください。",
  ] : null;

  const cautions = (status === "update" || status === "eol") ? [
    "更新の前に、必ずバックアップを取ってください（ファイルとデータベースの両方）。",
    "古いテーマ・プラグインは、新しいPHPで動かない場合があります。切り替えのあと、主要なページと問い合わせフォームを確認してください。",
    "サーバーによっては、PHPの番号を元に戻せない仕様の場合があります。切り替えの前に、戻せるかを確認してください。",
    "WordPress本体・テーマ・プラグインの更新は、PHPの更新とは別の作業で、どちらも必要です。",
  ] : null;

  const options = (status === "update" || status === "eol") ? [
    "PHPを更新して、そのまま使い続ける。多くの場合は、これで足ります。ご希望の方には、ココナラの有料オプション「PHP更新作業」でお受けします（WordPressで、PHPの番号を元に戻せるサーバーの場合）。",
    "更新が難しい場合（古いサーバー・古いテーマやプラグインなど）は、サーバーの変更や、保守の依頼をご検討ください。",
    "事業所の紹介が中心のサイトで、更新の手間や管理費を減らしたい場合は、PHPを使わない形への乗り換えという方法もあります。ご興味があれば、ココナラの「見積り相談」でご連絡ください。今のまま更新して続けるほうが合う場合も多く、無理におすすめするものではありません。",
  ] : null;

  const scope = [
    "このご報告は、いただいた情報（画面の写真・ご説明）にもとづく、PHPの番号の確認と、今回の修正版との比較です。**脆弱性診断（攻撃を試すテスト）や、攻撃を受けたかどうかの調査ではありません。**",
    `判定は、${input.report_date || "ご報告の日"}時点の公式発表と、いただいた情報にもとづきます。状況が変わった場合は、公式の最新情報をご確認ください。`,
    "「安全です」というお約束ではありません。サーバーの設定や、サーバー会社の対応状況は、確認していません。",
    "WordPress本体・テーマ・プラグインの状態は、確認の対象外です（画面に写っていた範囲で気づいた点は、参考としてお伝えする場合があります）。",
    "攻撃を受けた可能性が心配な場合は、サーバー会社や、専門の業者にご相談ください。",
  ];

  return { input, status, st, judge: j, conclusion, confirmRows, relation, versionTable, actions, hostQuestions, cautions, options, scope, notes: input.notes || [] };
}

// ---- 出力：Markdown --------------------------------------------------------------------------------
const plain = s => String(s).replace(/\*\*/g, "");
function renderMarkdown(m) {
  const L = [];
  L.push(`# PHPの脆弱性（2026年10月）確認結果のご報告${m.input.sample ? "　【サンプル・架空の例】" : ""}`, "");
  L.push(`## 結論：${m.st.mark} ${m.st.label}`, "", m.conclusion, "");
  L.push("## 確認した内容", "", "| 項目 | 内容 |", "| --- | --- |", ...m.confirmRows.map(r => `| ${r[0]} | ${r[1]} |`), "");
  L.push("## 今回の脆弱性との関係", "", ...m.relation.flatMap(p => [p, ""]));
  L.push("| 系列 | 修正版 | 備考 |", "| --- | --- | --- |", ...m.versionTable.map(r => `| ${r.series}${r.mine ? "（お客様）" : ""} | ${r.fixed} | ${r.note} |`), "");
  L.push("## 必要な対策", "", ...m.actions.map((a, i) => `${i + 1}. ${plain(a)}`), "");
  if (m.hostQuestions) L.push("## サーバー会社・制作会社に確認すること（文例）", "", ...m.hostQuestions.map(q => `> ${q}`), "");
  if (m.cautions) L.push("## 更新するときの注意", "", ...m.cautions.map(c => `- ${c}`), "");
  if (m.options) L.push("## 続け方の選択肢（必要な方のみ）", "", ...m.options.map(o => `- ${o}`), "");
  if (m.notes.length) L.push("## 補足", "", ...m.notes.map(n => `- ${n}`), "");
  L.push("## このご報告の範囲", "", ...m.scope.map(s => `- ${plain(s)}`), "");
  L.push("## 参考（公式の情報）", "", ...SOURCES.map(([t, u]) => `- ${t}：${u}`), "");
  return L.join("\n");
}

// ---- 出力：HTML（PDF用） ---------------------------------------------------------------------------
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
function renderHtml(m) {
  const sample = m.input.sample ? '<div class="wm" aria-hidden="true">サンプル（架空の例）</div>' : "";
  const section = (title, body) => `<section><h2>${esc(title)}</h2>${body}</section>`;
  const ul = a => `<ul>${a.map(x => `<li>${bold(x)}</li>`).join("")}</ul>`;
  const ol = a => `<ol>${a.map(x => `<li>${bold(x)}</li>`).join("")}</ol>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>PHPの脆弱性 確認結果のご報告</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 15mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Noto Sans JP", "IPAexGothic", "IPAGothic", sans-serif; font-size: 9.6pt; line-height: 1.62; color: #34383a; }
h1 { margin: 0 0 3mm; font-size: 15.5pt; font-weight: 800; color: #1f4d3c; }
.meta { margin: 0 0 4mm; font-size: 8.6pt; color: #5b6562; }
h2 { margin: 0 0 1.8mm; padding-left: 2.6mm; border-left: 1.4mm solid #4a8c6f; font-size: 10.8pt; font-weight: 800; color: #1f4d3c; }
section { margin: 0 0 4.2mm; break-inside: avoid; }
.concl { display: flex; align-items: center; gap: 4mm; margin: 0 0 4.2mm; padding: 3.4mm 4.2mm; border-radius: 3mm; background: ${m.st.bg}; border: .5mm solid ${m.st.color}; break-inside: avoid; }
.concl .mk { flex: none; width: 13mm; height: 13mm; border-radius: 50%; background: ${m.st.color}; color: #fff; font-size: 17pt; font-weight: 800; text-align: center; line-height: 13mm; }
.concl .lb { margin: 0 0 .8mm; font-size: 13pt; font-weight: 800; color: ${m.st.color}; }
.concl .tx { margin: 0; font-size: 9.8pt; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; }
th, td { padding: 1.4mm 2.4mm; border: .25mm solid #cfd8d3; text-align: left; vertical-align: top; }
th { width: 31mm; background: #f1f6f3; font-weight: 700; }
.vt th { width: auto; }
.vt tr.mine td { background: #fff4e5; font-weight: 700; }
p { margin: 0 0 1.6mm; }
ul, ol { margin: 0; padding-left: 5.2mm; }
li { margin: 0 0 1mm; }
.q { margin: 0; padding: 2.4mm 3.4mm; background: #f4f7f4; border-left: 1mm solid #8aa99a; font-size: 9.1pt; }
.q p { margin: 0 0 1mm; }
.src { font-size: 8.4pt; color: #5b6562; word-break: break-all; }
.foot { margin-top: 3mm; font-size: 8.3pt; color: #5b6562; }
.wm { position: fixed; top: 46%; left: 6%; width: 88%; text-align: center; transform: rotate(-24deg); font-size: 40pt; font-weight: 800; color: rgba(180,83,63,.13); z-index: 5; pointer-events: none; }
</style></head><body>${sample}
<h1>PHPの脆弱性（2026年10月）確認結果のご報告</h1>
<p class="meta">福祉ITパートナー　／　確認日：${esc(m.input.report_date || "")}</p>
<div class="concl"><div class="mk">${m.st.mark}</div><div><p class="lb">結論：${esc(m.st.label)}</p><p class="tx">${bold(m.conclusion)}</p></div></div>
${section("確認した内容", `<table>${m.confirmRows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")}</table>`)}
${section("今回の脆弱性との関係", m.relation.map(p => `<p>${esc(p)}</p>`).join("") + `<table class="vt"><tr><th>系列</th><th>修正版</th><th>備考</th></tr>${m.versionTable.map(r => `<tr class="${r.mine ? "mine" : ""}"><td>${esc(r.series)}${r.mine ? "（お客様）" : ""}</td><td>${esc(r.fixed)}</td><td>${esc(r.note)}</td></tr>`).join("")}</table>`)}
${section("必要な対策", ol(m.actions))}
${m.hostQuestions ? section("サーバー会社・制作会社に確認すること（文例）", `<div class="q">${m.hostQuestions.map(q => `<p>${esc(q)}</p>`).join("")}</div>`) : ""}
${m.cautions ? section("更新するときの注意", ul(m.cautions)) : ""}
${m.options ? section("続け方の選択肢（必要な方のみ）", ul(m.options)) : ""}
${m.notes.length ? section("補足", ul(m.notes)) : ""}
${section("このご報告の範囲", ul(m.scope))}
${section("参考（公式の情報）", `<ul class="src">${SOURCES.map(([t, u]) => `<li>${esc(t)}：${esc(u)}</li>`).join("")}</ul>`)}
</body></html>`;
}

// ---- 実行 ------------------------------------------------------------------------------------------
function loadPlaywright() {
  for (const c of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(c); } catch (_) { /* 次へ */ } }
  throw new Error("playwright が見つかりません（PDFを作るには playwright と Chromium が必要です。--no-pdf でMarkdownだけ作れます）");
}
async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const file = args.find((a, i) => !a.startsWith("--") && (outIdx < 0 || i !== outIdx + 1));
  if (!file) throw new Error("使い方: node report.js <input.json> [--out <dir>] [--no-pdf]");
  const outDir = path.resolve(outIdx >= 0 ? args[outIdx + 1] : path.dirname(file));
  const input = JSON.parse(fs.readFileSync(file, "utf8"));
  const model = buildModel(input);
  const base = path.join(outDir, path.basename(file).replace(/\.json$/i, ""));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(base + ".md", renderMarkdown(model));
  console.log(`判定の提案：${STATUS[model.judge.status].mark} ${STATUS[model.judge.status].label}（${model.judge.reasons.join("／")}）`);
  console.log(`報告書の判定：${model.st.mark} ${model.st.label}${model.status !== model.judge.status ? "（入力で上書き）" : ""}`);
  console.log("書き出し:", path.relative(process.cwd(), base + ".md"));
  if (args.includes("--no-pdf")) return;
  const { chromium } = loadPlaywright();
  const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  await page.setContent(renderHtml(model), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: base + ".pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log("書き出し:", path.relative(process.cwd(), base + ".pdf"));
}
module.exports = { judge, buildModel, parseVersion, FIXED };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
