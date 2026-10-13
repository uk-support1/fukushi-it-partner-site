// 福祉ITパートナー｜Google Analytics 4 設定
// 測定IDを変更する場合は、この1行だけ書き換えてください。
window.GA_MEASUREMENT_ID = "G-2NST0QN622";

// ---------------------------------------------------------------
// 管理者自身のアクセスを計測から除外する仕組み
//   除外登録：任意のページのURL末尾に ?analytics=off を付けて開く
//   除外解除：任意のページのURL末尾に ?analytics=on  を付けて開く
// 設定は、このサイトのドメイン専用のファーストパーティCookie
// （fip_analytics_optout）と localStorage の両方に保存します。
// 除外中のブラウザでは、Googleタグ（gtag.js）自体を読み込まないため、
// ページ表示・スクロール・クリック・独自イベントを含め、GA4へ何も送信されません。
// ---------------------------------------------------------------
(function () {
  var ID = window.GA_MEASUREMENT_ID;
  var KEY = "fip_analytics_optout";
  var MAX_AGE = 60 * 60 * 24 * 400; // 400日（ブラウザがCookieに認める上限）
  var SECURE = location.protocol === "https:" ? "; Secure" : "";

  function readCookie() {
    try {
      return document.cookie.split("; ").indexOf(KEY + "=1") !== -1;
    } catch (e) {
      return false;
    }
  }

  function writeCookie() {
    try {
      document.cookie = KEY + "=1; max-age=" + MAX_AGE + "; path=/; SameSite=Lax" + SECURE;
    } catch (e) { /* 保存できなければ、あとで読み戻して判定する */ }
  }

  function removeCookie() {
    try {
      document.cookie = KEY + "=; max-age=0; path=/; SameSite=Lax" + SECURE;
    } catch (e) { /* 同上 */ }
  }

  function readStorage() {
    try {
      return window.localStorage.getItem(KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function writeStorage() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch (e) { /* 同上 */ }
  }

  function removeStorage() {
    try {
      window.localStorage.removeItem(KEY);
    } catch (e) { /* 同上 */ }
  }

  function isOptedOut() {
    return readCookie() || readStorage();
  }

  // URLの ?analytics=... だけを取り除く（ほかのパラメータとハッシュは残す）
  function readParam() {
    var parts = location.search.replace(/^\?/, "").split("&");
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split("=");
      if (kv[0] === "analytics") {
        return kv.slice(1).join("=");
      }
    }
    return null;
  }

  function stripParam() {
    var parts = location.search.replace(/^\?/, "").split("&");
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] !== "" && parts[i].split("=")[0] !== "analytics") {
        kept.push(parts[i]);
      }
    }
    var search = kept.length ? "?" + kept.join("&") : "";
    try {
      window.history.replaceState(window.history.state, "", location.pathname + search + location.hash);
    } catch (e) { /* URLを書き換えられなくても、設定自体には影響しない */ }
  }

  // ---- ?analytics=off / on の処理（Googleタグを読み込む前に実行する） ----
  var notice = null;
  var param = readParam();

  if (param !== null) {
    param = param.toLowerCase();
  }

  if (param === "off") {
    writeCookie();
    writeStorage();
    // 実際に読み戻せたときだけ「成功」とする
    notice = isOptedOut()
      ? { ok: true, text: "このブラウザはアクセス解析から除外されました" }
      : { ok: false, text: "除外設定を保存できませんでした。ブラウザのCookie・サイトデータの設定をご確認ください" };
    stripParam();
  } else if (param === "on") {
    removeCookie();
    removeStorage();
    notice = !isOptedOut()
      ? { ok: true, text: "アクセス解析の除外設定を解除しました" }
      : { ok: false, text: "除外設定を解除できませんでした。ブラウザのCookie・サイトデータの設定をご確認ください" };
    stripParam();
  } else if (isOptedOut()) {
    // 片方だけ消えていた場合に復元し、保存期間も延ばす
    writeCookie();
    writeStorage();
  }

  var optedOut = isOptedOut();

  // GA4の公式の無効化フラグ。念のため、Googleタグを読み込まない場合も設定しておく
  window["ga-disable-" + ID] = optedOut;

  window.dataLayer = window.dataLayer || [];

  if (optedOut) {
    // 除外中：Googleタグを読み込まず、gtag() を何もしない関数にする
    // （main.js のボタンクリック計測などが呼んでも、通信は一切発生しない）
    window.gtag = function () {};
  } else {
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
    document.head.appendChild(script);

    window.gtag = function () {
      window.dataLayer.push(arguments);
    };

    window.gtag("js", new Date());
    window.gtag("config", ID);
  }

  // ---- 設定結果の表示（数秒で消える控えめな通知） ----
  function showNotice() {
    if (!notice || !document.body) {
      return;
    }
    var el = document.createElement("div");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = notice.text;
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "z-index:2147483000",
      "max-width:calc(100vw - 32px)",
      "padding:12px 22px",
      "border-radius:999px",
      "font:500 14px/1.6 'Noto Sans JP','Hiragino Kaku Gothic ProN',Meiryo,sans-serif",
      "text-align:center",
      "color:#fff",
      "background:" + (notice.ok ? "rgba(31,77,60,0.96)" : "rgba(180,83,31,0.96)"),
      "box-shadow:0 8px 24px rgba(0,0,0,0.2)",
      "pointer-events:none",
      "opacity:0",
      "transform:translate(-50%,8px)",
      "transition:opacity .3s ease,transform .3s ease"
    ].join(";");
    document.body.appendChild(el);

    window.setTimeout(function () {
      el.style.opacity = "1";
      el.style.transform = "translate(-50%,0)";
    }, 30);
    window.setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translate(-50%,8px)";
    }, notice.ok ? 4500 : 8000);
    window.setTimeout(function () {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, notice.ok ? 5000 : 8500);
  }

  if (notice) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showNotice);
    } else {
      showNotice();
    }
  }
})();
