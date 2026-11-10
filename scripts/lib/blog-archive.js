"use strict";
/*
 * ブログ一覧（blog.html）の「過去の記事をさがす」部分を作る。
 *
 * 一覧の上には最新 BLOG_LATEST_COUNT 本だけをカードで出し、全記事は
 *   ① 月ごとのカレンダー（記事を書いた日に印。日を押すとその日の記事が出る）
 *   ② 月ごとの記事一覧（折りたたみ。JavaScriptがなくても、検索エンジンでも全記事に届く）
 * から探せるようにする。HTMLはすべてここで生成する（Daily Blog・Generate Blogの
 * どちらが blog.html を作り直しても同じ結果になる）。動きは assets/js/blog-archive.js。
 */

const lib = require("./articles");

const BLOG_LATEST_COUNT = 10;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKDAY_NAMES = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseYmd(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

// blogIndex（新しい順）を 月 → 日 → 記事 の順にまとめる。月は新しい月が先。
function groupByMonth(entries) {
  const months = new Map();
  entries.forEach((entry) => {
    const ymd = parseYmd(entry && entry.date);
    if (!ymd) return;
    const monthKey = ymd.y + "-" + pad2(ymd.m);
    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const days = months.get(monthKey);
    if (!days.has(entry.date)) days.set(entry.date, []);
    days.get(entry.date).push(entry);
  });
  return new Map(
    Array.from(months.entries()).sort(function (a, b) {
      return b[0].localeCompare(a[0]);
    })
  );
}

function monthCount(days) {
  let n = 0;
  days.forEach(function (list) {
    n += list.length;
  });
  return n;
}

function monthLabel(monthKey) {
  const parts = monthKey.split("-");
  return parts[0] + "年" + Number(parts[1]) + "月";
}

function dayLabel(dateKey) {
  const ymd = parseYmd(dateKey);
  return ymd.m + "月" + ymd.d + "日";
}

function buildMonthTable(monthKey, days) {
  const parts = monthKey.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const rows = [];
  let cells = [];
  const flush = () => {
    rows.push("            <tr>" + cells.join("") + "</tr>");
    cells = [];
  };
  for (let i = 0; i < firstWeekday; i += 1) cells.push('<td class="cal-blank"></td>');
  for (let d = 1; d <= lastDay; d += 1) {
    const key = monthKey + "-" + pad2(d);
    const posts = days.get(key);
    if (posts && posts.length) {
      cells.push(
        '<td class="cal-has-posts"><a class="cal-day" href="#d-' + key + '" data-date="' + key +
          '" aria-label="' + m + "月" + d + "日（記事" + posts.length + '本）">' + d +
          (posts.length > 1 ? '<span class="cal-count" aria-hidden="true">' + posts.length + "</span>" : "") +
          "</a></td>"
      );
    } else {
      cells.push('<td><span class="cal-day cal-day-empty">' + d + "</span></td>");
    }
    if (cells.length === 7) flush();
  }
  if (cells.length) {
    while (cells.length < 7) cells.push('<td class="cal-blank"></td>');
    flush();
  }

  const head = WEEKDAYS.map(function (w, i) {
    return '<th scope="col" abbr="' + WEEKDAY_NAMES[i] + '">' + w + "</th>";
  }).join("");

  return (
    '        <div class="cal-month" id="cal-' + monthKey + '" data-month="' + monthKey + '">\n' +
    '          <table class="cal-grid">\n' +
    "            <caption>" + monthLabel(monthKey) + "の記事カレンダー</caption>\n" +
    "            <thead><tr>" + head + "</tr></thead>\n" +
    "            <tbody>\n" +
    rows.join("\n") + "\n" +
    "            </tbody>\n" +
    "          </table>\n" +
    "        </div>"
  );
}

function buildArchiveItem(entry, isFirstOfDate) {
  return (
    '            <li class="archive-item" data-date="' + entry.date + '"' +
    (isFirstOfDate ? ' id="d-' + entry.date + '"' : "") + ">" +
    '<span class="archive-date">' + dayLabel(entry.date) + "</span>" +
    '<span class="category-badge">' + lib.escapeHtml(entry.category_label) + "</span>" +
    '<a class="archive-title" href="blog/' + entry.slug + '.html">' + lib.escapeHtml(entry.title) + "</a>" +
    "</li>"
  );
}

function buildMonthList(monthKey, days) {
  const seen = new Set();
  const items = [];
  // 日付の新しい順（同じ日の中は、blog-index の並びのまま）
  Array.from(days.keys())
    .sort(function (a, b) {
      return b.localeCompare(a);
    })
    .forEach(function (dateKey) {
      days.get(dateKey).forEach(function (entry) {
        items.push(buildArchiveItem(entry, !seen.has(dateKey)));
        seen.add(dateKey);
      });
    });
  return (
    '        <details class="archive-month" id="m-' + monthKey + '">\n' +
    "          <summary>" + monthLabel(monthKey) + '<span class="archive-count">' + monthCount(days) + "本</span></summary>\n" +
    '          <ul class="archive-items">\n' +
    items.join("\n") + "\n" +
    "          </ul>\n" +
    "        </details>"
  );
}

function buildBlogArchiveHtml(entries) {
  const months = groupByMonth(entries);
  if (!months.size) return "";
  const keys = Array.from(months.keys());
  const total = keys.reduce(function (sum, key) {
    return sum + monthCount(months.get(key));
  }, 0);

  const options = keys
    .map(function (key) {
      return '            <option value="' + key + '">' + monthLabel(key) + "</option>";
    })
    .join("\n");
  const tables = keys.map(function (key) {
    return buildMonthTable(key, months.get(key));
  }).join("\n");
  const lists = keys.map(function (key) {
    return buildMonthList(key, months.get(key));
  }).join("\n");

  return (
    '  <section class="blog-archive" id="archive" aria-labelledby="archive-title">\n' +
    '    <div class="container">\n' +
    '      <div class="blog-archive-head reveal">\n' +
    '        <span class="section-tag">アーカイブ</span>\n' +
    '        <h2 id="archive-title">過去の記事をさがす</h2>\n' +
    '        <p>記事を書いた日に印がついています。日を押すと、その日の記事が下に出ます。（これまでの記事：全' + total + "本）</p>\n" +
    "      </div>\n" +
    "\n" +
    "      <!-- カレンダー：data/blog-index.jsonの全記事から自動生成（assets/js/blog-archive.jsが月の切り替えと日の選択を担当） -->\n" +
    '      <div class="blog-calendar" data-blog-calendar>\n' +
    '        <div class="cal-nav">\n' +
    '          <button type="button" class="cal-prev" aria-label="前の月へ">‹ 前月</button>\n' +
    '          <label class="visually-hidden" for="cal-select">月をえらぶ</label>\n' +
    '          <select id="cal-select" class="cal-select">\n' +
    options + "\n" +
    "          </select>\n" +
    '          <button type="button" class="cal-next" aria-label="次の月へ">次月 ›</button>\n' +
    "        </div>\n" +
    '        <div class="cal-months">\n' +
    tables + "\n" +
    "        </div>\n" +
    "      </div>\n" +
    "\n" +
    '      <div class="cal-results" data-cal-results aria-live="polite">\n' +
    '        <p class="cal-hint">日を押すと、その日の記事がここに出ます。</p>\n' +
    "      </div>\n" +
    "\n" +
    "      <!-- 月ごとの記事一覧：JavaScriptがなくても全記事にたどり着けるよう、全件をHTMLに残す -->\n" +
    '      <div class="archive-list" id="archive-list">\n' +
    "        <h3>月ごとの記事一覧</h3>\n" +
    lists + "\n" +
    "      </div>\n" +
    "    </div>\n" +
    "  </section>\n"
  );
}

module.exports = {
  BLOG_LATEST_COUNT,
  parseYmd,
  groupByMonth,
  buildMonthTable,
  buildBlogArchiveHtml
};
