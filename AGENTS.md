# 福祉ITパートナー｜Codex 作業ガイド

対象リポジトリ：`uk-support1/fukushi-it-partner-site`

## 事業・料金の共通情報

- サービス名・料金・提供範囲の確認前に [docs/ai-shared/service-catalog.md](docs/ai-shared/service-catalog.md) を参照する。
- 確定した変更理由・履歴は [docs/ai-shared/decision-log.md](docs/ai-shared/decision-log.md) を確認する。
- 価格変更の依頼では、現在の公開ページ（`homepage-plan.html` と `homepage-cost-reduction.html`）との違いを確認する。
- 記憶や旧チャットの内容だけで正式料金を上書きしない。不一致があれば報告し、確認する。
- サービス情報ファイルの更新は公開サイトの更新と別。依頼なしに掲載価格を変えない。
- このリポジトリは公開。顧客の個人情報や機密情報を入れない。
- 他リポジトリの変更や、サイト本体・GA4計測設定の改変は、明示的な依頼がある場合だけ行う。

## GA4の自己アクセス除外（このサイトのブラウザ確認）

- GA4導入サイトを実際のブラウザで確認する際は、サイトに実装済みの `?analytics=off`（既存クエリがある場合 `&analytics=off`）による除外を先に有効化する。
- 除外の有効性が確認できない場合は報告し、勝手にGA4設定・計測コードを変更しない。
- HTTP通信やファイルの読取りだけでGA4計測が発生しない場合は対応不要。
