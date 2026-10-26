"use strict";

// 「レンタルサーバー・ドメイン比較＆契約サポート」ページ（server-domain-guide.html）の本文を、
// data/server-guide.json から作り直す。ヘッダー・フッター・<head>は、ほかのページと同じ手作業の部分で、
// このスクリプトは、次の2か所の「目印のコメントの間」だけを書き換える。
//   <!-- server-guide:jsonld:start --> … <!-- server-guide:jsonld:end -->   （FAQの構造化データ）
//   <!-- server-guide:main:start -->   … <!-- server-guide:main:end -->     （本文）
// 料金を直す／紹介リンクに切り替えるときは data/server-guide.json を編集して `npm run build:server-guide`。
//
// ページの構成（上から順）：
//   冒頭の2つの導線（右上に小さく「PR」）→ サーバーの目的別おすすめ（コンパクト）→ サーバー比較表（主要コンテンツ）
//   → ドメイン比較 → 契約サポート → プラン別の補足カード → FAQ → 確認元 → 広告・注意書き（1文）→ 相談

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
const num = n => n.toLocaleString("ja-JP");
// 長い会社名が「…サーバ／ー」のように中途半端に改行されないよう、「の」の後ろに改行可能な位置を入れる
const nameHtml = name => esc(name).replace("さくらのレンタルサーバー", "さくらの<wbr>レンタルサーバー");
const untilShort = until => String(until).replace(/^\d{4}年/, "");
const yen = n => num(n) + "円";

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
const ICON_SERVER = '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><rect x="4" y="5" width="24" height="8" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="4" y="19" width="24" height="8" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="9" cy="23" r="1.4" fill="currentColor"/><path d="M15 9h9M15 23h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const ICON_DOMAIN = '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M5.5 16h21M16 5c3.2 3 4.8 6.6 4.8 11S19.2 24 16 27M16 5c-3.2 3-4.8 6.6-4.8 11S12.8 24 16 27" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

function heroSection(data) {
  return `
  <section class="sg-hero" aria-labelledby="sg-hero-title">
    <div class="container sg-hero-inner">
      <a class="sg-pr-corner" href="#sg-pr" aria-label="広告（PR）を含むページです。注意書きへ移動">PR</a>
      <span class="section-tag">ホームページの公開準備</span>
      <h1 class="sg-hero-title" id="sg-hero-title">レンタルサーバー・ドメインの<br class="sg-sp-br">比較＆契約サポート</h1>
      <p class="sg-hero-lead">料金・機能・管理のしやすさで、公平に比べられます。<br class="sg-pc-br">契約はお客様の名義で、設定は福祉ITパートナーが支援します。</p>
      <nav class="sg-jump" aria-label="比較メニュー">
        <a class="sg-jump-btn" href="#sg-server-compare">
          <span class="sg-jump-icon">${ICON_SERVER}</span>
          <span class="sg-jump-text"><strong>レンタルサーバーを比較する</strong><small>4プランを12か月契約で比較</small></span>
          <span class="sg-jump-arrow" aria-hidden="true">↓</span>
        </a>
        <a class="sg-jump-btn" href="#sg-domain-compare">
          <span class="sg-jump-icon">${ICON_DOMAIN}</span>
          <span class="sg-jump-text"><strong>ドメインを比較する</strong><small>.com の取得・更新料金を比較</small></span>
          <span class="sg-jump-arrow" aria-hidden="true">↓</span>
        </a>
      </nav>
      <p class="sg-hero-note">料金は税込・${esc(data.checkedAtLabel)}確認</p>
    </div>
  </section>`;
}

function pickSection(data) {
  const tiles = data.servers.map(plan => `
        <li class="sg-tile${plan.badge === "第一候補" ? " sg-tile--first" : ""}">
          ${plan.badge === "第一候補" ? '<span class="sg-tile-flag">第一候補</span>' : ""}
          <p class="sg-tile-purpose">${esc(plan.purpose)}</p>
          <p class="sg-tile-name">${nameHtml(plan.company)}<small>${esc(plan.plan)}</small></p>
          <p class="sg-tile-price"><span class="sg-tile-price-label">月額換算</span><strong><span class="sg-num">${num(plan.monthly12)}</span>円</strong></p>
        </li>`).join("");
  return `
  <section class="sg-section sg-pick-section" id="sg-pick" aria-labelledby="sg-pick-title">
    <div class="container">
      <h2 class="sg-h2" id="sg-pick-title">目的別・サーバーのおすすめ</h2>
      <ul class="sg-tiles">${tiles}
      </ul>
      <p class="sg-note">月額換算は、12か月契約・税込・通常料金です。現時点の第一候補は、さくらのレンタルサーバー（スタンダード）です。</p>
    </div>
  </section>`;
}

function serverTable(data, anchor) {
  const lowest = Math.min(...data.servers.map(plan => plan.monthly12));
  const rows = data.servers.map(plan => {
    const first = plan.badge === "第一候補";
    const monthly = `<strong><span class="sg-num">${num(plan.monthly12)}</span>円</strong>${plan.monthly12 === lowest ? '<span class="sg-lowest">最安</span>' : ""}${plan.campaign ? `<small>キャンペーン中 ${yen(plan.campaign.monthly12)}<br>（${esc(untilShort(plan.campaign.until))}まで）</small>` : ""}`;
    const total = `<strong><span class="sg-num">${num(plan.total12)}</span>円</strong>${plan.campaign ? `<small>キャンペーン中 ${yen(plan.campaign.total12)}</small>` : ""}`;
    return `
            <tr class="${first ? "sg-row--first" : ""}">
              <th scope="row"><span class="sg-plan-company">${nameHtml(plan.company)}</span><span class="sg-plan-name">${esc(plan.plan)}</span>${first ? '<span class="sg-tile-flag sg-tile-flag--inline">第一候補</span>' : ""}</th>
              <td class="sg-cell-price">${monthly}</td>
              <td class="sg-cell-price">${total}</td>
              <td>${esc(plan.wordpress)}</td>
              <td>${esc(plan.backup)}</td>
              <td>${esc(plan.support)}</td>
              <td class="sg-cell-link">${anchor(plan.link, "公式サイト", "sg-btn-sm")}</td>
            </tr>`;
  }).join("");
  return `
  <section class="sg-section sg-compare-section" id="sg-server-compare" aria-labelledby="sg-server-title">
    <div class="container">
      <h2 class="sg-h2" id="sg-server-title">レンタルサーバー比較表<small>12か月契約・税込</small></h2>
      <div class="sg-table-wrap" tabindex="0" role="region" aria-label="レンタルサーバー比較表（横にスクロールできます）">
        <table class="sg-table">
          <thead>
            <tr>
              <th scope="col" class="sg-table-corner">サービス・プラン</th>
              <th scope="col">月額換算</th>
              <th scope="col">年間料金<small>（12か月分）</small></th>
              <th scope="col">WordPress</th>
              <th scope="col">バックアップ</th>
              <th scope="col">サポート体制</th>
              <th scope="col">公式サイト</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
      </div>
      <p class="sg-note">初期費用は、いずれも0円（無料）です。キャンペーン価格は期間限定です。更新時の料金や条件は、契約前に各社の公式サイトでご確認ください。</p>
    </div>
  </section>`;
}

function domainSection(data, anchor) {
  const rows = data.domains.map(domain => `
            <tr>
              <th scope="row">${esc(domain.company)}</th>
              <td class="sg-cell-price"><strong><span class="sg-num">${esc(domain.first.replace("円", "").replace("〜", ""))}</span>円${domain.first.includes("〜") ? "〜" : ""}</strong><small>${esc(domain.firstShort)}</small></td>
              <td class="sg-cell-price sg-cell-price--renew"><strong><span class="sg-num">${esc(domain.renew.replace("円", "").replace("〜", ""))}</span>円${domain.renew.includes("〜") ? "〜" : ""}</strong><small>${esc(domain.renewShort)}</small></td>
              <td>${esc(domain.feature)}</td>
              <td class="sg-cell-link">${anchor(domain.link, "公式サイト", "sg-btn-sm")}</td>
            </tr>`).join("");
  return `
  <section class="sg-section sg-compare-section sg-domain-section" id="sg-domain-compare" aria-labelledby="sg-domain-title">
    <div class="container">
      <h2 class="sg-h2" id="sg-domain-title">ドメイン（.com）の比較<small>税込</small></h2>
      <p class="sg-lead">初年度と、2年目以降の更新料金は、大きく違うことがあります。<strong>更新料金</strong>も見比べてください。</p>
      <div class="sg-table-wrap" tabindex="0" role="region" aria-label="ドメイン比較表（横にスクロールできます）">
        <table class="sg-table sg-table--domain">
          <thead>
            <tr>
              <th scope="col" class="sg-table-corner">サービス</th>
              <th scope="col">初年度<small>（.com の取得）</small></th>
              <th scope="col">2年目以降<small>（.com の更新・1年）</small></th>
              <th scope="col">特徴</th>
              <th scope="col">公式サイト</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
        </table>
      </div>
      <ul class="sg-footnotes">${data.domainNotes.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
      <p class="sg-note">サーバーの特典（エックスサーバー、ロリポップ！ハイスピード）で、ドメインが無料になる場合もあります。条件は各社の公式サイトでご確認ください。</p>
    </div>
  </section>`;
}

function supportSection() {
  const steps = ["ご相談", "サービスの選定", "お客様の名義でお申込み", "初期設定のお手伝い", "ホームページの公開"];
  return `
  <section class="sg-section sg-support-section" id="sg-support" aria-labelledby="sg-support-title">
    <div class="container">
      <div class="sg-support-box">
        <h2 class="sg-support-title" id="sg-support-title">契約はお客様の名義で。設定は福祉ITパートナーが支援します</h2>
        <p class="sg-support-text">サーバーやドメインの契約者は、お客様ご自身（事業所・団体）です。お支払いも、各社へ直接行います。選び方から、申込みの手順、ドメイン・SSL・メールなどの初期設定まで、お手伝いします。</p>
        <ol class="sg-flow">${steps.map((label, index) => `<li><span>${index + 1}</span>${esc(label)}</li>`).join("")}</ol>
        <p class="sg-support-small">サポートの内容や費用は、ご相談の内容に応じてご案内します。</p>
        <div class="btn-group sg-support-cta">
          <a href="contact.html#google-form-embed" class="btn btn-accent js-consult-link">サーバー・ドメインの契約を相談する</a>
          <a href="homepage-plan.html" class="btn btn-outline">ホームページ制作の料金プラン</a>
        </div>
      </div>
    </div>
  </section>`;
}

function detailSection(data, anchor) {
  const cards = data.servers.map(plan => `
        <article class="sg-card" id="sg-${esc(plan.id)}">
          <header class="sg-card-head">
            <h3 class="sg-card-title">${nameHtml(plan.company)}<span>${esc(plan.plan)}</span></h3>
            <p class="sg-badge${plan.badge === "第一候補" ? " sg-badge--first" : ""}">${esc(plan.badge)}</p>
          </header>
          <p class="sg-card-spec">容量 ${esc(plan.disk)}／お試し ${esc(plan.trial)}／初期費用 ${esc(plan.initial)}</p>
          <ul class="sg-check">${plan.features.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
          <ul class="sg-warn">${plan.cautions.map(text => `<li>${esc(text)}</li>`).join("")}</ul>
          <div class="sg-card-cta">${anchor(plan.link, esc(plan.company) + "の公式サイトへ", "btn btn-outline")}</div>
        </article>`).join("");
  return `
  <section class="sg-section sg-detail-section" id="sg-detail" aria-labelledby="sg-detail-title">
    <div class="container">
      <h2 class="sg-h2" id="sg-detail-title">プラン別の補足<small>比較表だけで決めにくい方へ</small></h2>
      <div class="sg-card-grid">${cards}
      </div>
    </div>
  </section>`;
}

const FAQ = [
  ["サーバーとドメインは、同じ会社で契約しないといけませんか？",
    "いいえ、別々の会社でも使えます。同じ会社にまとめると、契約や請求の管理がかんたんになる場合があります。サーバーの特典でドメインが無料になる会社もあります。"],
  ["ドメインの「初年度0円・1円」は、ずっとその金額ですか？",
    "いいえ。初年度だけの特別価格のことが多く、2年目以降は更新料金がかかります。このページでは、初年度と更新料金を分けて載せています。"],
  ["このページから申し込むと、料金は高くなりますか？",
    "いいえ。紹介リンクから申し込んでも、お客様のお支払い額は変わりません。"],
  ["比較の内容は、いつ時点のものですか？",
    "各社の公式ページで確認した、2026年10月22日時点の内容です。料金やキャンペーンは変わることがあるため、申込み前に必ず公式ページでご確認ください。"],
  ["すでにホームページがあり、管理費を見直したい場合は？",
    "「ホームページ維持費削減・乗り換えプラン」で、現在の契約の確認（診断は0円）から対応しています。サーバーやドメインの選び直しもご相談ください。"]
];

function faqSection() {
  return `
  <section class="sg-section sg-faq-section" id="sg-faq" aria-labelledby="sg-faq-title">
    <div class="container">
      <h2 class="sg-h2" id="sg-faq-title">よくあるご質問</h2>
      <div class="sg-faq">${FAQ.map(([q, a]) => `
        <details class="sg-faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
      </div>
    </div>
  </section>`;
}

const NOTICE = "本ページには広告・紹介リンクが含まれており、当サイトが紹介報酬を受け取る場合があります。掲載情報は各社の公式情報をもとに作成していますが、最新の料金・サービス内容は各公式サイトでご確認ください。";

function noticeSection() {
  return `
  <section class="sg-notice" id="sg-pr" aria-label="広告・ご利用にあたって">
    <div class="container">
      <p class="sg-notice-text">${esc(NOTICE)}</p>
    </div>
  </section>`;
}

function sourcesSection(data) {
  const items = Object.entries(data.sources).map(([key, urls]) => {
    const link = data.links[key];
    return `<li><strong>${esc(link.name)}</strong>：${urls.map(url => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https:\/\//, ""))}</a>`).join("、")}</li>`;
  }).join("");
  return `
  <section class="sg-section sg-sources-section" aria-label="確認した公式ページ">
    <div class="container">
      <details class="sg-sources">
        <summary>確認した公式ページ（${esc(data.checkedAtLabel)}）</summary>
        <ul>${items}</ul>
        <p>料金・機能は、各社の公式ページで確認した内容です。誤りや変更がある場合は、公式ページの内容が優先されます。</p>
      </details>
    </div>
  </section>`;
}

function ctaSection() {
  return `
  <section class="cta-section">
    <div class="container reveal">
      <h2>サーバー・ドメイン選びで<span class="no-break">迷ったら、ご相談ください。</span></h2>
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
    pickSection(data),
    serverTable(data, anchor),
    domainSection(data, anchor),
    supportSection(),
    detailSection(data, anchor),
    faqSection(),
    sourcesSection(data),
    noticeSection(),
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

module.exports = { build, buildMain, buildJsonLd, linkInfo, FAQ, NOTICE, MARK, PAGE_FILE, DATA_FILE };
