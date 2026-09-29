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
    toggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
      toggle.classList.toggle("is-active");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
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

  // 写真パララックス（写真だけがコンテンツよりゆっくり動く演出）
  // background-position（要再描画）ではなくtransform: translateY()（GPU合成のみ、
  // 再描画なし）を使うことで、スクロール時になめらかに動くようにしている。
  // 各要素は自分の親（overflow:hiddenでクリップする箱）の位置を基準に、
  // 「親の移動量 × data-parallax-factor」だけ逆方向に動いて、コンテンツより
  // 遅れて（factor=1なら完全に静止して）見えるようにする。
  var parallaxEls = document.querySelectorAll(".bg-parallax");
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var heroDesktopQuery = window.matchMedia("(min-width: 901px)");
  var DEFAULT_FACTOR = 0.2;

  if (parallaxEls.length && !prefersReducedMotion) {
    var parallaxTicking = false;

    var updateParallax = function () {
      parallaxEls.forEach(function (el) {
        // PC幅ではheroごとposition:stickyで固定しているため、
        // ヒーロー写真はJSでは動かさない（二重に動いてしまうのを防ぐ）。
        // リサイズでモバイル→PCに切り替わった際に古いtransformが
        // 残らないよう、念のためリセットしておく。
        if (el.classList.contains("hero-photo") && heroDesktopQuery.matches) {
          if (el.style.transform) {
            el.style.transform = "";
          }
          return;
        }
        var container = el.parentElement;
        var rect = container.getBoundingClientRect();
        var factor = parseFloat(el.dataset.parallaxFactor || DEFAULT_FACTOR);
        var rest = parseFloat(el.dataset.parallaxRest || 0);
        var translateY = rest - factor * rect.top;
        el.style.transform = "translateY(" + translateY.toFixed(1) + "px)";
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
