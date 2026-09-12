/* Underlines remain visible without JavaScript. Animate once, only offscreen marks. */
(() => {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const marks = document.querySelectorAll('.blog-article .article-marker');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('marker-pending');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.1 });
  for (const mark of marks) {
    if (mark.getBoundingClientRect().top < window.innerHeight) continue;
    mark.classList.add('marker-pending');
    observer.observe(mark);
  }
})();
