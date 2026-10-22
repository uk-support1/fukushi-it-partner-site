# PHP脆弱性をきっかけにしたSEO集客施策（作業記録）

2026年10月22日開始。目的は、PHPやWordPressで作られたホームページの更新・保守・セキュリティに
不安を感じている事業者が、Google検索から自然に訪れ、乗り換えプランの相談につながる導線を作ること。
プッシュ型（電話営業など）ではなく、検索から見つけてもらうプル型の仕組みとして作っています。

作業を中断した場合は、末尾の「進捗と残作業」から再開してください。

## 1. 調査結果：PHP脆弱性の事実関係（2026年10月22日時点）

記事・比較ページに書いてよいのは、下の一次情報で確認できた内容だけです。
状況は日々変わるため、記事には「2026年10月22日時点」と明記し、最新情報は公式ページで確認するよう案内します。

| 項目 | 確認できた内容 | 一次情報 |
| --- | --- | --- |
| 脆弱性 | CVE-2026-109618（メモリ不足の処理に起因するリモートコード実行）と CVE-2026-109619（リクエストをまたいで残る古い内部状態に起因するリモートコード実行）。通称「PHP2Shell」 | PHP公式セキュリティ告知、GitHub Security Advisory（GHSA-w8hw-w9fx-j79w / GHSA-6wmf-4rv5-p3rp） |
| 深刻度 | どちらも CVSS v4.0 で 9.2（Critical）。認証なしで遠隔からコード実行される可能性 | 同上 |
| 公開日 | 2026年10月21日（当初予定の22日から、情報漏えいを受けて前倒し） | PHP Foundation のブログ（2026-10-21） |
| 影響を受ける版 | 8.2.35未満、8.3.36未満、8.4.27未満、8.5.12未満 | GHSA、IPA、JPCERT/CC、JVN |
| 修正版 | 8.2.35、8.3.36、8.4.27、8.5.12 | 同上 |
| PHP 8.1以前 | 公式の更新は提供されない（サポート終了）。ソースからビルドする人向けに、7.4・8.0・8.1の最小限のバックポートのみ提供。IPAは「PHP 5.4以降は少なくとも1件の影響を受ける」というWiz社の見解を紹介 | PHP公式告知、IPA、JPCERT/CC |
| 影響する動作環境 | Webリクエストを処理するPHP全般（PHP-FPM、Apache mod_php、php-cgi、FrankenPHP、LiteSpeed）。公式はmod_phpが特にリスク大と評価 | PHP公式告知 |
| 回避策 | 修正版への更新が唯一の完全な対策。設定変更は攻撃経路を減らすだけで完全ではない | GHSA、PHP公式告知 |
| 悪用の状況 | 公開直後から悪用の試みが観測されたと複数のセキュリティ企業が報告。検証コード（PoC）も複数出回っている。一方、信頼性の高い汎用的な攻撃コードは未確認という評価もある。状況は流動的 | watchTowr、Rapid7、PHP Foundation |
| 国内の公的機関 | IPA（注意喚起、2026-10-22）、JPCERT/CC（JPCERT-AT-2026-0033、同日）、JVN（JVNVU#99905564、同日） | 各機関のページ |
| 侵害確認の観点 | 異常なPHPSESSID Cookie、不審なmultipart/form-dataリクエストと前後のメモリ上限エラー・HTTP 500、PHPワーカーの異常終了や頻繁な再起動。痕跡がなくても攻撃されていないとは断定できない | JPCERT/CC |
| サポート期限 | 8.2は2026-12-31でセキュリティサポート終了。8.3は2027-12-31、8.4は2028-12-31、8.5は2029-12-31。8.1は2025-12-31で終了済み | php.net（supported-versions、eol） |
| WordPress | 脆弱性はPHP本体側にあるため、WordPress本体やプラグインの更新だけでは直らない。サーバー側のPHPを修正版にする必要がある。WordPress公式の推奨はPHP 8.3以上（2026-05-07更新の要件ページ） | Patchstack、wordpress.org の要件ページ |

### 確認できなかった・書かないこと

- 各レンタルサーバー会社の対応状況（時間とともに変わるため、契約先のお知らせを見るよう案内する）
- 各社の管理画面のメニュー名（公式マニュアルで確認が取れなかったため「PHP」「PHPバージョン」などの項目を探す、という一般的な書き方にする）
- 国内被害件数などの二次情報（一次情報で確認できないため載せない）
- PHPのアップデート費用の「相場」（広く通用する一次情報がないため、費用が発生する場面と見積りの確認点を説明し、金額は福祉ITパートナーの公開料金のみ示す）

### 主な情報源（記事の「情報源」欄で使うURL）

- PHP公式 セキュリティ告知: https://www.php.net/archive/2026.php
- GHSA-w8hw-w9fx-j79w: https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w
- GHSA-6wmf-4rv5-p3rp: https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp
- The PHP Foundation: https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/
- PHP サポート対象バージョン: https://www.php.net/supported-versions.php
- PHP サポート終了バージョン: https://www.php.net/eol.php
- IPA 注意喚起: https://www.ipa.go.jp/security/security-alert/2026/alert20261022.html
- JPCERT/CC 注意喚起: https://www.jpcert.or.jp/at/2026/at260033.html
- JVN: https://jvn.jp/vu/JVNVU99905564/index.html
- WordPress 要件: https://wordpress.org/about/requirements/

## 2. SEO戦略

### 狙う検索者

ホームページを持つ福祉事業所・中小企業・個人事業主・医療介護事業所のうち、IT担当者がいない方。
ニュースを見て不安になり、「自分のサイトは大丈夫か」「何をすればいいか」「いくらかかるか」を調べる人。

### 勝ち筋

- 大手メディア・セキュリティ企業・IPAとは「PHP 脆弱性」の大きな検索語では競わない。
- 競合（制作会社・WordPress保守会社）の記事は「技術者向けの解説」か「自社の保守サービスの案内」に寄っている。
  福祉分野に特化し、IT初心者向けのやさしい言葉で、確認手順から費用・乗り換えまでを一本の道筋にした記事は少ない。
- そこで「自分のサイトでの確認方法」「費用」「更新できないとき」「攻撃されたかもしれないとき」「フォーム」など、
  運営者の具体的な疑問に1記事1テーマで答える（ロングテール）。
- 「PHPやWordPressは危険」とは書かない。「PHPを更新すれば解決するケースが多い」ことを先に伝え、
  静的HTMLへの乗り換えは選択肢の一つとして公平に比較する。これにより信頼を得て、必要な人だけが相談に進む。

### 構成（ハブ＆スポーク）

- ハブ記事：`critical-php-vulnerability-2026-10`（ニュースの要点と、今日やること）
- スポーク記事：確認・費用・対処・移行など11本
- 受け皿ページ：`php-homepage-comparison.html`（更新・乗り換えの比較）→ 既存LP `homepage-cost-reduction.html`（49,500円〜の乗り換えプラン）→ 無料相談
- 記事同士は、読者の次の疑問に応じて2〜4本ずつ文脈の中で相互リンク。全記事から比較ページとハブ記事へ戻れる。

### キーワードの住み分け（共食い防止）

| ページ | 狙う検索意図 |
| --- | --- |
| critical-php-vulnerability-2026-10 | 「PHP 脆弱性 2026」「PHP 脆弱性 対策」（ニュースの意味と今日やること） |
| php-check-my-homepage | 「ホームページ PHP 使っているか 確認」（PHPを使っているかの有無） |
| php-version-check | 「PHP バージョン 確認 方法 WordPress レンタルサーバー」（番号の見方と安全かどうかの判定） |
| php-old-version-risk | 「PHP 古い 使い続ける リスク」「PHP 8.1 サポート終了」 |
| php-update-cost | 「PHP アップデート 費用」「PHP バージョンアップ いくら」 |
| php-update-not-possible | 「PHP 更新できない」「PHP バージョンアップ できない 対処」 |
| php-possible-attack-checklist | 「ホームページ 攻撃された 確認」「PHP 脆弱性 侵害 確認」 |
| php-contact-form-alternatives | 「PHP お問い合わせフォーム 代わり」「静的サイト フォーム」 |
| wordpress-php-relationship | 「WordPress PHP 関係」「WordPress 更新 PHP 脆弱性」 |
| homepage-without-php | 「PHP 使わない ホームページ」「静的サイト とは」 |
| wordpress-to-static-pros-cons | 「WordPress 静的HTML 移行 メリット デメリット」 |
| homepage-security-maintenance-cost | 「ホームページ 管理費 見直し」「ホームページ セキュリティ対策 費用」 |
| php-homepage-comparison.html | 「PHP ホームページ 乗り換え 比較」「PHP 更新 継続 乗り換え どれ」 |

### 表現のルール（誤認防止）

- 49,500円は、事業所紹介を中心とした小規模サイトの「基本プラン」の料金。PHPで動くフォーム・会員機能・予約システム・
  ネットショップ・データベース連携などがあるサイトは、一律では移行できず、個別見積りまたは現状維持をおすすめする場合があると明記する。
- 「静的サイトにすれば安全」とは書かない。PHP起因のこの種の脆弱性の対象外になるだけで、パスワード管理など別のリスクは残る。
- 福祉ITパートナーは脆弱性診断・侵害調査（フォレンジック）の事業者ではないと明記し、必要な場合は専門業者やサーバー会社への相談をすすめる。
- 価格・サービス内容は既存LP（homepage-cost-reduction.html）と同じ表現に合わせ、変更しない。

## 3. 実装の方針（このリポジトリの仕組みに合わせた点）

- 記事は `content/articles/*.md` に書き、`node scripts/generate-blog.js` で `blog/*.html`・`blog.html`・`data/blog-index.json`・`sitemap.xml` を生成する（mainへのpushで自動生成・公開）。
- 比較ページは手書きHTML（`php-homepage-comparison.html`）。ルート直下の `*.html` は `scripts/prepare-pages.js` の公開対象。
- `sitemap.xml` の固定ページ一覧は `scripts/generate-blog.js` の `STATIC_PAGES` に書かれている。新しいページは必ずここへ追加する
  （`sitemap.xml` だけを手で直しても、次の自動生成で消える）。
- 記事のヒーロー画像は `assets/images/blog-library/hero/` の既存画像から選ぶ。ライブラリの枚数はテストで固定されているため、画像の追加はしない。
  同じ日付の記事は、一覧で隣り合うカードの「系列・場面」が重ならない組み合わせにする（テストで検査される）。
- 同じ日付の記事はファイル名の昇順で並ぶ。ブログ一覧の「注目記事」は先頭の1件なので、ハブ記事のslugは `c...` で始め、先頭に来るようにしている。
- 本文に `*` `` ` `` `==` を直接書くとビルドエラー（Markdown記号の漏れ検査）。強調は front matter の `emphasis` で指定する。
- 記事ページのテンプレートに、Article / BreadcrumbList の構造化データを追加した（既存記事にも自動で付く）。

### 記事一覧と画像・内部リンク

| slug | ヒーロー画像 | 関連記事（相互リンク） |
| --- | --- | --- |
| critical-php-vulnerability-2026-10 | hero-security-004 | 全記事の目次＋比較ページ＋LP |
| homepage-security-maintenance-cost | hero-subsidy-001 | php-update-cost, homepage-without-php, 比較, LP, server-domain-guide |
| homepage-without-php | hero-web-001 | wordpress-to-static-pros-cons, php-contact-form-alternatives, 比較, LP |
| php-check-my-homepage | hero-general-005 | php-version-check, wordpress-php-relationship, ハブ, 比較 |
| php-contact-form-alternatives | hero-general-007 | homepage-without-php, wordpress-to-static-pros-cons, 比較, 問い合わせ |
| php-old-version-risk | hero-security-006 | php-version-check, php-update-not-possible, php-update-cost, 比較 |
| php-possible-attack-checklist | hero-general-001 | ハブ, php-version-check, homepage-security-maintenance-cost |
| php-update-cost | hero-subsidy-003 | php-update-not-possible, homepage-security-maintenance-cost, 比較, LP |
| php-update-not-possible | hero-dx-001 | php-old-version-risk, php-update-cost, wordpress-to-static-pros-cons, 比較, LP |
| php-version-check | hero-web-002 | php-check-my-homepage, php-old-version-risk, php-update-not-possible, ハブ |
| wordpress-php-relationship | hero-general-013 | ハブ, php-version-check, homepage-without-php, wordpress-to-static-pros-cons |
| wordpress-to-static-pros-cons | hero-dx-002 | homepage-without-php, php-contact-form-alternatives, 比較, LP, homepage-security-maintenance-cost |

## 4. 進捗と残作業

2026-10-22（開始時点）

- [x] PHP脆弱性の一次情報調査
- [x] 既存サイトの構成・生成ロジック・テストの把握（ベースライン：npm test 204件成功）
- [x] SEO戦略・記事構成の設計（この文書）
- [ ] 生成ロジックの更新（構造化データ、sitemapの固定ページ、フッターのリンク）
- [ ] 記事12本の執筆
- [ ] 比較ページ（php-homepage-comparison.html）の制作
- [ ] 既存LP（homepage-cost-reduction.html）への説明・CTA・FAQの追加
- [ ] フッター・トップ・料金プランからの導線
- [ ] 検証（npm test、リンク切れ、メタ・canonical、構造化データ、スマホ表示）
- [ ] 公開（mainへの反映）と最終報告
