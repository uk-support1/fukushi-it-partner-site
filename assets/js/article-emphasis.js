/* Underlines remain visible without JavaScript. Animate once, only offscreen marks.
   Marks that wrap across multiple visual lines are split so each line draws in turn. */
(() => {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const DRAW_SPEED = 432; // px per second, so long and short lines draw at the same pace
  const MIN_DURATION = 0.3; // seconds; floor so very short lines still read as an animation

  function durationFor(el) {
    return Math.max(el.getBoundingClientRect().width / DRAW_SPEED, MIN_DURATION);
  }

  function splitByLine(mark) {
    const textNode = mark.firstChild;
    if (!textNode || mark.childNodes.length !== 1 || textNode.nodeType !== Node.TEXT_NODE) return null;
    const text = textNode.textContent;
    if (!text) return null;

    const range = document.createRange();
    const breaks = [];
    let lastTop = null;
    for (let i = 0; i < text.length; i++) {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) continue;
      if (lastTop === null) {
        lastTop = rect.top;
      } else if (rect.top > lastTop + 1) {
        breaks.push(i);
        lastTop = rect.top;
      }
    }
    if (!breaks.length) return null;

    const lines = [];
    let start = 0;
    for (const b of breaks) {
      lines.push(text.slice(start, b));
      start = b;
    }
    lines.push(text.slice(start));

    const frag = document.createDocumentFragment();
    const spans = lines.map(line => {
      const span = document.createElement('span');
      span.className = 'article-marker marker-pending';
      span.textContent = line;
      frag.appendChild(span);
      return span;
    });

    mark.replaceWith(frag);
    return spans;
  }

  // Give each line a draw duration proportional to its own width, and start
  // it only once the previous line in the same mark has finished drawing.
  function paceGroup(spans) {
    let cumulative = 0;
    for (const span of spans) {
      const duration = durationFor(span);
      span.style.setProperty('--marker-delay', cumulative + 's');
      span.style.setProperty('--marker-duration', duration + 's');
      cumulative += duration;
    }
    return cumulative;
  }

  const groupByTrigger = new Map();
  const groupDuration = new Map();
  const marks = document.querySelectorAll('.blog-article .article-marker');
  for (const mark of marks) {
    if (mark.getBoundingClientRect().top < window.innerHeight) continue;
    const spans = splitByLine(mark) || (mark.classList.add('marker-pending'), [mark]);
    const total = paceGroup(spans);
    groupByTrigger.set(spans[0], spans);
    groupDuration.set(spans[0], total);
  }

  if (!groupByTrigger.size) return;

  // Marks close together on screen can all enter the viewport at once; queue
  // them so each one finishes drawing before the next one starts, with a
  // short pause in between.
  const GROUP_GAP = 500; // ms
  let nextReadyAt = 0;
  function activate(group, duration) {
    const now = performance.now();
    const startAt = Math.max(now, nextReadyAt);
    nextReadyAt = startAt + duration + GROUP_GAP;
    const wait = startAt - now;
    const reveal = () => { for (const el of group) el.classList.remove('marker-pending'); };
    if (wait > 0) setTimeout(reveal, wait); else reveal();
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    for (const entry of visible) {
      const group = groupByTrigger.get(entry.target);
      if (group) activate(group, groupDuration.get(entry.target) * 1000);
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.1 });

  for (const trigger of groupByTrigger.keys()) {
    observer.observe(trigger);
  }
})();
