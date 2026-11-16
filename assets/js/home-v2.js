/* トップページ（刷新案）専用：流れる帯・一時停止ボタン・右下の相談案内・ヘッダーの影 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 横に流れる帯：中身を1回複製して、切れ目なくループさせる（複製は読み上げ・Tab移動の対象外）
  document.querySelectorAll("[data-marquee]").forEach(function (marquee) {
    var track = marquee.querySelector(".h2-marquee-track");
    if (!track || reduceMotion) return;
    Array.prototype.slice.call(track.children).forEach(function (item) {
      var clone = item.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("a, button").forEach(function (el) {
        el.setAttribute("tabindex", "-1");
      });
      clone.querySelectorAll("img").forEach(function (img) {
        img.setAttribute("alt", "");
      });
      track.appendChild(clone);
    });
  });

  // 「動きを止める」ボタン
  var toggle = document.querySelector("[data-marquee-toggle]");
  if (toggle) {
    var section = toggle.closest("section");
    toggle.addEventListener("click", function () {
      var paused = section.classList.toggle("is-marquee-paused");
      toggle.setAttribute("aria-pressed", paused ? "true" : "false");
      toggle.querySelector(".h2-pause-text").textContent = paused ? "動かす" : "動きを止める";
    });
  }

  // ヘッダー：少しスクロールしたら影をつける
  var header = document.querySelector(".site-header");
  // 右下の相談案内：ファーストビューを過ぎたら表示。閉じたら、このページを開いている間は出さない
  var bubble = document.querySelector("[data-bubble]");
  var bubbleClosed = false;
  try {
    bubbleClosed = sessionStorage.getItem("h2-bubble-closed") === "1";
  } catch (e) {}

  if (bubble && !bubbleClosed) {
    bubble.hidden = false;
    bubble.querySelector("[data-bubble-close]").addEventListener("click", function () {
      bubble.classList.remove("is-shown");
      bubble.hidden = true;
      try {
        sessionStorage.setItem("h2-bubble-closed", "1");
      } catch (e) {}
    });
  }

  var footer = document.querySelector(".site-footer");
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle("is-scrolled", y > 10);
    if (bubble && !bubble.hidden) {
      var nearFooter = footer && footer.getBoundingClientRect().top < window.innerHeight;
      bubble.classList.toggle("is-shown", y > window.innerHeight * 0.6 && !nearFooter);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
