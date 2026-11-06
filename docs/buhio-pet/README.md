# ぶひお ペット（動くぶひお）のスプライトデータ保管

Codex の「hatch-pet」で作成した、動くぶひお（ピンクのぶた、水色の「39」Tシャツ、紫のパンツ）の画像データの保管場所です。

記事内に表示している固定画像（`assets/images/buhio/`、[docs/buhio.md](../buhio.md) 参照）とは**別物**です。記事生成スクリプトはこのフォルダを参照しません。

## 保管しているファイル

| ファイル | 内容 |
| --- | --- |
| `spritesheet-atlas.webp` | 全アニメーションを並べたスプライトシート本体（背景透過、8列×11行） |
| `contact-sheet-rows.webp` | 行ごとの名前・フレーム数つきの確認用シート |
| `direction-sheet.webp` | 16方向の向き（顔のアップ版つき）の確認用シート |

いずれも作成時にチャットへ添付された画像を、そのまま（再圧縮せずに）保存したものです。`spritesheet-atlas.webp` は 1343×2000px で、作成元の画像より解像度が小さい可能性があります。

## スプライトシートの行構成

`contact-sheet-rows.webp` の表示に基づきます。1行は最大8フレームで、使わない枠は空です。

| 行 | 名前 | フレーム数 |
| --- | --- | --- |
| 0 | idle | 6 + neutral（7枚目は空） |
| 1 | running-right | 8 |
| 2 | running-left | 8 |
| 3 | waving | 4 |
| 4 | jumping | 5 |
| 5 | failed | 8 |
| 6 | waiting | 6 |
| 7 | running | 6 |
| 8 | review | 6 |
| 9 | look 000–157.5 | 8 |
| 10 | look 180–337.5 | 8 |

## 向き（look）

行9・10は、ぶひおの顔と体が向く方向を22.5度刻みで16方向に分けたものです。`direction-sheet.webp` で確認できます。

| 角度 | 向き | 角度 | 向き |
| --- | --- | --- | --- |
| 000 | up | 180 | down |
| 022.5 | up-right | 202.5 | down-left |
| 045 | up-right | 225 | down-left |
| 067.5 | up-right | 247.5 | down-left |
| 090 | right | 270 | left |
| 112.5 | down-right | 292.5 | up-left |
| 135 | down-right | 315 | up-left |
| 157.5 | down-right | 337.5 | up-left |

## まだ保管できていないもの

作成時の出力フォルダ（`outputs/buhio-pet/`）にあった次のファイルは、作業環境からは読み取れなかったため、**このフォルダには入っていません**。内容は確認していません。

- `pet.json`（ペット定義）
- `run-summary.json`
- `validation.json`
- `chroma-despill.json`
- `direction-blind-validation.json`
- `direction-semantics.json`
- `look-continuity.json`
- `final-visual-qa.txt`

また、作成元の元解像度のスプライトシートも未保管です。Codex でペットとして使い直す場合や、フレームごとの表示時間を知りたい場合は、これらの元ファイルが必要です。ファイルの中身をチャットに貼っていただければ、このフォルダに追加できます。

## 注意

- このリポジトリは公開です。ぶひおは公開サイトのキャラクターなので画像の保管に問題はありませんが、元ファイルに個人のフォルダ名や非公開情報が含まれていないかを確認してから追加してください。
