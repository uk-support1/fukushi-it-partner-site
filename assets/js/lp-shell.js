// 福祉ITパートナー｜独立型ページ（lp-shell.css）の専用ヘッダー：モバイルメニューの開閉
// 共通の main.js はそのまま残し、専用ヘッダーの構造（.lp-nav-toggle / .lp-nav-links）だけをここで扱う。
document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".lp-nav-toggle");
  var navLinks = document.querySelector(".lp-nav-links");

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

  // Escキーでも閉じられるようにする
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });
});
