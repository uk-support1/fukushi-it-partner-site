/*
 * 「お役立ち講座」専用JS。既存の assets/js/main.js には手を加えず、
 * 講座記事だけで読み込む前提の独立ファイル。
 *
 * 目次のジャンプ自体は通常の <a href="#id"> と、全ページ共通の
 * html { scroll-behavior: smooth; }（style.css）でスムーズスクロールされる。
 * ここでは [MARK] のマーカーを、画面に入ったタイミングで一度だけ
 * 左から右へ伸びるアニメーションで表示する処理のみを行う。
 */
document.addEventListener("DOMContentLoaded", function () {
  var marks = document.querySelectorAll(".course-mark");
  if (!marks.length) return;

  if (!("IntersectionObserver" in window)) {
    marks.forEach(function (el) {
      el.classList.add("is-active");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-active");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  marks.forEach(function (el) {
    observer.observe(el);
  });
});
