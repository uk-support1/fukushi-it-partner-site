// 制作実績ページ：くるくる回る3Dカードの輪
(function () {
  "use strict";
  var ring = document.getElementById("w2Ring");
  if (!ring) return;
  var track = ring.querySelector(".w2-ring-track");
  var cards = Array.prototype.slice.call(ring.querySelectorAll(".w2-ring-card"));
  var section = ring.closest("section");
  var controls = section.querySelector(".w2-ring-controls");
  var toggle = controls.querySelector('[data-ring="toggle"]');
  var counter = controls.querySelector(".w2-ring-counter");
  var motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var count = cards.length;
  var step = 360 / count;
  var rotation = 0, frontIndex = -1, userPaused = motion.matches;
  var inView = false, hovering = false, dragging = false, frame = 0, last = 0;
  var radius = 0;

  function cssNum(name) { return parseFloat(getComputedStyle(ring).getPropertyValue(name)); }

  function measure() {
    var size = cssNum("--card-w");
    var gap = cssNum("--card-gap");
    radius = Math.ceil((size + gap) / (2 * Math.sin(Math.PI / Math.max(3, count))));
    var tilt = cssNum("--tilt");
    ring.style.setProperty("--radius", radius + "px");
    ring.style.setProperty("--perspective", Math.max(1100, radius * 2.8) + "px");
    ring.style.setProperty("--orbit-y", (radius * Math.sin(-tilt * Math.PI / 180)) + "px");
    cards.forEach(function (card, i) {
      card.style.transform = "rotateY(" + (i * step) + "deg) translateZ(" + radius + "px)";
    });
  }

  function norm(a) { return ((a + 180) % 360 + 360) % 360 - 180; }

  function render() {
    track.style.setProperty("--rotation", rotation + "deg");
    var best = 0, bestAbs = 999;
    var angles = cards.map(function (c, i) {
      var a = norm(i * step + rotation);
      if (Math.abs(a) < bestAbs) { bestAbs = Math.abs(a); best = i; }
      return a;
    });
    cards.forEach(function (card, i) {
      var depth = (1 - Math.cos(angles[i] * Math.PI / 180)) / 2;
      card.style.setProperty("--depth-opacity", String(1 - depth * 0.3));
      card.style.setProperty("--depth-blur", (depth * 0.6) + "px");
      card.tabIndex = i === best ? 0 : -1;
      card.classList.toggle("is-front", i === best);
    });
    if (best !== frontIndex) {
      frontIndex = best;
      counter.textContent = (best + 1) + " / " + count;
    }
  }

  function tick(time) {
    frame = 0;
    if (!inView || userPaused || hovering || dragging || document.hidden) { last = 0; return; }
    if (last) rotation -= Math.min(time - last, 64) * 360 / 80000;
    last = time;
    render();
    frame = requestAnimationFrame(tick);
  }
  function resume() { if (!frame && inView && !userPaused && !hovering && !dragging && !document.hidden) frame = requestAnimationFrame(tick); }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
  function syncToggle() {
    toggle.textContent = userPaused ? "回転を再開" : "回転を一時停止";
    ring.setAttribute("data-paused", String(userPaused));
  }

  function bringToFront(index) {
    userPaused = true; stop(); syncToggle();
    var a = norm(index * step + rotation);
    track.classList.add("is-snapping");
    rotation -= a;
    render();
    window.setTimeout(function () { track.classList.remove("is-snapping"); }, 700);
  }
  controls.querySelector('[data-ring="prev"]').addEventListener("click", function () { bringToFront((frontIndex - 1 + count) % count); });
  controls.querySelector('[data-ring="next"]').addEventListener("click", function () { bringToFront((frontIndex + 1) % count); });
  toggle.addEventListener("click", function () { userPaused = !userPaused; stop(); syncToggle(); resume(); });

  // 正面以外のカードを押したら、そのカードを正面へ。正面のカードを押すと、実物のサイトが開く
  var moved = 0;
  cards.forEach(function (card, i) {
    card.addEventListener("click", function (e) {
      if (moved > 6) { e.preventDefault(); return; }
      if (i !== frontIndex) { e.preventDefault(); bringToFront(i); }
      else if (!card.getAttribute("data-url")) { e.preventDefault(); }
    });
  });

  // ドラッグで回す
  var startX = 0, startRot = 0;
  ring.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true; moved = 0; startX = e.clientX; startRot = rotation; stop();
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (moved > 6) { ring.classList.add("is-dragging"); rotation = startRot + dx * 0.25; render(); }
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false; ring.classList.remove("is-dragging");
    window.setTimeout(function () { moved = 0; }, 0);
    resume();
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  ring.addEventListener("mouseenter", function () { hovering = true; stop(); });
  ring.addEventListener("mouseleave", function () { hovering = false; resume(); });
  ring.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft") { e.preventDefault(); bringToFront((frontIndex - 1 + count) % count); cards[frontIndex].focus(); }
    if (e.key === "ArrowRight") { e.preventDefault(); bringToFront((frontIndex + 1) % count); cards[frontIndex].focus(); }
  });
  document.addEventListener("visibilitychange", function () { stop(); resume(); });
  motion.addEventListener && motion.addEventListener("change", function () { userPaused = motion.matches; stop(); syncToggle(); resume(); });

  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView) { measure(); render(); resume(); } else stop();
  }, { threshold: 0.05 }).observe(ring);
  if ("ResizeObserver" in window) new ResizeObserver(function () { measure(); render(); }).observe(ring);
  window.addEventListener("resize", function () { measure(); render(); });

  ring.classList.add("is-ready");
  syncToggle(); measure(); render();
})();
