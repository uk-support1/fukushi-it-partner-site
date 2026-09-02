/*
 * GitHub Actions（.github/workflows/generate-news-index.yml）が
 * content/news/*.md から自動生成する data/news-index.json を読み込み、
 * トップページの「お知らせ」セクションに新しい順で最大3件表示する。
 *
 * data/news-index.json はすでに published:true の記事だけ・Markdown除去済みの
 * 抜粋を含む形で生成されているため、ここではソート・件数制限・表示のみを行う。
 * ブラウザからGitHub API・raw.githubusercontent.comへは一切アクセスしない。
 *
 * 取得・解析に失敗した場合、または記事が0件の場合は、
 * 「お知らせ」セクションを表示しない（既存デザインに影響を与えない）。
 */
(function () {
  var DATA_URL = "data/news-index.json";
  var MAX_ITEMS = 3;

  var section = document.getElementById("news-section");
  var listEl = document.getElementById("news-list");
  if (!section || !listEl) return;

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, function (c) {
      return (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ||
        c
      );
    });
  }

  function formatDate(d) {
    var parts = String(d || "").split("-");
    return parts.length === 3 ? parts.join(".") : String(d || "");
  }

  function render(articles) {
    listEl.innerHTML = "";
    articles.forEach(function (a) {
      var item = document.createElement("div");
      item.className = "blog-list-item";

      var thumbHtml = "";
      if (a.image) {
        thumbHtml =
          '<div class="blog-list-thumb"><img src="' +
          escapeHtml(a.image) +
          '" alt="' +
          escapeHtml(a.title) +
          '" loading="lazy"></div>';
      }

      item.innerHTML =
        thumbHtml +
        '<div class="blog-list-body">' +
        '<div class="meta-row"><span class="blog-date">' +
        escapeHtml(formatDate(a.date)) +
        "</span></div>" +
        "<h3>" +
        escapeHtml(a.title) +
        "</h3>" +
        '<p class="excerpt">' +
        escapeHtml(a.excerpt) +
        "</p>" +
        "</div>";

      listEl.appendChild(item);
    });

    section.style.display = "";
  }

  fetch(DATA_URL + "?_=" + Date.now(), { cache: "no-store" })
    .then(function (res) {
      return res.ok ? res.json() : Promise.reject();
    })
    .then(function (articles) {
      var items = (Array.isArray(articles) ? articles : [])
        .filter(function (a) {
          return a && a.title && a.date;
        })
        .sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        })
        .slice(0, MAX_ITEMS);

      if (items.length > 0) {
        render(items);
      }
    })
    .catch(function () {
      /* 取得・解析に失敗した場合は「お知らせ」セクションを表示しない */
    });
})();
