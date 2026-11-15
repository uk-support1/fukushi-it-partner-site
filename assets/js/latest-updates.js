/* フッターの「お役立ち情報を更新しました」
 * お役立ち情報（data/blog-index.json）とホームページ作成講座（data/course-index.json）の
 * 新しい順の6件を、日付つきでフッターの上に表示する。毎日の公開で、この2つのファイルが
 * 更新されるため、ページ側の書き換えは不要（assets/js/main.js が、この JS を読み込む）。
 * 通信に失敗したときは何も表示しない（ページの表示や操作には影響しない）。 */
(function () {
  "use strict";

  var MAX_ITEMS = 6;
  var script = document.currentScript || document.querySelector('script[src*="latest-updates.js"]');
  var footerBox = document.querySelector(".site-footer .container");
  var body = document.body;
  if (!script || !footerBox || document.querySelector(".latest-updates")) return;
  // 独立型ページ（PHP・Ameba Ownd・補助金活用）には出さない
  if (body.classList.contains("lp-shell") || body.classList.contains("jlp-body")) return;

  var root = new URL("../../", script.src).href; // サイトのルート（blog/ 配下のページでも同じ）

  function load(path, kind) {
    return fetch(root + path, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then(function (list) {
        return (Array.isArray(list) ? list : []).map(function (item) {
          return {
            kind: kind,
            title: String(item.title || ""),
            date: String(item.date || ""),
            url: root + (kind === "course" ? "course/" : "blog/") + item.slug + ".html"
          };
        });
      })
      .catch(function () {
        return [];
      });
  }

  function dot(date) {
    return date.replace(/-/g, ".");
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function validDate(item) {
    return /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.title && item.url;
  }

  function render(items) {
    var section = el("section", "latest-updates");
    section.setAttribute("aria-labelledby", "latest-updates-title");

    var head = el("div", "latest-updates-head");
    var titleBox = el("div", "latest-updates-titlebox");
    titleBox.appendChild(el("span", "latest-updates-badge", "毎日更新"));
    var title = el("h2", "latest-updates-title", "お役立ち情報を更新しました");
    title.id = "latest-updates-title";
    titleBox.appendChild(title);
    head.appendChild(titleBox);

    var latest = el("p", "latest-updates-latest", "最終更新：");
    var time = el("time", null, dot(items[0].date));
    time.setAttribute("datetime", items[0].date);
    latest.appendChild(time);
    head.appendChild(latest);
    section.appendChild(head);

    var list = el("ul", "latest-updates-list");
    items.forEach(function (item) {
      var li = el("li", "latest-updates-item");
      var t = el("time", "latest-updates-time", dot(item.date));
      t.setAttribute("datetime", item.date);
      li.appendChild(t);
      li.appendChild(
        el("span", "latest-updates-kind is-" + item.kind, item.kind === "course" ? "ホームページ作成講座" : "お役立ち情報")
      );
      var a = el("a", "latest-updates-link", item.title);
      a.href = item.url;
      li.appendChild(a);
      list.appendChild(li);
    });
    section.appendChild(list);

    var more = el("p", "latest-updates-more");
    var all = el("a", null, "お役立ち情報をすべて見る →");
    all.href = root + "blog.html";
    var course = el("a", null, "ホームページ作成講座を見る →");
    course.href = root + "course.html";
    more.appendChild(all);
    more.appendChild(course);
    section.appendChild(more);

    footerBox.insertBefore(section, footerBox.firstChild);
  }

  function start() {
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = root + "assets/css/latest-updates.css";
    document.head.appendChild(css);

    Promise.all([load("data/blog-index.json", "blog"), load("data/course-index.json", "course")]).then(function (res) {
      var items = res[0]
        .concat(res[1])
        .filter(validDate)
        .map(function (item, index) {
          item.order = index; // 同じ日付のときは、元の並び（お役立ち情報が先）を保つ
          return item;
        })
        .sort(function (a, b) {
          return a.date < b.date ? 1 : a.date > b.date ? -1 : a.order - b.order;
        })
        .slice(0, MAX_ITEMS);
      if (items.length) render(items);
    });
  }

  // フッターが近づいたときに読み込む（ページの表示を遅らせない）
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(footerBox);
  } else {
    start();
  }
})();
