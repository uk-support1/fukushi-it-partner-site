/* ホームページ維持費削減・乗り換えプラン：費用比較の縦棒グラフを、画面に入ったときに一度だけ伸ばす */
(function () {
  var chart = document.querySelector(".cs-vchart");
  if (!chart) {
    return;
  }

  var grow = function () {
    chart.classList.add("is-grown");
  };

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced || !("IntersectionObserver" in window)) {
    // 動きを減らす設定や古いブラウザでは、最初から完成した状態で表示する
    grow();
    return;
  }

  // JSが動くときだけ「高さ0から」の初期状態にする（JS無効でも棒が見えるようにするため）
  document.documentElement.classList.add("cs-js");

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        grow();
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.45 });

  observer.observe(chart);

  // セーフティネット：何らかの理由で通知が来なくても、数秒後には完成形にする
  window.setTimeout(function () {
    if (!chart.classList.contains("is-grown")) {
      var rect = chart.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        grow();
      }
    }
  }, 6000);
})();
