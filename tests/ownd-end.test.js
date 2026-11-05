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

test("終了ガイド：Ameba Ownd引き継ぎの限定価格15,000円を、含まれないものと一緒に書き、あおる表現・ページ数の矛盾を入れていない", () => {
  const page = read(PAGE);
  const ours = textOf(sectionOf(page, "oe-ours"));
  for (const fact of ["Ameba Ownd 引き継ぎ（限定価格）", "15,000円", "税込", "ひな型3種から選べて、最短2日で公開します", "お持ちの独自ドメインへの接続を、1回まで含みます",
    "月額の管理費は0円", "ページ数が多くても、できるだけ対応します", "15,000円に含まれないもの", "ページ数が非常に多い場合は、別途お見積りになります",
    "予約・会員などの機能", "Ameba Owndの内容をそのまま再現することや、データの復旧も含まれません",
    "独自ドメインを使う場合の年額の実費は、別にかかります", "納期は、素材がそろってから最短2日、目安は約14日です", "将来も無料である保証はない"]) assert.ok(ours.includes(fact), "offer states: " + fact);
  assert.match(sectionOf(page, "oe-ours"), /<a href="contact\.html#google-form-embed" class="btn btn-accent js-consult-link">無料で相談する<\/a>/);
  // 依頼者の指示（2026-11-05）：「含まれないもの」から、ブログ機能と納品後の修正は外した（含む・含まないは、このページでは言い切らない）
  for (const removed of ["ブログ機能", "納品後の修正", "5,500"]) assert.ok(!ours.includes(removed), "removed from the exclusions: " + removed);
  // 19,800円のプランは1ページ。「ページ数が多い場合は19,800円」「2ページ以上は対象外」のような、矛盾する案内は書かない
  const text = textOf(page);
  for (const stale of ["2ページ以上", "19,800", "1ページの新しいホームページ", "（税込・1ページ）", "また終わる", "ペライチ"]) assert.ok(!text.includes(stale), "no stale or contradictory wording: " + stale);
  // 「限定」は、依頼者が決めた「Ameba Ownd引き継ぎ限定価格」だけ。期間・数量の限定や、あおる表現は使わない
  assert.equal((text.match(/限定/g) || []).length, (text.match(/限定価格/g) || []).length, "limited only as 'limited price for Ownd migrants'");
  for (const word of ["ぽっきり", "ポッキリ", "今だけ", "先着", "期間限定", "数量限定", "絶対", "必ず安く", "最安", "業界No", "急いで", "いますぐ", "通常価格", "本来は"]) assert.ok(!text.includes(word), "avoid: " + word);
  assert.ok(!/15,000円(?:だけ|のみ)で/.test(text), "never imply nothing else is needed");
  // 最終CTAは、1ページの再スタートではなく、料金プランへ（ページ数の違うプランと混同させない）
  const cta = page.match(/<section class="cta-section">[\s\S]*?<\/section>/)[0];
  assert.match(cta, /<a href="contact\.html#google-form-embed" class="btn btn-accent js-consult-link">無料で相談する<\/a>/);
  assert.match(cta, /<a href="homepage-plan\.html" class="btn btn-outline">料金プランを見る<\/a>/);
  // FAQ：15,000円の範囲（表示と構造化データは、別のテストで一致を確認）
  assert.match(text, /ページ数が多くても、できるだけ対応します。ただし、ページ数が非常に多い場合は、別途お見積りになります。/);
});

test("無料の移行先の表：Googleサイト・アメブロ・Wixを、列と行の表（PCもスマホも）で、○△×ーの印とコメントで比べ、当社の15,000円はそのあとに出る", () => {
  const page = read(PAGE);
  const free = sectionOf(page, "oe-free");
  const table = free.match(/<table class="oe-tbl" role="table">[\s\S]*?<\/table>/)[0];
  assert.ok(!/oe-svc|oe-scale|oe-fit|--ours|oe-tbl-who/.test(page) && !/oe-svc|oe-scale|oe-fit|--ours|oe-tbl-who/.test(read("assets/css/ownd-end.css")), "old cards, company column and mobile chips are gone");
  // 順番：やること → 無料の移行先の表 → 当社の15,000円 → FAQ。表のあるsectionに、当社・料金は出てこない
  const order = ['id="oe-todo"', 'id="oe-free"', 'id="oe-ours"', 'id="oe-faq"'].map(marker => page.indexOf(marker));
  assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > order[index - 1])), "section order: " + order);
  assert.ok(!/15,000|当社|ホームページ再スタート|19,800/.test(textOf(free)), "the free-options section never mentions the company plan");
  assert.match(table, /<caption class="visually-hidden">/, "the table has a caption for screen readers");
  // 横：3つのサービス
  const heads = [...table.matchAll(/<th scope="col" role="columnheader" class="oe-tbl-h oe-tbl-h--free">([\s\S]*?)<\/th>/g)];
  assert.deepEqual(heads.map(match => textOf(match[1])), ["Googleサイト", "アメブロ（Amebaブログ）", "Wix（無料プラン）"]);
  assert.equal([...table.matchAll(/<th scope="col"/g)].length, 3);
  // 縦：項目（比べる4点と同じ順番。先頭に料金）。「また終わるリスク」は載せない
  const rows = [...table.matchAll(/<tr role="row"[^>]*>\s*<th scope="row"[\s\S]*?<\/tr>/g)].map(match => match[0]);
  assert.deepEqual(rows.map(row => textOf(row.match(/<span class="oe-tbl-rowtitle">[\s\S]*?<\/span>/)[0])), ["料金", "独自ドメイン", "広告", "更新", "ページ・容量", "くわしくは"]);
  const spoken = { ok: "良い・使える", warn: "注意が必要", no: "使えない", none: "公式の記載なし" };
  const marks = row => [...row.matchAll(/oe-mark oe-mark--(ok|warn|no|none)" role="img" aria-label="([^"]+)"/g)].map(match => { assert.equal(match[2], spoken[match[1]], "spoken label"); return match[1]; });
  // 行ごとの評価（Googleサイト・アメブロ・Wixの順。更新も、3つのサービスをそれぞれ別のセルにする）
  assert.deepEqual(rows.map(marks), [["none", "ok", "ok"], ["ok", "no", "no"], ["none", "warn", "warn"], ["ok", "ok", "ok"], ["none", "warn", "warn"], []]);
  // どの行も、3つのサービスが別々のセル（セルを結合しない）
  for (const row of rows) assert.equal([...row.matchAll(/<td class="oe-tbl-cell/g)].length, 3, "three separate cells per row: " + textOf(row).slice(0, 12));
  assert.ok(!/colspan|rowspan|oe-tbl-cell--span/.test(table + read("assets/css/ownd-end.css")), "no merged cells");
  // 公式で確認できた内容だけを書き、確認できなかった項目は「公式の記載なし」の印にしている（コメントは、PCでは続きまで、スマホでは短い一文）
  const text = textOf(table);
  for (const fact of ["料金の記載なし。公式ヘルプで確認できませんでした。", "有料は月980円〜（税込）。", "一部は有料です。独自ドメインや広告の非表示は、有料のプレミアムプランが必要です。",
    "DNS設定が必要。反映に最大48時間かかります。", "独自ドメインは使えません。", "有料プランで可。接続には、有料のプレミアムプランが必要です。",
    "非表示は有料。ライトプラン（月1,490円・税込）の機能です。", "Wixの広告バナー。ページに表示されます。", "編集画面から更新します。ただし、最初に作る時間と、操作に慣れる手間はかかります。",
    "上限の記載なし。", "見た目や構成が変わります。ホームページとは作りが異なります。", "保存500MB・通信500MB。"]) assert.ok(text.includes(fact), "table states: " + fact);
  assert.equal((table.match(/oe-mark--none" role="img"/g) || []).length, 3, "Google: price/ads/limits are 'no official statement'");
  assert.ok(!/Googleサイト[^。]{0,20}無料で使える/.test(text), "no unverified claim that Google Sites is free");
  assert.ok(!page.includes("ペライチ") && !table.includes("また終わる"), "the 'risk of ending again' row and its example are gone");
  // 外部の公式リンクはhttpsで別タブ・noopener
  const links = [...table.matchAll(/<a class="oe-tbl-link" href="([^"]+)"([^>]*)>/g)];
  assert.deepEqual(links.map(match => match[1]), ["https://support.google.com/sites/answer/9068867?hl=ja", "https://helps.ameba.jp/faq/premium/paid_plan/about.html", "https://help.amebaownd.com/posts/875", "https://ja.wix.com/upgrade/website"]);
  for (const [, href, attrs] of links) assert.equal(attrs, ' target="_blank" rel="noopener"', href);
  // 凡例と、当社のプランへのつなぎ（価格は出さない）
  assert.equal([...free.matchAll(/<span class="oe-legend-item">/g)].length, 4);
  assert.match(textOf(free), /無料プランの条件は変わることがあるため、お申し込みの前に、公式ページでご確認ください/);
  assert.match(free, /<p class="oe-bridge reveal">ご自分で作るのが大変な方は、<a class="pc-text-link" href="#oe-ours">お任せの場合<\/a>をご覧ください。<\/p>/);
  // 消したサービス（STUDIO・ジンドゥー・WordPress.com）は、比較には載せない
  for (const gone of ["STUDIO", "ジンドゥー", "Jimdo", "WordPress"]) assert.ok(!free.includes(gone), "removed from the comparison: " + gone);
  // 比べる4点：絵のない短い一覧（絵・長い説明・相談ボタンは入れない）
  const points = free.match(/<div class="oe-points reveal" id="oe-compare">[\s\S]*?<\/div>/)[0];
  assert.match(points, /比べるときは、この4点を見ます/);
  assert.deepEqual([...points.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1]), ["今のURL（独自ドメイン）を使えるか", "広告が出ないか", "自分たちで更新できるか", "ページ数・容量の制限"]);
  assert.ok(!/<svg|<img|btn|js-consult-link/.test(points), "the points have no pictures or buttons");
  assert.ok(textOf(points).length < 120, "the points stay short: " + textOf(points).length);
  // スマホでも、列と行の表のまま（グリッドに作り替えない）。続きの説明は省いて、文字と余白を小さくする
  const css = read("assets/css/ownd-end.css");
  const mobile = css.slice(css.indexOf("@media (max-width: 860px) {\n  .oe-tbl-wrap"));
  assert.ok(mobile.includes("@media (max-width: 860px)"), "a dedicated mobile block exists");
  assert.ok(!/\.oe-tbl tbody tr\s*\{[^}]*display:\s*grid/.test(css), "the table is never turned into a grid");
  assert.match(mobile, /\.oe-tbl-more \{\s*display: none;/);
  assert.match(mobile, /\.oe-tbl-rowsub \{\s*display: none;/);
  assert.match(css, /\.oe-tbl \{\s*width: 100%;\s*border-collapse: collapse;\s*table-layout: fixed;/);
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
  for (const url of ["https://blog.amebaownd.com/posts/59351287/", "https://help.amebaownd.com/posts/875", "https://support.google.com/sites/answer/9068867?hl=ja", "https://helps.ameba.jp/faq/premium/paid_plan/about.html", "https://ja.wix.com/upgrade/website"]) {
    assert.ok(sources.includes('href="' + url + '" target="_blank" rel="noopener"'), "source: " + url);
  }
  assert.match(sources, /最新の情報は、必ず公式のお知らせでご確認ください/);
  assert.ok(!sources.includes("peraichi"), "no source for the removed example");
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
