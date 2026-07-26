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
    }, 1500);
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
});
