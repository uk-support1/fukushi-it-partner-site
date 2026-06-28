// 福祉ITパートナー｜Google Analytics 4 設定
// 測定IDを変更する場合は、この1行だけ書き換えてください。
window.GA_MEASUREMENT_ID = "G-2NST0QN622";

(function () {
  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + window.GA_MEASUREMENT_ID;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag("js", new Date());
  gtag("config", window.GA_MEASUREMENT_ID);
})();
