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
  // background-attachment:fixedは環境により正しく描画されないことがあるため使わず、
  // 縦に大きめの写真のbackground-positionをスクロール量に応じてJSで動かしている。
  var parallaxEls = document.querySelectorAll(".bg-parallax");
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var heroMobileQuery = window.matchMedia("(max-width: 900px)");
  var heroPhotoEl = document.querySelector(".hero-photo.bg-parallax");

  // ヒーロー写真は「完全に静止して見える」ことが目標なので、
  // スクロール量そのものに正比例させて打ち消す専用の計算にする。
  // HERO_OVERSIZE は hero-photoのbackground-size: auto 230% に対応する超過分（2.3 - 1）。
  var HERO_OVERSIZE = 1.3;
  var HERO_REST_POSITION = 45; // スクロール0の時点の表示位置（%）

  // それ以外の写真は「少しだけ遅れて動く」程度に留めたいので、
  // 動く範囲を0〜100%ではなく、要素ごとに指定した狭い範囲に制限する。
  var DEFAULT_MIN = 40;
  var DEFAULT_MAX = 60;

  if (parallaxEls.length && !prefersReducedMotion) {
    var parallaxTicking = false;

    var updateParallax = function () {
      var vh = window.innerHeight;

      if (heroPhotoEl && !heroMobileQuery.matches) {
        var heroRect = heroPhotoEl.getBoundingClientRect();
        var k = (HERO_OVERSIZE * heroRect.height) / 100;
        var heroPos = HERO_REST_POSITION - window.scrollY / k;
        heroPos = Math.min(100, Math.max(0, heroPos));
        heroPhotoEl.style.backgroundPosition = "right " + heroPos.toFixed(1) + "%";
      }

      parallaxEls.forEach(function (el) {
        if (el.classList.contains("hero-photo")) {
          return; // 上で個別に処理済み（モバイルでは何もしない）
        }
        var rect = el.getBoundingClientRect();
        var total = vh + rect.height;
        var progress = Math.min(1, Math.max(0, (vh - rect.top) / total));
        var min = parseFloat(el.dataset.parallaxMin || DEFAULT_MIN);
        var max = parseFloat(el.dataset.parallaxMax || DEFAULT_MAX);
        // progressが大きい（スクロールが進んでいる）ほど値を小さくすることで、
        // 写真がコンテンツより遅れて動くようにする
        var pos = max - progress * (max - min);
        el.style.backgroundPosition = "center " + pos.toFixed(1) + "%";
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
