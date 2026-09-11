# 毎朝6時のブログ処理入口

## 現在の処理

`.github/workflows/daily-blog.yml` の `Daily Blog` は、UTCで `0 21 * * *`、
日本時間では翌日の毎朝06:00ごろに起動します。夏時間補正は不要です。
時刻を変更する場合はこのcron行と説明を変更してください。

mainへの反映後にスケジュールが有効になります。GitHubのデフォルトブランチが
mainであることが前提です。workflow_dispatchによるmainでの手動実行にも対応します。
GitHub Actionsのスケジュールは定刻を保証せず、混雑による遅延・取りこぼしがあり得ます。
公開リポジトリでは60日間活動がないとスケジュールが自動無効化される点にも注意してください。

起動 → checkout → Node.js 24 → scripts/daily-blog.js → 無変更確認 → 正常終了。
スクリプトは開始時刻と日本時間の日付、status: skipped、記事数0、
shouldPublish: falseを標準出力（Actionsログ）へ表示するだけです。
API呼び出し・Markdown作成・既存記事再生成・commit・push・デプロイは実施しません。
Secretsや追加npm依存は不要で、GITHUB_TOKENはcontents:readだけです。
generate-blog.yml、公開サイト、独自ドメイン設定は変更しません。

ローカル確認: `node scripts/daily-blog.js`。ファイルは作成・変更されません。

## 次段階の接続設計（今回は未実装）

AIの処理は `scripts/daily-blog.js` を入口として別モジュールに追加します。
記事作成結果を構造化して返し、有用な情報がない場合は引き続き0件で正常終了します。

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
