# marketing/ — 営業・販促の企画資料

福祉ITパートナーの営業・販促に使う資料を、サイト本体と同じリポジトリで管理するためのフォルダです。
**ここにあるファイルは、ホームページとしては公開されません**（下の「公開されないことの確認」参照）。

```
marketing/
├── README.md          # このファイル
├── coconala/          # ココナラ商品の企画・説明文・商品画像
└── youtube/           # ショート動画の企画・台本（今後追加）
```

| フォルダ | 内容 | 状況 |
| --- | --- | --- |
| [coconala/](coconala/README.md) | PHP脆弱性対策サービス（ココナラ新商品）の企画一式 | 企画・説明文・画像案まで完成。**出品操作は未実施** |
| [youtube/](youtube/README.md) | ショート動画の企画・台本 | 今後。今回はココナラを優先 |

## 公開されないことの確認（2026-10-23 時点）

サイトは GitHub Actions で `scripts/prepare-pages.js` が作る一時フォルダだけを GitHub Pages に配備します。

- `scripts/prepare-pages.js` の `isPublicFile()` は**ホワイトリスト方式**です。公開されるのは、ルート直下の `*.html`、
  `assets/` `blog/` `course/` `subsidy-support/` 配下、`CNAME` `favicon.ico` `robots.txt` `sitemap.xml`
  `site.webmanifest` `data/blog-index.json` `data/course-index.json` などに限られます。`marketing/` はどれにも当たりません。
  `marketing/` の中に `.html` を置いても、ルート直下ではないため公開されません。
- 対象は `git ls-files`（Git管理下のファイル）だけです。
- 各ワークフローが自動で `git add` するのは、`data/blog-index.json` `blog` `blog.html` `sitemap.xml`
  （`generate-course.yml` は `content/courses` `course.html` `course` `data/course-index.json` `sitemap.xml`）だけで、`marketing/` には触れません。
- `Generate Blog` は `main` へのpushすべてで起動します。`marketing/` だけを追加した場合も、テスト → ブログ生成 → 再配備が走りますが、
  公開される内容は変わりません（作業の手間が増えるだけです）。

> 今後 `scripts/prepare-pages.js` の公開対象を広げる変更をするときは、`marketing/` を含めないよう注意してください。

## 運用ルール

- 画像は、サイト用の `assets/images/` に置かず、各フォルダの `images/` に置きます（サイトの画像ライブラリはテストで枚数が固定されています）。
- ロゴ・キャラクター「ぶひお」は、サイト用の素材（`assets/images/`）を相対パスで参照し、コピーしません。
- ココナラ・YouTubeなどへの実際の出品・投稿は、内容を確認してもらってから行います。
