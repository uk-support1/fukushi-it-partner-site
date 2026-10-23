# templates/ — PHP確認結果のご報告書（テンプレート）

基本プラン（2,000円）の成果物です。**A4で2ページ（PDF）と、チャットで送れるMarkdown**を、入力のJSONから作ります。判定（◎△！？・対象外）は、PHPの番号から**提案**し、最終判断は人が行います（入力の `status` で上書きできます）。

| ファイル | 内容 |
| --- | --- |
| `report/report.js` | 報告書の生成スクリプト（判定の提案・文面・PDFとMarkdownの書き出し） |
| `report/input-template.json` | **入力の雛形**（お客様ごとに、コピーして書き換える） |
| `report/sample-update.*` | サンプル①「△ 更新が必要」（JSON・Markdown・PDF）。**架空の例** |
| `report/sample-check.*` | サンプル②「？ 要確認」（PHPの番号が確認できなかった例）。**架空の例** |
| `report/report.test.js` | 判定のきまりの確認（27件） |

## 使い方

```sh
# リポジトリのルートで（PDFには playwright と Chromium が必要。フォントは Google Fonts から読み込むのでネットワークが必要）
cp marketing/coconala/templates/report/input-template.json /（保存先）/お客様A.json   # 書き換える
node marketing/coconala/templates/report/report.js /（保存先）/お客様A.json            # → お客様A.md と お客様A.pdf
node marketing/coconala/templates/report/report.js /（保存先）/お客様A.json --no-pdf   # Markdownだけ
node --test marketing/coconala/templates/report/report.test.js                          # 判定のきまりの確認
```

**お客様の情報は、このリポジトリに保存しない**でください（保存先は、リポジトリの外に）。リポジトリにあるのは、架空のサンプルだけです。

## 入力の項目

| 項目 | 内容 |
| --- | --- |
| `sample` | サンプルのとき `true`（透かし「サンプル（架空の例）」が入る）。**お客様への納品は `false`** |
| `report_date` | 確認日（例：`2026年10月24日`） |
| `site_url` / `host` | サイトのURL／サーバー会社・プラン名（分からなければ空欄） |
| `uses_php` | PHPを使っているか（`false` なら「対象外」） |
| `php_version` | PHPの番号（例：`8.3.30`）。**確認できなければ空欄**（「要確認」になる） |
| `evidence` | 確認に使った情報（どの画面か。例：サイトヘルスの画面の写真） |
| `php_managed_by` | `customer`（お客様が選べる）／`host`（サーバー会社が管理）／`unknown` |
| `provider_patch_possible` | OS付属のPHPなど、**提供元が番号を変えずに修正している可能性**があるとき `true`（「要確認」になる） |
| `status` | `auto`（提案どおり）／`ok`／`update`／`eol`／`check`／`none`（人が上書きする場合） |
| `unknown_reason` | 「要確認」のときの理由（例：サーバー会社がPHPを管理していて、番号が表示されないため） |
| `rereport_offer` | 「回答が届いたらご報告し直します（1回、追加料金なし）」の一文を入れるか。**運用ルールが確定するまで `false`**（`06-scope-and-fallback.md` §5） |
| `notes` | 補足（任意。文のリスト） |

## 判定のきまり（`report.js` の `judge()`。`04-listing-copy.md` §7と同じ）

| 条件 | 判定 |
| --- | --- |
| PHPを使っていない | 対象外 |
| 番号が確認できない／最後の数字が分からない／公式の修正版の一覧（8.2〜8.5系）にない系列 | ？ 要確認 |
| 8.5.12以上・8.4.27以上・8.3.36以上・8.2.35以上 | ◎ 対応済み（8.2系は、2026年12月31日のサポート終了を伝える） |
| 8.5〜8.2系で、上の番号より前 | △ 更新が必要。ただし、**サーバー会社がPHPを管理している／提供元が番号を変えずに修正している可能性があるときは ？** |
| 8.1以前 | ！ サポート終了の版。ただし、**提供元が番号を変えずに修正している可能性があるときは ？** |

## 書くときの注意

- **断定しない。** 「更新は必要ないとみられます」「お見受けしました」のように、いただいた情報にもとづく表現にする。「安全です」「必ず」「保証」は書かない（文面は、スクリプトの中で決まっています）。
- 画面の写真に、ID・メールアドレス・パスワード・個人情報が写っていないかを、受け取ったときに確認する。
- 報告書に、**自社サイトのURL・連絡先を載せない**（ココナラの外部への誘導の禁止。載っているのは、公式の出典のURLだけ）。
- 納品前に、PDFを自分の目で読む（特に、お客様のURL・日付・判定）。

## 公式情報が変わったとき

修正版の番号（`FIXED`）、サポート終了日（`EOL_8_2`）、出典のURL（`SOURCES`）は、`report.js` の先頭にあります。`01-fact-check-php-vulnerability.md` と、`04-listing-copy.md` §7、判定のテスト（`report.test.js`）を、あわせて直してください。
