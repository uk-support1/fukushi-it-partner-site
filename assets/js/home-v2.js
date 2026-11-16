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

  // 横に流れる列：ゆっくり自動で流れつつ、ドラッグ・スワイプ・左右ボタンで自分でも動かせる
  // 中身を複製して切れ目なくループさせる（複製は読み上げ・Tab移動の対象外）
  document.querySelectorAll("[data-marquee]").forEach(function (marquee) {
    var track = marquee.querySelector(".h2-marquee-track");
    if (!track) return;
    var originals = Array.prototype.slice.call(track.children);
    if (!originals.length) return;
    var unitGuess = track.scrollWidth || 1;
    var screenW = Math.max(window.innerWidth, window.screen ? window.screen.width : 0);
    var sets = Math.max(1, Math.ceil(screenW / unitGuess)) + 1;
    for (var n = 0; n < sets; n++) {
      originals.forEach(function (item) {
        var clone = item.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        clone.querySelectorAll("a, button").forEach(function (el) {
          el.setAttribute("tabindex", "-1");
        });
        clone.querySelectorAll("img").forEach(function (img) {
          img.setAttribute("alt", "");
          img.setAttribute("loading", "eager");
        });
        track.appendChild(clone);
      });
    }
    var firstClone = track.children[originals.length];

    // 1セット分の幅（ここを超えたら同じ見た目の位置へ戻す）
    function unit() {
      return firstClone.offsetLeft - originals[0].offsetLeft || unitGuess;
    }
    var pos = 0;
    var lastSet = 0;
    function apply() {
      var u = unit();
      if (pos >= u) pos -= u;
      if (pos < 0) pos += u;
      marquee.scrollLeft = pos;
      lastSet = marquee.scrollLeft;
    }

    var hovering = false;
    var dragging = false;
    var idleUntil = 0; // 自分で動かしたあと、しばらく自動で流さない
    var anim = null; // ボタンで動かしている最中のアニメーション
    function holdAuto(ms) { idleUntil = Date.now() + ms; }

    marquee.addEventListener("mouseenter", function () { hovering = true; });
    marquee.addEventListener("mouseleave", function () { hovering = false; });

    // 指で横にスワイプしたとき（ブラウザ標準のスクロール）
    marquee.addEventListener("scroll", function () {
      if (Math.abs(marquee.scrollLeft - lastSet) > 2 && !anim) {
        pos = marquee.scrollLeft;
        holdAuto(3000);
        apply();
      }
    }, { passive: true });
    marquee.addEventListener("touchstart", function () { holdAuto(4000); }, { passive: true });

    // マウスでつかんで横にドラッグ
    var startX = 0, startPos = 0, moved = 0;
    marquee.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      dragging = true; moved = 0; anim = null;
      startX = e.clientX; startPos = pos;
      marquee.classList.add("is-dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) e.preventDefault();
      pos = startPos - dx;
      apply();
    });
    window.addEventListener("pointerup", function () {
      if (!dragging) return;
      dragging = false;
      marquee.classList.remove("is-dragging");
      holdAuto(2500);
    });
    // ドラッグしただけのときは、カードのリンクを開かない
    marquee.addEventListener("click", function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; }
    }, true);
    marquee.addEventListener("dragstart", function (e) { e.preventDefault(); });

    // 左右ボタン：カード約1枚分ずつ動かす
    function step() {
      var card = track.querySelector(".h2-wcard");
      return card ? card.getBoundingClientRect().width + 16 : 300;
    }
    function glide(dist) {
      var from = pos, t0 = performance.now(), dur = 450;
      holdAuto(5000);
      anim = function (now) {
        var t = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - t, 3);
        pos = from + dist * e;
        if (t >= 1) anim = null;
      };
    }
    var section = marquee.closest("section");
    if (section) {
      section.querySelectorAll("[data-marquee-prev]").forEach(function (b) {
        b.addEventListener("click", function () { glide(-step()); });
      });
      section.querySelectorAll("[data-marquee-next]").forEach(function (b) {
        b.addEventListener("click", function () { glide(step()); });
      });
    }

    // 自動で流す（動きを控える設定のときは流さない）
    var speed = parseFloat(marquee.getAttribute("data-marquee-speed")) || 90; // 1セットを流しきる秒数
    var prev = performance.now();
    function frame(now) {
      var dt = Math.min(100, now - prev);
      prev = now;
      if (anim) {
        anim(now);
        apply();
      } else if (!reduceMotion && !hovering && !dragging && Date.now() > idleUntil && !marquee.matches(":focus-within")) {
        pos += unit() / speed * dt / 1000;
        apply();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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
