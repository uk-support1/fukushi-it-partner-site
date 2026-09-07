// 福祉ITパートナー｜補助金活用支援LP専用ヘッダーのモバイルメニュー開閉
// 公式サイト共通の main.js はそのまま残し、このLP専用のヘッダー構造だけをここで扱う。
document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".jlp-nav-toggle");
  var navLinks = document.querySelector(".jlp-nav-links");

  if (!toggle || !navLinks) return;

  function closeMenu() {
    navLinks.classList.remove("open");
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", function () {
    var isOpen = navLinks.classList.toggle("open");
    toggle.classList.toggle("is-active", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });
});
