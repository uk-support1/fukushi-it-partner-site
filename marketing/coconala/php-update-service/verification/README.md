# verification/ — バックアップ・復旧手順の実機検証（このコンテナ内）

**お客様のデータは使いません。** サイトも認証情報も、すべて検証用のダミーです。結果は `../11-verification-report.md`。

| ファイル | 内容 |
| --- | --- |
| `lab.sh` | 検証環境の部品：サイトの作成、「PHPの版の切り替え」の再現（`panel_switch`）、バックアップ・中身の確認・復元、ページの比較、管理画面のログイン確認、サイトヘルスのPHPの版の取得、プラグインごとの必要PHPの版の確認 |
| `run-verification.sh` | 検証の本体（シナリオ：S1 標準の更新／S2 古いプラグインで失敗し切り戻す／S3 ファイルとデータベースが失われた場合の復元／S4 バックアップの保管場所／S5 壊れたバックアップの検出）。結果は `$LAB/results/results.md` |
| `legacy-plugin/legacy-widget.php` | 検証用の**架空のプラグイン**（PHP 7 で動き、PHP 8 で動かない `create_function` を使用） |
| `hosting-test-checklist.md` | **実際のレンタルサーバー**で、同じ手順を一度通すためのチェックリスト（受付開始の条件 G2） |

## 実行に必要なもの

- `php7.4`・`php8.1`・`php8.3` のCLI（`mysqli`・`mbstring`・`xml`・`curl`・`zip` つき）、MariaDB（`mariadb`・`mariadb-dump`）、`curl`、`python3`、`tar`、`gzip`、`sha256sum`
- ネットワーク（WordPress日本語版・wp-cli・プラグインを `$LAB/cache/` に取得する）
- 既定の作業場所は `/opt/lab`（`LAB=/別の場所` で変更できる）。**リポジトリの外**に作る

```sh
bash marketing/coconala/php-update-service/verification/run-verification.sh
```

## 検証の限界

「サーバー会社の管理画面」の代わりに、PHPの組み込みサーバーを版ごとに起動し直しています。**サーバー会社の画面・バックアップ機能・復元機能は、再現できません。** 実際のサーバーでの検証は `hosting-test-checklist.md`。
