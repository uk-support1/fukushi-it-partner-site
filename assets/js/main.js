// 福祉ITパートナー｜main.js

// ===== サイト共通設定 =====
// ココナラのプロフィールURL・Googleフォームの埋め込みURLが決まったら、
// この2箇所だけ書き換えれば全ページに反映されます。
var SITE_CONFIG = {
  coconalaUrl: "https://coconala.com/services/4285270",
  // 無料相談フォーム（Googleフォーム）のURL。別タブで開くボタンのリンク先になります。
  googleFormUrl: "https://forms.gle/3rC6CovbkbumCqgr9"
};

document.addEventListener("DOMContentLoaded", function () {
  // ココナラリンクの一括反映
  document.querySelectorAll(".js-coconala-link").forEach(function (link) {
    link.setAttribute("href", SITE_CONFIG.coconalaUrl);
  });

  // 無料相談フォーム（Googleフォーム）を別タブで開くリンクの一括反映
  document.querySelectorAll(".js-google-form-link").forEach(function (link) {
    link.setAttribute("href", SITE_CONFIG.googleFormUrl);
  });

  // GA4イベント送信（ココナラ・無料相談ボタンのクリック計測）
  function sendGaEvent(eventName) {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName);
    }
  }

  document.querySelectorAll(".js-coconala-link").forEach(function (link) {
    link.addEventListener("click", function () {
      sendGaEvent("coconala_click");
    });
  });

  document.querySelectorAll(".js-consult-link").forEach(function (link) {
    link.addEventListener("click", function () {
      sendGaEvent("free_consultation_click");
    });
  });

  // お問い合わせフォーム（Formspree）の送信処理
  var contactForm = document.getElementById("contact-form");

  if (contactForm) {
    var contactSubmitBtn = contactForm.querySelector(".contact-form-submit");
    var contactErrorEl = document.getElementById("contact-form-error");
    var contactSuccessEl = document.getElementById("contact-form-success");

    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      if (contactErrorEl) {
        contactErrorEl.hidden = true;
      }
      if (contactSubmitBtn) {
        contactSubmitBtn.disabled = true;
        contactSubmitBtn.textContent = "送信中…";
      }

      fetch(contactForm.action, {
        method: "POST",
        body: new FormData(contactForm),
        headers: { Accept: "application/json" }
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("送信に失敗しました");
          }
          contactForm.hidden = true;
          if (contactSuccessEl) {
            contactSuccessEl.hidden = false;
          }
        })
        .catch(function () {
          if (contactErrorEl) {
            contactErrorEl.hidden = false;
          }
          if (contactSubmitBtn) {
            contactSubmitBtn.disabled = false;
            contactSubmitBtn.textContent = "送信する";
          }
        });
    });
  }

  // モバイルナビ開閉
  var toggle = document.querySelector(".nav-toggle");
  var navLinks = document.querySelector(".nav-links");

  if (toggle && navLinks) {
    var setNavOpen = function (isOpen) {
      navLinks.classList.toggle("open", isOpen);
      toggle.classList.toggle("is-active", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
    };

    toggle.addEventListener("click", function () {
      setNavOpen(!navLinks.classList.contains("open"));
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setNavOpen(false);
      });
    });
  }

  // 制作実績の詳細モーダル開閉
  document.querySelectorAll("[data-modal-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var modal = document.getElementById(btn.getAttribute("data-modal-open"));
      if (modal) {
        modal.classList.add("is-open");
        document.body.style.overflow = "hidden";
      }
    });
  });

  function closeModal(modal) {
    modal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-modal]").forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
    var closeBtn = modal.querySelector("[data-modal-close]");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeModal(modal);
      });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.is-open").forEach(function (el) {
        closeModal(el);
      });
    }
  });

  // スクロールでふわっと表示
  var revealEls = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });

    // 本文が長い記事など、何らかの理由でintersectionが発生しない場合の
    // セーフティネット。一定時間後にまだ非表示のreveal要素を強制的に表示する。
    setTimeout(function () {
      revealEls.forEach(function (el) {
        el.classList.add("is-visible");
      });
    }, 8000);
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  // 制作の流れ：Stickyカードスタック
  // パネル自体はCSSのposition: stickyで重なっていく。ここでは、次のパネルが
  // 重なってくる割合に応じて、下になったパネルを少し縮小・暗くして奥行きを出す。
  var stackCards = document.querySelectorAll(".flow-steps .flow-step");

  if (stackCards.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var stackTicking = false;

    var updateStack = function () {
      for (var i = 0; i < stackCards.length - 1; i++) {
        var cur = stackCards[i].getBoundingClientRect();
        var next = stackCards[i + 1].getBoundingClientRect();
        // 次のパネルの上端が、今のパネルの上端からパネル1枚分の距離→重なりきるまでを0→1にする
        var progress = 1 - (next.top - cur.top) / cur.height;
        progress = Math.max(0, Math.min(1, progress));
        stackCards[i].style.transform = progress > 0 ? "scale(" + (1 - progress * 0.05).toFixed(4) + ")" : "";
        stackCards[i].style.setProperty("--stack-dim", (progress * 0.25).toFixed(3));
      }
      stackTicking = false;
    };

    var onStackScroll = function () {
      if (!stackTicking) {
        window.requestAnimationFrame(updateStack);
        stackTicking = true;
      }
    };

    window.addEventListener("scroll", onStackScroll, { passive: true });
    window.addEventListener("resize", onStackScroll);
    updateStack();
  }

  // 写真パララックス（写真だけがコンテンツよりゆっくり動く演出）
  // 写真レイヤー（.bg-parallax）は親の枠より上下に大きく作ってあり、
  // transform: translateY()（GPU合成のみで再描画なし）で枠の中を動かす。
  // ・通常の写真：枠が画面中央にあるとき0、そこからのずれ×factorだけ逆方向に動かす
  // ・ヒーロー写真：スクロール量×factorだけ動かす（factor=1で静止して見える）
  // どちらも、写真のはみ出し幅を超えて動かすと枠の中に隙間ができるため上限を設ける。
  var parallaxEls = document.querySelectorAll(".bg-parallax");
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var heroDesktopQuery = window.matchMedia("(min-width: 901px)");
  var DEFAULT_FACTOR = 0.2;

  if (parallaxEls.length && !prefersReducedMotion) {
    var parallaxTicking = false;

    var updateParallax = function () {
      var vh = window.innerHeight;
      parallaxEls.forEach(function (el) {
        var isHero = el.classList.contains("hero-photo");
        // PC幅ではheroごとposition:fixedで固定しているため、ヒーロー写真はJSでは動かさない。
        // リサイズでモバイル→PCに切り替わった際に古いtransformが残らないようリセットする。
        if (isHero && heroDesktopQuery.matches) {
          if (el.style.transform) {
            el.style.transform = "";
          }
          return;
        }
        var container = el.parentElement;
        var rect = container.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) {
          return;
        }
        var factor = parseFloat(el.dataset.parallaxFactor || DEFAULT_FACTOR);
        var rest = parseFloat(el.dataset.parallaxRest || 0);
        var maxShift = Math.max(0, (el.offsetHeight - container.offsetHeight) / 2);
        var shift = isHero
          ? factor * window.scrollY
          : factor * (vh / 2 - (rect.top + rect.height / 2));
        shift = Math.max(-maxShift, Math.min(maxShift, shift + rest));
        el.style.transform = "translate3d(0, " + shift.toFixed(1) + "px, 0)";
      });
      parallaxTicking = false;
    };

    var onParallaxScroll = function () {
      if (!parallaxTicking) {
        window.requestAnimationFrame(updateParallax);
        parallaxTicking = true;
      }
    };

    window.addEventListener("scroll", onParallaxScroll, { passive: true });
    window.addEventListener("resize", onParallaxScroll);
    updateParallax();
  }
});
