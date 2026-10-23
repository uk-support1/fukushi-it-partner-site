# templates/ — PHP更新代行の作業用テンプレート

**お客様の情報は、このリポジトリに保存しない**でください。ここにあるのは、空の雛形だけです（コピーして、リポジトリの外で使う）。

| ファイル | 使う場面 | 内容 |
| --- | --- | --- |
| [work-checklist.md](work-checklist.md) | 作業中（1件ごとにコピー） | 受付から後片付けまでのチェックシート。時間の記録欄つき（最初の5件で採算を見直す） |
| [work-report-template.md](work-report-template.md) | 納品（チャットに貼る） | 作業完了報告書。前後の版・実施したこと・確認した項目・戻し方 |
| [chat-messages.md](chat-messages.md) | お客様とのやりとり | 定型のメッセージ（受付・臨時アカウントのお願い・事前確認の結果・切り戻し・完了・連絡がとれないとき など） |

手順の全体は `../03-work-procedure.md`、できない場合の扱いは `../05-failure-policy.md` です。

## 使い方

```sh
# 1件ごとに、リポジトリの外へコピーして書き込む（例）
cp marketing/coconala/php-update-service/templates/work-checklist.md      ~/work/お客様A-checklist.md
cp marketing/coconala/php-update-service/templates/work-report-template.md ~/work/お客様A-report.md
```

- 報告書の判定（◎△！？）は、確認商品の報告書テンプレートと**同じ判定のきまり**を使う（`../../templates/report/report.js` の `judge()`、`../../templates/README.md`）。更新前後の版を入れて確認できる。
- 報告書に、**自社サイトのURL・連絡先を載せない**（ココナラの外部への誘導の禁止）。公式の出典のURLだけは載せてよい。
- 納品前に、**認証情報・個人情報が写っていないか**を、画面の写真と文面で見直す。
