# 毎朝6時のブログ処理入口

## 現在の処理

`.github/workflows/daily-blog.yml` の `Daily Blog` は、UTCで `0 21 * * *`、
日本時間では翌日の毎朝06:00ごろに起動します。夏時間補正は不要です。
時刻を変更する場合はこのcron行と説明を変更してください。

mainへの反映後にスケジュールが有効になります。GitHubのデフォルトブランチが
mainであることが前提です。workflow_dispatchによるmainでの手動実行にも対応します。
GitHub Actionsのスケジュールは定刻を保証せず、混雑による遅延・取りこぼしがあり得ます。
公開リポジトリでは60日間活動がないとスケジュールが自動無効化される点にも注意してください。

起動 → checkout → Node.js 24 → 依存導入 → 模擬APIテスト → scripts/daily-blog.js
→ 新規下書き1件だけであることを確認 → 正常終了です。スクリプトは公開中の記事からタイトル・カテゴリ・
概要・見出しを読み、Gemini APIのgenerateContentでテーマ選定と独立した重複確認を行います。
重複がなければ、選定テーマを使って記事本文を生成・検証し、既存形式の下書きMarkdownを
`content/articles/` に保存します。成功結果を標準出力（Actionsログ）へ表示します。

APIキーはRepository Secretの `GEMINI_API_KEY`、モデルはRepository Variableの
`GEMINI_MODEL` から取得します。基本モデルは `gemini-3.5-flash-lite` で、Variableが
未設定の場合もこのモデルを使用します。必要な場合はVariableを `gemini-3.5-flash`
へ変更して切り替えます。この2モデル以外は拒否します。値はコードへ保存しません。
APIキー未設定、API失敗、JSON不正、必須項目不足、既存記事との重複がある場合は
失敗終了します。記事の本文が空、短すぎる、長すぎる、見出し構成が不正、タイトルが
選定テーマと異なる場合も失敗します。エラーログにはキー、API本文、既存記事本文を出しません。

既存記事再生成・commit・push・デプロイは実施しません。保存する記事は必ず
`published: false` とし、公開ページの生成処理には接続しません。
GitHub Actions上のファイルは現段階では実行用checkout内だけに作られ、ジョブ終了後には
残りません。GitHubへ永続化する処理は、後続のcommit・競合確認と一緒に追加します。
GITHUB_TOKENはcontents:readだけです。
generate-blog.yml、公開サイト、独自ドメイン設定は変更しません。

ローカル確認は `npm test`。実APIを使う場合は `GEMINI_API_KEY` を環境変数に設定し、
必要に応じて `GEMINI_MODEL` も設定して `node scripts/daily-blog.js` を実行します。
GitHub ActionsではSettings → Secrets and variables → Actionsで、Repository Secretに
`GEMINI_API_KEY`、Repository Variableに必要なら `GEMINI_MODEL` を設定します。
実APIテストは費用が発生するため、この段階では行いません。

## テーマJSON

`title`、`category`、`target`、`keyword`、`reason`、`angle`、`service` を必須にします。
カテゴリは許可済み一覧に限定し、余分な項目、不正文字、長すぎる値を拒否します。
Gemini APIには `application/json` とJSON Schemaを指定し、返却後も同じローカル検証を行います。

重複回避は二段階です。最初の選定で既存記事の本文概要・見出しまで比較し、
次に別のAPI要求で候補と全既存記事を1件ずつ比較します。表現だけ違う同じ問い・
解決策、判断が曖昧な候補は重複として失敗させます。完全一致と近いタイトルは
ローカル処理でも拒否します。外部最新情報の検索は、この段階では行いません。

## 記事JSON

`title`、`description`、`bodyMarkdown` を必須にします。本文は1,500〜2,500文字程度を
Geminiへ指示し、ローカルでは1,200〜3,500文字を許容範囲として検証します。
既存記事と同じく本文の主見出しは `##`、補助見出しは `###` を使い、H1、front matter、
HTML、画像、URL、Markdownリンクを拒否します。制度、法律、補助金、報酬改定、金額、
期限など、最新の一次情報が入力されていない事項は一般論に留めるよう指示します。

記事生成は `scripts/article-generator.js`、Markdown保存は `scripts/article-writer.js` に
分離しています。日付、slug、ファイル名、画像、公開状態はAIに決めさせません。
保存時のfront matterは `type: column`、`category_label`、`title`、`date`、`image`、
`image_alt`、`published: false`、`description`、`slug` です。カテゴリに応じた既存の
サービス画像をコード側で選びます。

slugは日本語や特殊文字をファイル名へ直接含めず、`article-YYYY-MM-DD-<hash>` とします。
hashは正規化したタイトルのSHA-256先頭12桁です。同じslugが存在する場合は `-2`、
`-3` の順に空いている名前を選び、排他的な新規作成によって既存ファイルを上書きしません。
保存後にだけ `articlesCreated` は1となり、`shouldPublish` はfalseのままです。

## 後続処理との接続設計

`scripts/daily-blog.js` はテーマ選定、記事生成、検証、下書き保存を順番に呼び出します。
保存失敗時は例外として終了し、`articlesCreated: 0`、`shouldPublish: false`を報告します。

最終的には同じDaily Blogワークフロー内で、次の順に明示的に実行します。

1. テーマ選定 → AI生成 → 内容検証 → content/articles/<slug>.md保存。
2. 有効な記事がある場合だけ、npm ci → scripts/generate-blog.jsでHTML等を生成。
3. mainとの競合確認 → 今回の原稿と生成物だけをcommit・push。
4. scripts/prepare-pages.js → upload-pages-artifact。
5. needsで前段成功を条件にしたdeployジョブ → deploy-pages。

GITHUB_TOKENによるpushでは通常、別のpushワークフローは起動しません。
そのためGenerate Blogのpush検知には依存せず、同一ワークフローのsteps/jobsで
生成からデプロイまで完結させます。失敗時は後続へ進めず、0件なら公開を省略します。
既存スクリプトは再利用し、既存Generate BlogはCMS更新用の入口として維持します。

実際に書き込みを追加する段階で、公開処理とのconcurrencyをgithub-pagesに統一し、
重複実行防止・main競合検知・必要なジョブだけへの権限追加を実装・テストします。
現時点のdaily-blog-mainは読み取り専用の入口を直列化するためだけに使用します。
認証・AI・公開の実装は別途承認後に行います。
