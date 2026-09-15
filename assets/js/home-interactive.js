// 福祉ITパートナー｜トップページ専用インタラクション
// 「こんなことでお悩みではありませんか？」「4つの支援」の
// カーソル接近時に、補助イラストがごくわずかに追従する軽量パララックス。
//
// ・prefers-reduced-motion / タッチ端末では実行しない
// ・requestAnimationFrameで間引き、CSSカスタムプロパティの更新のみ行う
//   （レイアウトに影響しないtransformだけで表現するため、負荷は小さい）

document.addEventListener("DOMContentLoaded", function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var noHover = window.matchMedia("(hover: none)").matches;

  if (reduceMotion || noHover) {
    return;
  }

  var zones = document.querySelectorAll(".js-hover-parallax");
  if (!zones.length) {
    return;
  }

  var ticking = false;
  var pendingZone = null;
  var pendingX = 0;
  var pendingY = 0;

  function applyParallax() {
    ticking = false;
    if (!pendingZone) {
      return;
    }
    pendingZone.style.setProperty("--px", pendingX.toFixed(3));
    pendingZone.style.setProperty("--py", pendingY.toFixed(3));
  }

  zones.forEach(function (zone) {
    zone.addEventListener("pointermove", function (e) {
      var rect = zone.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      pendingX = (e.clientX - rect.left) / rect.width - 0.5;
      pendingY = (e.clientY - rect.top) / rect.height - 0.5;
      pendingZone = zone;
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(applyParallax);
      }
    });

    zone.addEventListener("pointerleave", function () {
      zone.style.setProperty("--px", 0);
      zone.style.setProperty("--py", 0);
    });
  });
});
