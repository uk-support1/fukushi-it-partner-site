// 代表の理念・想いページ：英語の手書き風ラベルを、画面に入ってから線で書いて塗る
(function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scripts = document.querySelectorAll(".ph-script");
  if (reduceMotion || !scripts.length || !("IntersectionObserver" in window) || !document.fonts) return;

  var SVG_NS = "http://www.w3.org/2000/svg";
  function buildScript(el) {
    var text = el.textContent.trim();
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ph-script-svg");
    svg.setAttribute("aria-hidden", "true");
    var t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", "0");
    t.setAttribute("y", "100");
    t.setAttribute("font-size", "100");
    Array.prototype.forEach.call(text, function (ch, i) {
      var span = document.createElementNS(SVG_NS, "tspan");
      span.textContent = ch;
      span.style.animationDelay = (i * 0.09) + "s, " + (1.2 + i * 0.09) + "s";
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
})();
