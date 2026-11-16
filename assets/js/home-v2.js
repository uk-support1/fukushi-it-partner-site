/* トップページ（刷新案）専用：見出しの手書き風アニメーション・流れる制作実績・サービスの線・右下の相談案内 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 英語の手書き風ラベル：画面に入ったら、左から書かれていくように表示する
  var scripts = document.querySelectorAll(".h2-script");
  if (!reduceMotion && "IntersectionObserver" in window && scripts.length) {
    root.classList.add("h2-js");
    var drawObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-drawn");
          drawObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -12% 0px" });
    scripts.forEach(function (el) {
      drawObserver.observe(el);
    });
    // 念のため、一定時間後にはすべて表示する
    window.setTimeout(function () {
      scripts.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-drawn");
      });
    }, 2500);
  }

  // 横に流れる列：中身を1回複製して、切れ目なくループさせる（複製は読み上げ・Tab移動の対象外）
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
  document.querySelectorAll("[data-marquee-toggle]").forEach(function (toggle) {
    var section = toggle.closest("section");
    toggle.addEventListener("click", function () {
      var paused = section.classList.toggle("is-marquee-paused");
      toggle.setAttribute("aria-pressed", paused ? "true" : "false");
      toggle.querySelector(".h2-pause-text").textContent = paused ? "動かす" : "動きを止める";
    });
  });

  // サービス：スクロールに合わせて「開所前 → 開所後」の線が伸びる
  var timeline = document.querySelector(".h2-timeline");

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

  var header = document.querySelector(".site-header");
  var footer = document.querySelector(".site-footer");
  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    var vh = window.innerHeight;
    if (header) header.classList.toggle("is-scrolled", y > 10);
    if (timeline) {
      var r = timeline.getBoundingClientRect();
      var p = reduceMotion ? 1 : (vh * 0.7 - r.top) / r.height;
      timeline.style.setProperty("--p", Math.max(0, Math.min(1, p)).toFixed(3));
    }
    if (bubble && !bubble.hidden) {
      var nearFooter = footer && footer.getBoundingClientRect().top < vh;
      bubble.classList.toggle("is-shown", y > vh * 0.6 && !nearFooter);
    }
  }
  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
