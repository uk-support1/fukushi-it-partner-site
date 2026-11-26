// プロフィール：手書き風の署名「代表 上原健太」を、画面に入ってから筆で書くように表示する
(function () {
  var el = document.querySelector("[data-sign]");
  if (!el) return;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || !("IntersectionObserver" in window) || !document.fonts) return;

  var SVG_NS = "http://www.w3.org/2000/svg";
  var role = el.querySelector(".profile-sign-role").textContent.trim();
  var name = el.querySelector(".profile-sign-name").textContent.trim();

  document.fonts.load('40px "Yuji Syuku"', role + name).then(function () {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "profile-sign-svg");
    svg.setAttribute("aria-hidden", "true");
    var t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", "0");
    t.setAttribute("y", "100");
    var delay = 0;
    function add(chars, size, gapBefore) {
      Array.prototype.forEach.call(chars, function (ch, i) {
        var span = document.createElementNS(SVG_NS, "tspan");
        span.textContent = ch;
        span.setAttribute("font-size", size);
        if (i === 0 && gapBefore) span.setAttribute("dx", gapBefore);
        span.style.animationDelay = delay + "s, " + (delay + 0.9) + "s";
        delay += 0.28;
        t.appendChild(span);
      });
    }
    add(role, 52, 0);
    delay += 0.2;
    add(name, 100, 36);
    svg.appendChild(t);

    var label = role + " " + name;
    el.setAttribute("aria-label", label);
    el.setAttribute("role", "img");
    Array.prototype.forEach.call(el.children, function (c) { c.style.display = "none"; });
    el.appendChild(svg);
    var box = t.getBBox();
    if (!box.width) {
      svg.remove();
      Array.prototype.forEach.call(el.children, function (c) { c.style.display = ""; });
      return;
    }
    var pad = 8;
    svg.setAttribute("viewBox", (box.x - pad) + " " + (box.y - pad) + " " + (box.width + pad * 2) + " " + (box.height + pad * 2));
    el.classList.add("is-ready");

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          el.classList.add("is-drawn");
          observer.unobserve(el);
        }
      });
    }, { threshold: [0, 0.6, 1], rootMargin: "0px 0px -10% 0px" });
    observer.observe(el);
  });
})();
