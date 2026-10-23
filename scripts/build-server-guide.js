"use strict";

// 「レンタルサーバー・ドメイン比較＆契約サポート」ページ（server-domain-guide.html）の本文を、
// data/server-guide.json から作り直す。ヘッダー・フッター・<head>は、ほかのページと同じ手作業の部分で、
// このスクリプトは、次の2か所の「目印のコメントの間」だけを書き換える。
//   <!-- server-guide:jsonld:start --> … <!-- server-guide:jsonld:end -->   （FAQの構造化データ）
//   <!-- server-guide:main:start -->   … <!-- server-guide:main:end -->     （本文）
// 料金を直す／紹介リンクに切り替えるときは data/server-guide.json を編集して `npm run build:server-guide`。

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(ROOT, "data", "server-guide.json");
const PAGE_FILE = path.join(ROOT, "server-domain-guide.html");
const MARK = {
  main: ["<!-- server-guide:main:start -->", "<!-- server-guide:main:end -->"],
  jsonld: ["<!-- server-guide:jsonld:start -->", "<!-- server-guide:jsonld:end -->"]
};

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const yen = n => n.toLocaleString("ja-JP") + "円";

// ---------------------------------------------------------------------------
// 紹介リンク：status が approved で referral があれば紹介リンク（PR・nofollow・sponsored）、
// それ以外は公式の通常リンク。切り替えはデータ側だけでできる。
// ---------------------------------------------------------------------------
function linkInfo(data, key) {
  const link = data.links[key];
  if (!link) throw new Error("unknown link key: " + key);
  const referral = link.status === "approved" && Boolean(link.referral);
  return { key, name: link.name, url: referral ? link.referral : link.official, referral, pixel: referral ? link.pixel || null : null };
}

function makeAnchor(data, state) {
  return function anchor(key, text, className) {
    const info = linkInfo(data, key);
    const rel = info.referral ? "sponsored nofollow noopener" : "noopener";
    let html = `<a href="${esc(info.url)}" class="${className}" target="_blank" rel="${rel}" data-link="${esc(key)}" data-link-type="${info.referral ? "referral" : "official"}">${text}${info.referral ? '<span class="sg-pr-mark">PR</span>' : ""}</a>`;
    if (info.pixel && !state.pixels.has(key)) {
      state.pixels.add(key);
      html += `<img border="0" width="1" height="1" src="${esc(info.pixel)}" alt="">`;
    }
    return html;
  };
}

// ---------------------------------------------------------------------------
// 各部分
// ---------------------------------------------------------------------------
function priceBlock(plan) {
  if (plan.campaign) {
    return `<p class="sg-price"><span class="sg-price-label">${esc(plan.campaign.label)}</span>
            <span class="sg-price-num"><span class="sg-num">${plan.campaign.monthly12.toLocaleString("ja-JP")}</span>円<small>／月</small></span>
            <span class="sg-price-sub">12か月で ${yen(plan.campaign.total12)}（${esc(plan.campaign.until)}まで）</span>
            <span class="sg-price-normal">通常料金：月${yen(plan.monthly12)}（12か月で ${yen(plan.total12)}）</span></p>`;
  }
  return `<p class="sg-price"><span class="sg-price-label">${esc(plan.monthlyNote)}</span>
            <span class="sg-price-num"><span class="sg-num">${plan.monthly12.toLocaleString("ja-JP")}</span>円<small>／月</small></span>
            <span class="sg-price-sub">12か月で ${yen(plan.total12)}</span></p>`;
}

const PICKS = [
  { id: "sakura-standard", who: "はじめてで、迷ったら", reasons: [
    "24時間365日受付のサポート（チャット・メール・電話コールバック）と、動画のスタートアップガイドがあり、サーバー選びに慣れていなくても進めやすい",
    "バックアップ＆ステージングが標準で、WordPress の更新前に試せる",
    "12か月で6,600円（月額換算550円）、初期費用は無料。14日間はカード登録なしで試せる"
  ] },
  { id: "lolipop-light", who: "まず費用をおさえたい", reasons: [
    "12か月契約でも月539円と、比較した4プランでもっとも安い",
    "WordPress が使え、小さな事業所の紹介サイトには十分な容量（SSD 350GB）"
  ], note: "自動バックアップ（有料オプション）と電話サポートは付かないため、必要なら上位プランも比較します。" },
  { id: "xserver-standard", who: "バックアップ・電話サポートも欲しい", reasons: [
    "毎日の自動バックアップ（過去14日分）、電話・メールサポート、RAID10が標準",
    "サーバー契約中ずっと無料になる独自ドメイン特典（12か月契約で1つ）がある"
  ], note: "12か月契約の月額は高めです。キャンペーン価格は期間限定です。" },
  { id: "lolipop-highspeed", who: "アクセスが多い・機能も欲しい", reasons: [
    "LiteSpeed による高速表示。自動バックアップが無料で、電話サポートも使える",
    "12か月以上＋自動更新で、ドメインずっと無料2個の対象"
  ], note: "12か月分の合計は、ライトの約2倍になります。" }
];

function pickSection(data, anchor) {
  const byId = Object.fromEntries(data.servers.map(plan => [plan.id, plan]));
  const cards = PICKS.map(pick => {
    const plan = byId[pick.id];
    const first = plan.badge === "第一候補";
    return `
        <article class="sg-pick${first ? " sg-pick--first" : ""} reveal">
          ${first ? '<p class="sg-pick-flag">現時点の第一候補</p>' : ""}
          <p class="sg-pick-who">${esc(pick.who)}</p>
          <h3 class="sg-pick-name">${esc(plan.company)}<span>${esc(plan.plan)}</span></h3>
          <p class="sg-pick-price">12か月契約で<strong>月${plan.campaign ? plan.campaign.monthly12.toLocaleString("ja-JP") : plan.monthly12.toLocaleString("ja-JP")}円</strong>${plan.campaign ? '<small>（キャンペーン価格。通常は月' + yen(plan.monthly12) + "）</small>" : ""}</p>
          <ul class="sg-check">${pick.reasons.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
          ${pick.note ? `<p class="sg-pick-note">${esc(pick.note)}</p>` : ""}
          <div class="sg-pick-cta">${anchor(plan.link, "公式ページで確認する", "btn " + (first ? "btn-accent" : "btn-outline"))}</div>
        </article>`;
  }).join("");
  return `
  <section class="sg-section sg-pick-section" id="sg-pick" aria-labelledby="sg-pick-title">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-tag">目的別のおすすめ</span>
        <h2 class="section-title" id="sg-pick-title">目的に合わせて、選び方の目安を</h2>
        <p class="section-lead">「どれがいちばん良いか」は、事業所の状況によって変わります。<br>現時点の第一候補は<strong>さくらのレンタルサーバー（スタンダード）</strong>ですが、他社にも優れた点があります。</p>
      </div>
      <div class="sg-pick-grid">${cards}
      </div>
      <p class="sg-note reveal">※ 料金はすべて税込、2026年10月22日に各社の公式ページで確認した金額です。最新の金額や条件は、申込み前に必ず公式ページでご確認ください。</p>
    </div>
  </section>`;
}

function serverCards(data, anchor) {
  const cards = data.servers.map(plan => `
        <article class="sg-card reveal" id="sg-${esc(plan.id)}">
          <header class="sg-card-head">
            <p class="sg-badge${plan.badge === "第一候補" ? " sg-badge--first" : ""}">${esc(plan.badge)}</p>
            <h3 class="sg-card-title">${esc(plan.company)}<span>${esc(plan.plan)}</span></h3>
            ${priceBlock(plan)}
          </header>
          <dl class="sg-spec">
            <div><dt>初期費用</dt><dd>${esc(plan.initial)}</dd></div>
            <div><dt>容量</dt><dd>${esc(plan.disk)}</dd></div>
            <div><dt>WordPress</dt><dd>${esc(plan.wordpress)}</dd></div>
            <div><dt>バックアップ</dt><dd>${esc(plan.backup)}</dd></div>
            <div><dt>サポート</dt><dd>${esc(plan.support)}</dd></div>
            <div><dt>お試し</dt><dd>${esc(plan.trial)}</dd></div>
          </dl>
          <h4 class="sg-card-sub">特徴</h4>
          <ul class="sg-check">${plan.features.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
          <h4 class="sg-card-sub sg-card-sub--warn">注意点</h4>
          <ul class="sg-warn">${plan.cautions.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
          <div class="sg-card-cta">${anchor(plan.link, esc(plan.company) + "の公式ページへ", "btn btn-outline")}</div>
        </article>`).join("");
  return `
  <section class="sg-section" id="sg-server" aria-labelledby="sg-server-title">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-tag">レンタルサーバー 3社</span>
        <h2 class="section-title" id="sg-server-title">レンタルサーバーの比較カード</h2>
        <p class="section-lead">福祉事業所・小規模団体の「事業所紹介サイト」を想定し、12か月契約で比べています。</p>
      </div>
      <div class="sg-card-grid">${cards}
      </div>
    </div>
  </section>`;
}

function serverTable(data) {
  const plans = data.servers;
  const head = plans.map(plan => `<th scope="col">${esc(plan.company)}<small>${esc(plan.plan)}</small></th>`).join("");
  const row = (label, fn) => `<tr><th scope="row">${label}</th>${plans.map(plan => `<td>${fn(plan)}</td>`).join("")}</tr>`;
  const monthly = plan => plan.campaign
    ? `<strong>${yen(plan.campaign.monthly12)}</strong><small>キャンペーン価格（${esc(plan.campaign.until)}まで）<br>通常 ${yen(plan.monthly12)}</small>`
    : `<strong>${yen(plan.monthly12)}</strong><small>${esc(plan.monthlyNote)}</small>`;
  const total = plan => plan.campaign
    ? `<strong>${yen(plan.campaign.total12)}</strong><small>通常 ${yen(plan.total12)}</small>`
    : `<strong>${yen(plan.total12)}</strong>`;
  return `
  <section class="sg-section sg-table-section" id="sg-table" aria-labelledby="sg-table-title">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-tag">比較表</span>
        <h2 class="section-title" id="sg-table-title">レンタルサーバー比較表（12か月契約）</h2>
        <p class="section-lead">スマートフォンでは、表を横にスライドして見られます。</p>
      </div>
      <div class="sg-table-wrap reveal" tabindex="0" role="region" aria-label="レンタルサーバー比較表（横にスクロールできます）">
        <table class="sg-table">
          <thead><tr><th scope="col" class="sg-table-corner"><span class="visually-hidden">項目</span></th>${head}</tr></thead>
          <tbody>
            ${row("月額（12か月契約）", monthly)}
            ${row("12か月分の合計", total)}
            ${row("初期費用", plan => esc(plan.initial))}
            ${row("容量", plan => esc(plan.disk))}
            ${row("WordPress", plan => esc(plan.wordpress))}
            ${row("バックアップ", plan => esc(plan.backup))}
            ${row("サポート", plan => esc(plan.support))}
            ${row("お試し期間", plan => esc(plan.trial))}
          </tbody>
        </table>
      </div>
      <p class="sg-note reveal">※ 税込。${esc(data.checkedAtLabel)}確認。各社の公式ページの表示をもとにしています。更新時の料金や、キャンペーンの条件は、契約前に必ず公式ページでご確認ください。</p>
    </div>
  </section>`;
}

function domainSection(data, anchor) {
  const cards = data.domains.map(domain => `
        <article class="sg-card sg-card--domain reveal" id="sg-${esc(domain.id)}">
          <header class="sg-card-head">
            <p class="sg-badge">${esc(domain.badge)}</p>
            <h3 class="sg-card-title">${esc(domain.company)}<span>.com</span></h3>
          </header>
          <div class="sg-domain-prices">
            <div class="sg-domain-price"><p class="sg-domain-label">初年度（取得）</p><p class="sg-domain-num"><span class="sg-num">${esc(domain.first.replace("円", "").replace("〜", ""))}</span>円${domain.first.includes("〜") ? "〜" : ""}</p><p class="sg-domain-note">${esc(domain.firstNote)}</p></div>
            <div class="sg-domain-price sg-domain-price--renew"><p class="sg-domain-label">2年目以降（更新・1年あたり）</p><p class="sg-domain-num"><span class="sg-num">${esc(domain.renew.replace("円", "").replace("〜", ""))}</span>円${domain.renew.includes("〜") ? "〜" : ""}</p><p class="sg-domain-note">${esc(domain.renewNote)}</p></div>
          </div>
          <h4 class="sg-card-sub">特徴</h4>
          <ul class="sg-check">${domain.features.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
          <h4 class="sg-card-sub sg-card-sub--warn">注意点</h4>
          <ul class="sg-warn">${domain.cautions.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
          <div class="sg-card-cta">${anchor(domain.link, esc(domain.company) + "の公式ページへ", "btn btn-outline")}</div>
        </article>`).join("");
  const row = (label, fn) => `<tr><th scope="row">${label}</th>${data.domains.map(domain => `<td>${fn(domain)}</td>`).join("")}</tr>`;
  return `
  <section class="sg-section sg-domain-section" id="sg-domain" aria-labelledby="sg-domain-title">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-tag">ドメイン 3社</span>
        <h2 class="section-title" id="sg-domain-title">ドメイン（.com）の比較</h2>
        <p class="section-lead">ドメインは「<strong>初年度の料金</strong>」と「<strong>2年目以降の更新料金</strong>」が大きく違うことがあります。<br>長く使うものなので、更新料金も必ず見比べてください。</p>
      </div>
      <div class="sg-card-grid sg-card-grid--three">${cards}
      </div>
      <div class="sg-table-wrap sg-table-wrap--domain reveal" tabindex="0" role="region" aria-label="ドメイン比較表（横にスクロールできます）">
        <table class="sg-table sg-table--domain">
          <thead><tr><th scope="col" class="sg-table-corner"><span class="visually-hidden">項目</span></th>${data.domains.map(domain => `<th scope="col">${esc(domain.company)}</th>`).join("")}</tr></thead>
          <tbody>
            ${row("初年度（.com）", domain => `<strong>${esc(domain.first)}</strong><small>${esc(domain.firstNote)}</small>`)}
            ${row("2年目以降（更新）", domain => `<strong>${esc(domain.renew)}</strong><small>${esc(domain.renewNote)}</small>`)}
          </tbody>
        </table>
      </div>
      <div class="sg-tip reveal">
        <h3>サーバーの特典で、ドメインが無料になることもあります</h3>
        <p>エックスサーバーは、サーバー契約中ずっと無料になる独自ドメイン特典（スタンダードは12か月契約で1つ）があります。ロリポップ！ハイスピードも、12か月以上の契約と自動更新の設定で「ドメインずっと無料」2個の対象です。サーバーの特典を使う場合は、ドメインを別に買わなくて済むことがあります。条件は各社の公式ページでご確認ください。</p>
      </div>
      <p class="sg-note reveal">※ 税込。${esc(data.checkedAtLabel)}確認。ドメインの料金は、公式のお知らせで改定されることがあります。申込み前に、各社の公式ページで最新の金額をご確認ください。</p>
    </div>
  </section>`;
}

function supportSection() {
  const steps = [
    ["ご相談", "ホームページの目的や、使いたい機能をお聞きします。"],
    ["サービスの選定", "この比較表をもとに、ご予算と運用のしやすさに合う組み合わせをご提案します。"],
    ["お客様の名義でお申込み", "契約者は、お客様ご自身（事業所・団体）です。画面を見ながら、手順をご案内します。"],
    ["初期設定のお手伝い", "ドメインの設定、SSL、メールアドレスなど、公開に必要な設定を支援します。"],
    ["ホームページの公開", "ご契約のサーバーに、ホームページを公開します。"]
  ];
  return `
  <section class="sg-section sg-support-section" id="sg-support" aria-labelledby="sg-support-title">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-tag">契約サポート</span>
        <h2 class="section-title" id="sg-support-title">お申込みは、お客様の名義で。<span class="no-break">設定は</span><span class="no-break">福祉ITパートナーが</span><span class="no-break">支援します。</span></h2>
        <p class="section-lead">サーバーやドメインの契約は、お客様ご自身の名義で行います。お支払いも、各サービスの会社へ直接行います。<br>契約や設定でわからないところを、福祉ITパートナーがお手伝いします。</p>
      </div>
      <ol class="sg-steps">${steps.map(([title, text], index) => `
        <li class="sg-step reveal"><p class="sg-step-num"><span>STEP</span>${index + 1}</p><h3>${esc(title)}</h3><p>${esc(text)}</p></li>`).join("")}
      </ol>
      <div class="sg-support-box reveal">
        <p>契約サポートの内容や費用は、ご相談の内容に応じてご案内します。まずは、お気軽にご相談ください。</p>
        <div class="btn-group sg-support-cta">
          <a href="contact.html#google-form-embed" class="btn btn-accent js-consult-link">サーバー・ドメインの契約を相談する</a>
          <a href="homepage-plan.html" class="btn btn-outline">ホームページ制作の料金プラン</a>
        </div>
      </div>
    </div>
  </section>`;
}

const FAQ = [
  ["サーバーとドメインは、同じ会社で契約しないといけませんか？",
    "いいえ、別々の会社でも使えます。同じ会社にまとめると、契約や請求の管理がかんたんになる場合があります。サーバーの特典でドメインが無料になる会社もあります。"],
  ["ドメインの「初年度0円・1円」は、ずっとその金額ですか？",
    "いいえ。初年度だけの特別価格のことが多く、2年目以降は更新料金がかかります。このページでは、初年度と更新料金を分けて載せています。"],
  ["契約は、福祉ITパートナーの名義ですか？",
    "いいえ。サーバーもドメインも、お客様ご自身（事業所・団体）の名義でご契約いただきます。福祉ITパートナーは、選び方や設定をお手伝いします。"],
  ["このページから申し込むと、料金は高くなりますか？",
    "いいえ。紹介リンクから申し込んでも、お客様のお支払い額は変わりません。紹介リンクの経由で、福祉ITパートナーが紹介報酬を受け取る場合があります。"],
  ["比較の内容は、いつ時点のものですか？",
    "各社の公式ページで確認した、2026年10月22日時点の内容です。料金やキャンペーンは変わることがあるため、申込み前に必ず公式ページでご確認ください。"],
  ["すでにホームページがあり、管理費を見直したい場合は？",
    "「ホームページ維持費削減・乗り換えプラン」で、現在の契約の確認（診断は0円）から対応しています。サーバーやドメインの選び直しもご相談ください。"]
];

function faqSection() {
  return `
  <section class="sg-section sg-faq-section" id="sg-faq" aria-labelledby="sg-faq-title">
    <div class="container">
      <div class="section-head reveal">
        <span class="section-tag">よくあるご質問</span>
        <h2 class="section-title" id="sg-faq-title">よくあるご質問</h2>
      </div>
      <div class="sg-faq reveal">${FAQ.map(([q, a]) => `
        <details class="sg-faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
      </div>
    </div>
  </section>`;
}

function prSection(data) {
  const approved = Object.values(data.links).filter(link => link.status === "approved" && link.referral);
  const others = Object.values(data.links).filter(link => !(link.status === "approved" && link.referral));
  const programs = approved.map(link => `<li><strong>${esc(link.name)}</strong>${link.program ? `（${esc(link.program)}）` : ""}</li>`).join("");
  return `
  <section class="sg-section sg-pr-section" id="sg-pr" aria-labelledby="sg-pr-title">
    <div class="container">
      <div class="sg-pr-box reveal">
        <h2 class="sg-pr-title" id="sg-pr-title">広告（PR）・紹介報酬について</h2>
        <p>このページには、広告（PR）を含みます。下の会社へのリンクは<strong>紹介リンク</strong>で、リンク先でお申込みいただくと、福祉ITパートナーが紹介報酬を受け取る場合があります。紹介リンクには「PR」と表示しています。</p>
        <ul class="sg-pr-list">${programs}</ul>
        <p>お客様のお支払い額が、紹介リンクの経由で高くなることはありません。比較の内容や並び順は、紹介報酬の有無ではなく、料金・機能・管理のしやすさをもとに公平に作成しています。</p>
        <p>${others.length ? `上記以外（${others.map(link => esc(link.name)).join("、")}）へのリンクは、各社の公式サイトへの通常のリンクです。` : ""}紹介リンクの設定は、今後変わることがあります。</p>
        <p class="sg-pr-small">料金・機能は、各社の公式ページで確認した内容（${esc(data.checkedAtLabel)}時点）です。誤りや変更がある場合は、公式ページの内容が優先されます。</p>
      </div>
    </div>
  </section>`;
}

function sourcesSection(data) {
  const items = Object.entries(data.sources).map(([key, urls]) => {
    const link = data.links[key];
    return `<li><strong>${esc(link.name)}</strong>：${urls.map(url => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https:\/\//, ""))}</a>`).join("、")}</li>`;
  }).join("");
  return `
  <section class="sg-section sg-sources-section" aria-labelledby="sg-sources-title">
    <div class="container">
      <div class="sg-sources reveal">
        <h2 class="sg-sources-title" id="sg-sources-title">確認した公式ページ（${esc(data.checkedAtLabel)}）</h2>
        <ul>${items}</ul>
      </div>
    </div>
  </section>`;
}

function heroSection(data) {
  const approvedNames = Object.values(data.links).filter(link => link.status === "approved" && link.referral).map(link => link.name);
  return `
  <section class="sg-hero" aria-labelledby="sg-hero-title">
    <div class="container sg-hero-inner">
      <p class="sg-pr-banner"><span class="sg-pr-mark sg-pr-mark--lg">PR</span>このページには広告（PR）を含みます。${approvedNames.length ? esc(approvedNames.join("・")) + "などの紹介リンクを掲載しています。" : ""}<a href="#sg-pr">詳しくはこちら</a></p>
      <span class="section-tag">ホームページの公開準備</span>
      <h1 class="sg-hero-title" id="sg-hero-title">レンタルサーバー・ドメインの<br class="sg-sp-br">比較＆契約サポート</h1>
      <p class="sg-hero-lead">ホームページを公開するには、「サーバー」と「ドメイン」が必要です。<br>福祉事業所・非営利団体・小規模事業者の方が、料金・機能・管理のしやすさを公平に比べて、自分に合うサービスを選べるようにまとめました。</p>
      <ul class="sg-hero-points">
        <li><strong>サーバー3社</strong>・<strong>ドメイン3社</strong>を比較</li>
        <li>初年度料金と<strong>更新料金</strong>を分けて掲載</li>
        <li>契約は<strong>お客様の名義</strong>。設定は福祉ITパートナーが支援</li>
      </ul>
      <div class="btn-group sg-hero-actions">
        <a href="#sg-pick" class="btn btn-accent">目的別のおすすめを見る</a>
        <a href="contact.html#google-form-embed" class="btn btn-outline js-consult-link">契約サポートを相談する</a>
      </div>
      <p class="sg-hero-note">料金は税込。${esc(data.checkedAtLabel)}に、各社の公式ページで確認しました。</p>
    </div>
  </section>`;
}

function ctaSection() {
  return `
  <section class="cta-section">
    <div class="container reveal">
      <h2>サーバー・ドメイン選びで<span class="no-break">迷ったら、</span><span class="no-break">ご相談ください。</span></h2>
      <p class="sg-cta-lead">契約はお客様の名義で。選び方から設定まで、やさしくお手伝いします。</p>
      <div class="btn-group">
        <a href="contact.html#google-form-embed" class="btn btn-accent js-consult-link">無料相談はこちら</a>
      </div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
function buildMain(data) {
  const state = { pixels: new Set() };
  const anchor = makeAnchor(data, state);
  return [
    heroSection(data),
    pickSection(data, anchor),
    serverCards(data, anchor),
    serverTable(data),
    domainSection(data, anchor),
    supportSection(),
    faqSection(),
    prSection(data),
    sourcesSection(data),
    ctaSection()
  ].join("\n") + "\n";
}

function buildJsonLd() {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } }))
  };
  return `<script type="application/ld+json">\n${JSON.stringify(faq, null, 2)}\n</script>`;
}

function replaceBetween(html, [start, end], body) {
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < 0 || b < a) throw new Error("markers not found: " + start);
  return html.slice(0, a + start.length) + "\n" + body.replace(/\n+$/, "") + "\n" + html.slice(b);
}

function build({ write = true } = {}) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const raw = fs.readFileSync(PAGE_FILE, "utf8");
  const crlf = raw.includes("\r\n");
  let html = raw.replace(/\r\n/g, "\n");
  html = replaceBetween(html, MARK.jsonld, buildJsonLd());
  html = replaceBetween(html, MARK.main, buildMain(data));
  if (write) fs.writeFileSync(PAGE_FILE, crlf ? html.replace(/\n/g, "\r\n") : html);
  return html;
}

if (require.main === module) {
  build();
  console.log("updated server-domain-guide.html");
}

module.exports = { build, buildMain, buildJsonLd, linkInfo, FAQ, MARK, PAGE_FILE, DATA_FILE };
