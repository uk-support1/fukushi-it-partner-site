# ブログ生成・公開の修正

## ローカル確認

Node.js 24で `npm ci --ignore-scripts` → `npm test`。
通常のnpm testは既存生成物との差分なしも検証します。CMS更新を受けるCIでは
BLOG_BASELINE_COMPARE=0でその比較のみ省き、連続生成の一致と動作テストを実施します。
テストはOS一時フォルダにコピーして実行するため既存記事を変更しません。
実際の生成は `npm run build:blog`（HTML等を書き換えます）。
公開記事にはtitle、YYYY-MM-DDの実在日付、type、image、本文が必要です。
descriptionが空欄なら本文から120文字まで補完します。既存の説明文は保持します。
YAMLはyamlパッケージで解析し、複数行文字列にも対応します。
slugは原稿ファイル名と一致させます。不正な原稿は生成前にエラーにします。

## 下書き・旧記事

content/articlesに存在する原稿のpublishedがfalse（未指定もfalse）の場合だけ、
対応するblog/<slug>.htmlを除外します。原稿のない旧HTMLは保持します。
原稿自体の削除やslug変更による旧URLの取り下げは、この処理の対象外です。
関連記事は明示的にpublished:trueのCMS記事だけを使用します。

## 公開方法と移行手順（承認後に実施）

現在の設定はmain / (root)、ドメインはfukushi-it-partner.com、HTTPS有効です。
今回はGitHub側の設定を変更しません。

1. ローカルテストと差分を確認し、承認後に修正をcommit/pushする。
2. Settings → Pages → Build and deployment → SourceをGitHub Actionsへ切り替える。
   Custom domainのfukushi-it-partner.comとEnforce HTTPSは維持。DNSは変更しない。
3. Generate Blogをmainで手動実行し、build-blogとdeployの成功を確認する。
4. 独自ドメインで既存9記事、一覧、画像、sitemapを確認する。

mainへのpushで記事生成→生成物だけをcommit/push→公開ファイルの準備→
upload-pages-artifact@v4→deploy-pages@v4を同じワークフロー内で実施します。
通常ページ・画像のみの変更も反映するため、mainへの全pushを対象にします。
GITHUB_TOKENによる生成物のpushは別のpushワークフローを起動しません。
手動実行はmain限定です。concurrencyで直列化し、生成中にmainが変わった場合は
失敗させて上書きを防ぎます。その場合は最新mainから手動再実行してください。

Pages環境の保護ルールはmainを許可する必要があります。
ブランチ保護でbotのpushが禁止される場合はビルドが停止するため、保護を勝手に解除せず運用を確認します。
追加PATは使わず、生成ジョブはcontents:write、デプロイジョブのみpages:write/id-token:writeです。

公開対象はGit追跡済みのルートHTML、assets/、blog/、subsidy-support/、
CNAME、favicon.ico、robots.txt、sitemap.xml、site.webmanifest、data/blog-index.json等です。
原稿・開発用ファイル・admin/・ログ・状態・未追跡ファイルは配信しません。
新しい公開ディレクトリを増やす場合はscripts/prepare-pages.jsの許可対象も更新します。
公開リポジトリ自体の原稿はGitHub上では閲覧できるため、非公開原稿は従来方針どおり別privateリポジトリへ保存します。

移行後のActions実行・公開反映はローカルテストでは検証できません。
問題発生時はPages Sourceを従来のmain / (root)へ戻す方法がありますが、
原稿も配信対象になる従来方式なので実行前に公開範囲を確認してください。
