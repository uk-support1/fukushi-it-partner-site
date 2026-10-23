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
    "search": '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    // ここから下は、PHP更新代行の商品画像（php-update-service/）で追加
    // 元に戻す（反時計回りの矢印）
    "rollback": '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    // バックアップ（保存・ダウンロード）
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    // サーバー
    "server": '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
    // 時計
    "clock": '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    // クリップボード（チェックシート）
    "clipboard": '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><polyline points="9 14 11 16 15 12"/>',
    // 人（臨時アカウント）
    "user": '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    // 鍵（カギ）
    "key": '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    // 重なり（複製・テスト環境）
    "layers": '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    // 矢印（右）
    "arrow-right": '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    // バツ
    "x": '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    // ハート（寄り添う）
    "heart": '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
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
