/* トップページ（刷新案）専用：見出しの手書き風アニメーション・流れる制作実績・サービスの線・右下の相談案内 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 英語の手書き風ラベル：スクロールして画面にしっかり入ってから、1文字ずつ線で書いて塗る
  var scripts = document.querySelectorAll(".h2-script");
  var SVG_NS = "http://www.w3.org/2000/svg";
  function buildScript(el) {
    var text = el.textContent.trim();
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "h2-script-svg");
    svg.setAttribute("aria-hidden", "true");
    var t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", "0");
    t.setAttribute("y", "100");
    t.setAttribute("font-size", "100");
    Array.prototype.forEach.call(text, function (ch, i) {
      var span = document.createElementNS(SVG_NS, "tspan");
      span.textContent = ch;
      span.style.animationDelay = (i * 0.11) + "s, " + (1.2 + i * 0.11) + "s";
      t.appendChild(span);
    });
    svg.appendChild(t);
    el.textContent = "";
    el.appendChild(svg);
    var box = t.getBBox();
    if (!box.width) return false;
    var pad = 6;
    svg.setAttribute("viewBox", (box.x - pad) + " " + (box.y - pad) + " " + (box.width + pad * 2) + " " + (box.height + pad * 2));
    svg.style.width = ((box.width + pad * 2) / 100) + "em";
    svg.style.height = ((box.height + pad * 2) / 100) + "em";
    return true;
  }
  if (!reduceMotion && "IntersectionObserver" in window && scripts.length && document.fonts) {
    document.fonts.load("600 40px Caveat").then(function () {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            entry.target.classList.add("is-drawn");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: [0, 0.6, 1], rootMargin: "0px 0px -15% 0px" });
      scripts.forEach(function (el) {
        var original = el.textContent;
        if (buildScript(el)) {
          observer.observe(el);
        } else {
          el.textContent = original;
        }
      });
    });
  }

  // 横に流れる列：中身を1回複製して、切れ目なくループさせる（複製は読み上げ・Tab移動の対象外）
  document.querySelectorAll("[data-marquee]").forEach(function (marquee) {
    var track = marquee.querySelector(".h2-marquee-track");
    if (!track || reduceMotion) return;
    var originals = Array.prototype.slice.call(track.children);
    // 画面が広くても切れ目が出ないよう、列の幅が画面幅以上になるまで複製する（2の倍数のセットになるようにする）
    var unit = track.scrollWidth || 1;
    var screenW = Math.max(window.innerWidth, window.screen ? window.screen.width : 0);
    var sets = Math.max(1, Math.ceil(screenW / unit)) * 2 - 1;
    for (var n = 0; n < sets; n++) {
      originals.forEach(function (item) {
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
    }
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
