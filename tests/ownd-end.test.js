"use strict";
// Ameba Owndの終了と移行ガイド（ameba-ownd-end.html）と、ナビの「Ownd終了」入口のテスト。
// 日付・条件は公式の発表にもとづく事実なので、書き間違いと、誤解を招く表現（「ぽっきり」「今だけ」など）が
// 入り込まないことを重点的に確認する。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
const PAGE = "ameba-ownd-end.html";
const BASE = "https://fukushi-it-partner.com/";
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)].map(match => JSON.parse(match[1]));
const textOf = html => html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, "").replace(/<br[^>]*>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const htmlFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? htmlFiles(full) : entry.name.endsWith(".html") ? [full] : [];
});
const sectionOf = (html, id) => {
  const found = html.match(new RegExp('<section[^>]*id="' + id + '"[\\s\\S]*?</section>'));
  assert.ok(found, "section #" + id);
  return found[0];
};

test("全ページ共通ナビに「Ameba Ownd終了」（NEWバッジ付き）が、「PHP対応」の次に入っている", () => {
  let checked = 0;
  for (const full of htmlFiles(ROOT)) {
    const nav = fs.readFileSync(full, "utf8").match(/<ul class="nav-links">([\s\S]*?)<\/ul>/);
    if (!nav) continue; // 共通ナビを持たないページ（移転の転送ページ・補助金LPの独自ヘッダー）
    const rel = path.relative(ROOT, full).split(path.sep).join("/");
    const prefix = "../".repeat(rel.split("/").length - 1);
    const items = [...nav[1].matchAll(/<li><a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a><\/li>/g)];
    const ownd = items.filter(item => item[1] === prefix + PAGE);
    assert.equal(ownd.length, 1, rel + " has exactly one Ownd item in the nav");
    assert.match(ownd[0][2], rel === PAGE ? /class="nav-ownd active"/ : /class="nav-ownd"/, rel);
    assert.equal(ownd[0][3], 'Ameba Ownd終了<span class="nav-badge">NEW</span>', rel + " badge");
    assert.deepEqual(items.map(item => textOf(item[3])).slice(0, 5), ["HOME", "料金プラン", "PHP対応NEW", "Ameba Ownd終了NEW", "制作実績"], rel + " order");
    checked++;
  }
  assert.ok(checked >= 90, "the shared nav is on every page: " + checked);
  // 記事・講座のテンプレートからも同じ入口が出る（再生成しても消えない）
  assert.equal((read("scripts/generate-blog.js").match(/class="nav-ownd">Ameba Ownd終了<span class="nav-badge">NEW<\/span>/g) || []).length, 2);
  assert.equal((read("scripts/generate-course.js").match(/class="nav-ownd">Ameba Ownd終了<span class="nav-badge">NEW<\/span>/g) || []).length, 1);
  // メニューが9項目になっても、PC幅1280pxまではロゴ・相談ボタンと重ならないよう、幅ごとに文字と間隔を詰め、ハンバーガーに切り替わるのは1279px以下
  const css = read("assets/css/style.css");
  assert.match(css, /@media \(max-width: 1279px\) \{\s*\.nav-cta \{\s*display: none;/);
  assert.ok(!/max-width: 1200px|max-width: 1260px|max-width: 1320px/.test(css), "no leftover nav breakpoint");
  assert.match(css, /@media \(min-width: 1280px\) and \(max-width: 1339px\) \{\s*\.nav-links \{\s*gap: 10px;/);
  assert.match(css, /@media \(min-width: 1340px\) and \(max-width: 1439px\) \{\s*\.nav-links \{\s*gap: 14px;/);
  assert.match(css, /@media \(min-width: 1280px\) \{\s*\.nav-bar \{\s*max-width: 1400px;/);
});

test("フッターに「Ameba Owndの終了と移行ガイド」へのリンクがあり、サイトマップにも載っている", () => {
  const footerLink = /<li><a href="(?:\.\.\/)?ameba-ownd-end\.html">Ameba Owndの終了と移行ガイド<\/a><\/li>/;
  for (const file of ["index.html", "homepage-plan.html", "homepage-recovery.html", "php-homepage-comparison.html", "contact.html", PAGE, "blog.html", "course.html", "blog/ameba-ownd-cannot-view.html"]) {
    assert.match(read(file), footerLink, file + " footer link");
  }
  assert.equal((read("scripts/generate-blog.js").match(/ameba-ownd-end\.html">Ameba Owndの終了と移行ガイド/g) || []).length, 2, "both blog templates");
  assert.match(read("scripts/generate-course.js"), /ameba-ownd-end\.html">Ameba Owndの終了と移行ガイド/);
  assert.ok(read("scripts/generate-blog.js").includes('"' + BASE + PAGE + '"'), "the sitemap generator keeps the page");
  assert.ok(read("sitemap.xml").includes("<loc>" + BASE + PAGE + "</loc>"));
});

test("終了ガイド：SEO設定（title・説明・canonical・OG・GA4・構造化データ・見出し）が整っている", () => {
  const page = read(PAGE);
  assert.match(page, /<title>Ameba Owndが12月24日に終了｜やることと、移行先の比べ方｜福祉ITパートナー<\/title>/);
  assert.match(page, /<meta name="description" content="[^"]{80,}"/);
  assert.match(page, new RegExp('<link rel="canonical" href="' + (BASE + PAGE).replace(/\./g, "\\.") + '">'));
  assert.match(page, new RegExp('<meta property="og:url" content="' + (BASE + PAGE).replace(/\./g, "\\.") + '">'));
  assert.match(page, /assets\/js\/ga4\.js/);
  assert.match(page, /assets\/js\/main\.js/);
  assert.ok(!/noindex/.test(page));
  assert.equal((page.match(/<h1\b/g) || []).length, 1, "exactly one h1");
  assert.equal(textOf(page.match(/<h1[\s\S]*?<\/h1>/)[0]), "Ameba Owndが2026年12月24日に終了します");
  for (const css of ["assets/css/php-compare.css", "assets/css/ownd-end.css", "favicon.ico", "site.webmanifest"]) assert.ok(fs.existsSync(path.join(ROOT, css)), css);
  assert.match(page, /ownd-end\.css\?v=1/);
  const graph = jsonLd(page)[0]["@graph"];
  assert.deepEqual(graph.map(node => node["@type"]), ["WebPage", "BreadcrumbList", "FAQPage"]);
  assert.equal(graph[0].url, BASE + PAGE);
  assert.equal(graph[1].itemListElement[1].item, BASE + PAGE);
});

test("終了ガイド：FAQの表示と構造化データが一致し、8問そろっている", () => {
  const page = read(PAGE);
  const faq = jsonLd(page)[0]["@graph"].find(node => node["@type"] === "FAQPage");
  const visible = [...page.matchAll(/<details class="pc-faq-item">\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)].map(match => [match[1].trim(), match[2].trim()]);
  assert.equal(faq.mainEntity.length, 8);
  assert.equal(visible.length, 8);
  faq.mainEntity.forEach((question, index) => {
    assert.equal(question.name, visible[index][0]);
    assert.equal(question.acceptedAnswer.text, visible[index][1]);
  });
});

test("終了ガイド：公式の発表どおりの日付・条件が書かれている（アメブロは終了しないことも明記）", () => {
  const text = textOf(read(PAGE));
  for (const fact of [
    "2026年12月24日（木）11時", "11月2日（月）13時", "11月中", "12月中",
    "アメブロ（Amebaブログ）は終了しません", "終了後はデータを復元できません",
    "ドメイン会社の管理画面で", "メール用の設定は変更・削除しないでください", "Ameba Ownd側での解除の操作は不要",
    "移行期間の延長を検討していますが、2026年11月5日時点では決まっていません",
    "PHPなど特定の仕組みが原因かどうかは分かりません",
    "不正アクセスや情報流出は確認されていない",
  ]) assert.ok(text.includes(fact), "page states: " + fact);
  assert.ok(text.includes("2026年11月5日時点"), "dated");
  // 原因をPHPと断定する表現はない（運営は原因の詳細を公表していない）
  assert.ok(!/(?:PHP|WordPress)(?:が|の脆弱性が|のせいで)(?:原因|終了の理由)(?:です|だ|でした)/.test(text), "no claim that PHP is the cause");
  // 正しい日付以外の「12月◯日 11時」が紛れ込んでいない
  for (const match of text.matchAll(/12月(\d+)日[^。、]{0,6}11時/g)) assert.equal(match[1], "24", "the end date is always the 24th: " + match[0]);
});

test("終了ガイド：料金は誤解を招かない書き方で、15,000円の範囲外を先に伝え、あおる表現を使っていない", () => {
  const page = read(PAGE);
  const ours = textOf(sectionOf(page, "oe-ours"));
  for (const fact of ["15,000円", "税込", "月額の管理費は0円", "15,000円に含まれないもの", "2ページ以上", "ブログ機能", "納品後の修正（5,500円〜／回）",
    "Ameba Owndの内容をそのまま再現することや、データの復旧も含まれません", "独自ドメインを使う場合の年額の実費は、別にかかります",
    "将来も無料である保証はない", "19,800円のおまかせライトプラン"]) assert.ok(ours.includes(fact), "offer states: " + fact);
  assert.match(page, /<a href="contact\.html#google-form-embed" class="btn btn-accent js-consult-link">無料で相談する<\/a>/);
  assert.match(page, /<a href="homepage-recovery\.html" class="btn btn-outline">15,000円の内容をくわしく見る<\/a>/);
  const text = textOf(page);
  for (const word of ["ぽっきり", "ポッキリ", "今だけ", "先着", "限定", "絶対", "必ず安く", "最安", "業界No", "急いで", "いますぐ"]) assert.ok(!text.includes(word), "avoid: " + word);
  assert.ok(!/15,000円(?:だけ|のみ)で/.test(text), "never imply nothing else is needed");
  // 「15,000円で何でもできる」と読めない：ページ数が多い場合などの案内がある
  assert.match(text, /ページ数が多い場合やブログ記事がたくさんある場合は、19,800円のプランや個別のお見積り/);
});

test("移行先の比較表：Googleサイト・アメブロ・Wixと当社の15,000円を、○△×ーの印とコメントで比べている（PCは表、スマホは2×2）", () => {
  const page = read(PAGE);
  const free = sectionOf(page, "oe-free");
  const table = free.match(/<table class="oe-tbl" role="table">[\s\S]*?<\/table>/)[0];
  assert.ok(!/oe-svc|oe-svc-grid/.test(page) && !/oe-svc/.test(read("assets/css/ownd-end.css")), "the old cards are gone");
  assert.match(table, /<caption class="visually-hidden">/, "the table has a caption for screen readers");
  // 横：3つのサービスと、当社（列ごとに色が決まっている）
  const heads = [...table.matchAll(/<th scope="col" role="columnheader" class="oe-tbl-h oe-tbl-h--(free|ours)">([\s\S]*?)<\/th>/g)];
  assert.deepEqual(heads.map(match => match[1]), ["free", "free", "free", "ours"]);
  assert.deepEqual(heads.map(match => textOf(match[2])), ["Googleサイト", "アメブロ（Amebaブログ）", "Wix（無料プラン）", "当社ホームページ再スタート 15,000円（税込）"]);
  // 縦：項目
  const rows = [...table.matchAll(/<tr role="row"[^>]*>\s*<th scope="row"[\s\S]*?<\/tr>/g)].map(match => match[0]);
  assert.deepEqual(rows.map(row => textOf(row.match(/<span class="oe-tbl-rowtitle">[\s\S]*?<\/span>/)[0])), ["料金", "独自ドメイン", "広告", "ページの制限", "更新", "作る手間", "また終わるリスク", "くわしくは"]);
  const spoken = { ok: "良い・使える", warn: "注意が必要", no: "使えない", none: "公式の記載なし" };
  const marks = row => [...row.matchAll(/oe-mark oe-mark--(ok|warn|no|none)" role="img" aria-label="([^"]+)"/g)].map(match => { assert.equal(match[2], spoken[match[1]], "spoken label"); return match[1]; });
  // 行ごとの評価（Googleサイト・アメブロ・Wix・当社の順。更新・作る手間・また終わるリスクは、無料3つが共通の1セル）
  assert.deepEqual(rows.slice(0, 7).map(marks), [
    ["none", "ok", "ok", "warn"],
    ["ok", "no", "no", "ok"],
    ["none", "warn", "warn", "ok"],
    ["none", "warn", "warn", "warn"],
    ["ok", "warn"],
    ["warn", "ok"],
    ["warn", "ok"],
  ]);
  assert.deepEqual(marks(rows[7]), [], "the links row has no marks");
  for (const index of [4, 5, 6]) assert.match(rows[index], /<td class="oe-tbl-cell oe-tbl-cell--free oe-tbl-cell--span" role="cell" colspan="3">/, "shared cell in row " + index);
  // 公式で確認できた内容だけを書き、確認できなかった項目は「公式の記載なし」にしている
  const text = textOf(table);
  for (const fact of ["DNS設定が必要で、反映に最大48時間かかります", "アメブロは、独自ドメインを使えません（Ameba Ownd公式ヘルプ）", "プラス月980円・ライト月1,490円、税込",
    "広告の非表示は、有料のライトプラン（月1,490円・税込）の機能です", "Wixの広告バナーが表示されます", "保存できる量は500MB、通信量も500MBです",
    "独自ドメインの接続には、有料のプレミアムプランが必要です", "15,000円（税込）", "月額の管理費は0円です", "ひな型には、広告は入っていません",
    "更新はご依頼のたびに5,500円〜／回です", "素材がそろってから約14日です", "公開データ一式をお渡しするので、将来また引っ越せます", "将来も無料である保証はありません"]) assert.ok(text.includes(fact), "table states: " + fact);
  assert.equal((table.match(/oe-mark--none" role="img"/g) || []).length, 3, "Google: price/ads/limits are 'no official statement'");
  assert.ok(!text.includes("Googleサイト無料") && !/Googleサイト[^。]{0,20}無料で使える/.test(text), "no unverified claim that Google Sites is free");
  // 外部の公式リンクはhttpsで別タブ・noopener。当社の列は、再スタートのページへ
  const links = [...table.matchAll(/<a class="oe-tbl-link" href="([^"]+)"([^>]*)>/g)];
  assert.deepEqual(links.map(match => match[1]), ["https://support.google.com/sites/answer/9068867?hl=ja", "https://helps.ameba.jp/faq/premium/paid_plan/about.html", "https://help.amebaownd.com/posts/875", "https://ja.wix.com/upgrade/website", "homepage-recovery.html"]);
  for (const [, href, attrs] of links) if (href.startsWith("https:")) assert.equal(attrs, ' target="_blank" rel="noopener"', href);
  // 凡例・無料プランが変わる実例（ペライチ）
  assert.equal([...free.matchAll(/<span class="oe-legend-item">/g)].length, 4);
  assert.match(textOf(free), /ペライチは、2025年10月から、無料プランでは公開できなくなりました/);
  assert.ok(free.includes('href="https://peraichi.com/pages/pricing"'));
  assert.match(textOf(free), /無料プランの条件は変わることがあるため、お申し込みの前に、公式ページでご確認ください/);
  // 消したサービス（STUDIO・ジンドゥー・WordPress.com）は、比較には載せない
  for (const gone of ["STUDIO", "ジンドゥー", "Jimdo", "WordPress"]) assert.ok(!free.includes(gone), "removed from the comparison: " + gone);
  // スマホでは、項目名を各行の帯にして、サービスのセルを2×2に並べる
  const css = read("assets/css/ownd-end.css");
  assert.match(css, /@media \(max-width: 860px\) \{[\s\S]*?\.oe-tbl tbody tr \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.oe-tbl tbody th \{\s*grid-column: 1 \/ -1;/);
  // 比べ方：5つのものさし
  const compare = textOf(sectionOf(page, "oe-compare"));
  for (const scale of ["① 今のURL（独自ドメイン）を使えるか", "② 広告が出ないか", "③ 自分たちで更新できるか", "④ ページ数・容量の制限", "⑤ また終わらないか・データを持ち出せるか"]) assert.ok(compare.includes(scale), scale);
});

test("終了ガイド：内部リンクが実在し、外部リンクはhttpsで、関連記事・情報源がそろっている", () => {
  const page = read(PAGE);
  for (const match of page.matchAll(/\bhref="([^"]+)"/g)) {
    const href = match[1];
    if (/^(?:mailto:|tel:)/.test(href)) continue;
    if (/^https?:/.test(href)) { assert.match(href, /^https:\/\//, "external links use https: " + href); continue; }
    const [target, hash] = href.split("#");
    const targetPath = target.split("?")[0];
    const targetFile = targetPath === "" ? path.join(ROOT, PAGE) : path.resolve(ROOT, targetPath);
    assert.ok(fs.existsSync(targetFile) && fs.statSync(targetFile).isFile(), PAGE + " -> " + href + " does not exist");
    if (hash) assert.ok(fs.readFileSync(targetFile, "utf8").includes('id="' + hash + '"'), PAGE + " -> " + href + " anchor is missing");
  }
  const sources = sectionOf(page, "oe-sources");
  assert.match(sources, /確認した公式情報（最終確認：2026年11月5日）/);
  for (const url of ["https://blog.amebaownd.com/posts/59351287/", "https://help.amebaownd.com/posts/875", "https://support.google.com/sites/answer/9068867?hl=ja", "https://helps.ameba.jp/faq/premium/paid_plan/about.html", "https://ja.wix.com/upgrade/website", "https://peraichi.com/pages/pricing"]) {
    assert.ok(sources.includes('href="' + url + '" target="_blank" rel="noopener"'), "source: " + url);
  }
  assert.match(sources, /最新の情報は、必ず公式のお知らせでご確認ください/);
});

test("再スタートのページと、既存のOwnd記事から終了ガイドへ案内している。記事は発表後の状況に合わせて更新済み", () => {
  const recovery = read("homepage-recovery.html");
  assert.match(recovery, /<p class="rc-hero-caution rc-hero-ownd"><strong>Ameba Ownd（アメーバオウンド）をお使いの方へ：<\/strong>2026年12月24日11時にサービスが終了します。<a class="rc-link" href="ameba-ownd-end\.html">/);
  const article = read("content/articles/ameba-ownd-cannot-view.md");
  assert.match(article, /【2026年11月5日更新】Ameba Owndは、2026年11月2日に、2026年12月24日（木）11時でサービスを終了することを発表しました/);
  assert.ok(article.includes("](../ameba-ownd-end.html)"));
  assert.ok(article.includes("https://blog.amebaownd.com/posts/59351287/"), "the official end-of-service notice is a source");
  assert.ok(!article.includes("公式の案内が出ていないのに「終了する」と書かれた記事もあります"), "the outdated sentence is gone");
  assert.ok(article.includes("date: \"2026-10-29\""), "the article date is unchanged (the daily blog guard depends on dates)");
  const html = read("blog/ameba-ownd-cannot-view.html");
  assert.ok(html.includes('href="../ameba-ownd-end.html"') && html.includes("【2026年11月5日更新】"));
});
