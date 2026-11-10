/* ブログ一覧：「過去の記事をさがす」カレンダーの動き
 * HTMLは scripts/lib/blog-archive.js が作る。このファイルは、月の切り替えと、日を押したときに
 * その日の記事を表示する動きだけを足す（JavaScriptがなくても、月ごとの一覧から全記事に行ける）。 */
(function () {
  "use strict";

  var root = document.querySelector("[data-blog-calendar]");
  var results = document.querySelector("[data-cal-results]");
  var list = document.getElementById("archive-list");
  if (!root || !results || !list) return;

  var months = Array.prototype.slice.call(root.querySelectorAll(".cal-month"));
  var select = root.querySelector(".cal-select");
  var prev = root.querySelector(".cal-prev");
  var next = root.querySelector(".cal-next");
  if (!months.length || !select || !prev || !next) return;

  // 並びは新しい月が先（0番目が最新の月）
  var keys = months.map(function (m) {
    return m.getAttribute("data-month");
  });
  var current = 0;
  var hintHtml = results.innerHTML;

  root.classList.add("is-enhanced");

  function clearResults() {
    results.innerHTML = hintHtml;
    var selected = root.querySelectorAll("a.cal-day.is-selected");
    Array.prototype.forEach.call(selected, function (a) {
      a.classList.remove("is-selected");
      a.removeAttribute("aria-current");
    });
  }

  function showMonth(index, keepResults) {
    if (index < 0 || index >= months.length) return;
    current = index;
    months.forEach(function (m, i) {
      m.classList.toggle("is-active", i === index);
    });
    select.value = keys[index];
    prev.disabled = index >= months.length - 1; // 「前の月」は、より古い月
    next.disabled = index <= 0; // 「次の月」は、より新しい月
    if (!keepResults) clearResults();
  }

  function labelOf(dateKey) {
    var p = dateKey.split("-");
    return Number(p[1]) + "月" + Number(p[2]) + "日";
  }

  function showDay(link) {
    var date = link.getAttribute("data-date");
    var items = list.querySelectorAll('.archive-item[data-date="' + date + '"]');
    clearResults();
    link.classList.add("is-selected");
    link.setAttribute("aria-current", "date");

    var heading = document.createElement("h3");
    heading.textContent = labelOf(date) + "の記事（" + items.length + "本）";
    var ul = document.createElement("ul");
    ul.className = "archive-items";
    Array.prototype.forEach.call(items, function (item) {
      var copy = item.cloneNode(true);
      copy.removeAttribute("id"); // 一覧側のidと重複させない
      ul.appendChild(copy);
    });
    results.innerHTML = "";
    results.appendChild(heading);
    results.appendChild(ul);
  }

  root.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest("a.cal-day[data-date]") : null;
    if (!link || !root.contains(link)) return;
    event.preventDefault();
    showDay(link);
  });

  prev.addEventListener("click", function () {
    showMonth(current + 1);
  });
  next.addEventListener("click", function () {
    showMonth(current - 1);
  });
  select.addEventListener("change", function () {
    var index = keys.indexOf(select.value);
    if (index >= 0) showMonth(index);
  });

  // 共有されたURL（#d-2026-10-27 や #m-2026-10）で開いたときは、その月・その日を表示する
  var start = 0;
  var startDay = null;
  var hash = window.location.hash || "";
  var dayMatch = /^#d-(\d{4}-\d{2})-(\d{2})$/.exec(hash);
  var monthMatch = /^#m-(\d{4}-\d{2})$/.exec(hash);
  if (dayMatch && keys.indexOf(dayMatch[1]) >= 0) {
    start = keys.indexOf(dayMatch[1]);
    startDay = dayMatch[1] + "-" + dayMatch[2];
  } else if (monthMatch && keys.indexOf(monthMatch[1]) >= 0) {
    start = keys.indexOf(monthMatch[1]);
  }
  showMonth(start);
  if (startDay) {
    var startLink = root.querySelector('a.cal-day[data-date="' + startDay + '"]');
    if (startLink) showDay(startLink);
  }
})();
