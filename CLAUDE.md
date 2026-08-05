# 福祉ITパートナー ブランドサイト — Claude 作業ガイド

## 作業対象

- **対象フォルダ：** `C:\Users\kenta\Desktop\ホームページ\fukushi-it-partner-site`
- **GitHubリポジトリ：** `https://github.com/uk-support1/fukushi-it-partner-site.git`
- **公開URL：** `https://fukushi-it-partner.com/`
- **ブランチ：** `main`

---

## この CLAUDE.md が有効になる条件

この CLAUDE.md は、**`fukushi-it-partner-site` フォルダを作業ディレクトリとして開いている場合**に Claude が参照するファイルです。

- 別プロジェクトのフォルダ（例：`yasuragi-no-kai-site`）を作業ディレクトリとして開いている場合は、そちらの CLAUDE.md が優先される可能性があります。この CLAUDE.md のルールが自動的に適用されるとは限りません。
- そのため、**作業前には必ず CWD と `git remote` を確認**してください。
- CWD が `fukushi-it-partner-site` でない場合は、以下の絶対パスに切り替えてから作業してください：
  ```
  C:\Users\kenta\Desktop\ホームページ\fukushi-it-partner-site
  ```

---

## 絶対に守るルール

### 別プロジェクトを編集しない

- `yasuragi-no-kai-site`（`C:\Users\kenta\Desktop\ホームページ\yasuragi-no-kai-site`）は**別プロジェクト**です。
- `yasuragi-no-kai-site` のファイルを**絶対に編集・commit・pushしない**こと。
- やむを得ず CWD が `yasuragi-no-kai-site` の状態で作業する場合は、すべての操作を `fukushi-it-partner-site` への明示的な絶対パスで行い、commit/push 前に変更ファイルを必ず確認する。

### 作業前の確認（毎回）

作業を開始する前に以下を確認する：

```powershell
# 1. git remote が正しいか確認
git -C "C:\Users\kenta\Desktop\ホームページ\fukushi-it-partner-site" remote -v
```

- `origin` が `https://github.com/uk-support1/fukushi-it-partner-site.git` であることを確認する。
- **異なる場合は作業を停止し、ユーザーに報告する。**

### commit / push 前の確認

```powershell
# 変更ファイルをすべて確認する
git -C "C:\Users\kenta\Desktop\ホームページ\fukushi-it-partner-site" diff --name-only HEAD
git -C "C:\Users\kenta\Desktop\ホームページ\fukushi-it-partner-site" status
```

- 変更ファイルがすべて `fukushi-it-partner-site` 内であることを確認してから commit・push する。
- `yasuragi-no-kai-site` 内のファイルが含まれていた場合は**即座に停止**してユーザーに報告する。

### 判断に迷う場合

- ファイルの削除・上書き・構造変更・push など、元に戻しにくい操作は**事前にユーザーへ確認**する。
- 「おそらく大丈夫」という推測で進めない。

---

## プロジェクト構成

```
fukushi-it-partner-site/
├── index.html          # トップページ
├── services.html       # サービス
├── works.html          # 制作実績
├── blog.html           # ブログ一覧
├── profile.html        # プロフィール
├── contact.html        # お問い合わせ
├── privacy.html        # プライバシーポリシー
├── favicon.ico         # ファビコン（ルートに必須）
├── site.webmanifest    # PWAマニフェスト
├── blog/               # ブログ記事（個別HTML）
├── assets/
│   ├── css/style.css   # 全ページ共通スタイル
│   ├── js/main.js      # 共通JS（IntersectionObserver, モーダル等）
│   ├── js/ga4.js       # Google Analytics
│   └── images/
│       ├── blog/       # ブログ記事用画像（JPEG, 1200×675）
│       ├── works/      # 制作実績用画像
│       ├── logo.png            # ロゴ（600×600）
│       ├── logo-mark.png       # ロゴマーク（256×256、ヘッダー用）
│       ├── favicon.png         # ファビコン元画像（256×256）
│       ├── favicon-32x32.png
│       ├── favicon-16x16.png
│       ├── apple-touch-icon.png        # 180×180
│       ├── android-chrome-192x192.png
│       └── android-chrome-512x512.png
```

---

## デザイン方針

- **カラー（CSS変数）：**
  - `--green-900` `--green-700` `--green-100`：メインカラー（深緑系）
  - `--orange-500`：アクセントカラー
  - `--cream-100` `--white`：背景・カード
- **フォント：** Noto Sans JP（400 / 500 / 700 / 800）
- **角丸・影：** `--radius-md` `--radius-lg` `--shadow-soft` を使う
- **スクロールアニメ：** `.reveal` クラス + `.is-visible`（IntersectionObserver、threshold:0）
- **モーダル：** `.modal-overlay` + `.is-open`、`data-modal-open` 属性でトリガー
- **画像比率：** ブログサムネ 16:9、制作実績カード 3:2（`aspect-ratio` + `object-fit:cover`）
- 新しいUIパターンを追加する場合は既存の CSS 変数・クラス構造に従う。

## 文章方針

- 対象読者は福祉事業所・団体の職員・運営者（IT初心者を含む）。
- 専門用語は避け、平易でやさしい表現を使う。
- 「福祉の現場に寄り添う」「安心を届ける」というトーンを維持する。
- クライアント（やすらぎの会など）を取り上げる際は、課題・欠点を強調せず、**ご相談・ご要望**という表現にとどめる。

---

## 作業後の報告ルール

作業が完了したら以下を報告する：

1. **変更したファイル**（パスを列挙）
2. **commit ハッシュ**（push した場合）
3. **確認が必要な点**（ブラウザでの目視確認が必要な場合は明示する）
4. 判断に迷った点・保留にした点があれば報告する

---

## 技術メモ

- GitHub Pages のサブパス（`/fukushi-it-partner-site/`）のため、ルートの `favicon.ico` への相対パスに注意。
  - トップページ HTML では `href="favicon.ico"`
  - `blog/` 配下の HTML では `href="../favicon.ico"`
- `blog/写真/` フォルダ（ソース画像）は `.gitignore` で除外済み。コミット対象は `assets/images/blog/` 内の最適化済み JPEG のみ。
- GA4 測定 ID は `assets/js/ga4.js` で管理。HTML には埋め込まない。
