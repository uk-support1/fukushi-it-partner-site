// ココナラ商品画像用のアイコン（線画。色は currentColor）。
// Feather Icons（MIT License）の形をもとに、盾・サイト・警告などを同じ線の太さでそろえています。
// 使い方：<svg class="ic" width="56" height="56"><use href="#i-shield-check"/></svg>
// ページの先頭で <script src="icons.js"></script> を読み込むと、非表示のスプライトが挿入されます。
(function () {
  var icons = {
    // 盾＋チェック（確認・安心）
    "shield-check": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    // 盾
    "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    // 警告
    "alert": '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    // サイト（ブラウザの窓）
    "site": '<rect x="2" y="4" width="20" height="16" rx="2.5"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="5.5" y1="6.5" x2="5.51" y2="6.5"/><line x1="8.5" y1="6.5" x2="8.51" y2="6.5"/><line x1="6" y1="13" x2="14" y2="13"/><line x1="6" y1="16.5" x2="11" y2="16.5"/>',
    // 更新（くるくる矢印）
    "update": '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    // チェック（丸）
    "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    // チェック
    "check": '<polyline points="20 6 9 17 4 12"/>',
    // はてな（丸）
    "question": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    // 禁止（丸に斜線）
    "ban": '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
    // 吹き出し（相談）
    "chat": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    // カメラ（画面の写真）
    "camera": '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    // 書類（報告書）
    "doc": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    // 鍵（ログイン情報）
    "lock": '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    // 虫めがね（確認）
    "search": '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'
  };
  var parts = ['<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>'];
  Object.keys(icons).forEach(function (k) {
    // 24px の線画を 64px の箱に拡大。線の太さは 1.5 × (64/24) ≒ 4 に保つ
    parts.push('<symbol id="i-' + k + '" viewBox="0 0 64 64"><g transform="scale(2.6667)" stroke-width="1.5">' + icons[k] + '</g></symbol>');
  });
  parts.push('</defs></svg>');
  function insert() { document.body.insertAdjacentHTML("afterbegin", parts.join("")); }
  if (document.body) insert(); else document.addEventListener("DOMContentLoaded", insert);
})();
