---
type: column
category_label: "PHP・セキュリティ"
title: "WordPressとPHPの関係をやさしく解説｜WordPressの更新だけでは足りない理由"
date: "2026-10-22"
image: assets/images/blog-library/hero/hero-general-013.png
image_alt: "ノートに関係図を書き出したメモと、ノートパソコンが置かれた机"
image_role: hero
image_category: general
image_series: office-pc
image_hash: 0c7472ed3d2252c7d01eddcce133a60cbde9f9374ae2d4c6f86948821da84e1d
published: true
description: "WordPressとPHPはどんな関係なのでしょうか。WordPressを最新にしていても、PHPの脆弱性は別に対応が必要な理由を、たとえ話と表でやさしく説明します。更新の順番や、WordPressを続けてよいかの考え方もご紹介します。"
slug: wordpress-php-relationship
related:
  - critical-php-vulnerability-2026-10
  - homepage-without-php
cta_heading: "WordPressを続けるか迷ったら、0円の診断でご相談ください。"
cta_button_text: "0円の診断を相談する"
buhio:
  image: buhio-02-waving.png
  alt: "WordPressとPHPの関係をやさしく解説｜WordPressの更新だけでは足りない理由 について、手を振って案内するぶひお"
  comment: "更新するものが3つあることを、メモに書き出そう。"
emphasis:
  - text: "WordPressの更新と、PHPの更新は別の作業です"
    style: strong
  - text: "WordPressを使い続けることが悪いわけではありません"
    style: marker
---

「WordPressは毎回最新にしているので、PHPの脆弱性も大丈夫なのでは？」と考える方は多いと思います。答えは、「WordPressを最新にしていても、PHPの脆弱性は別に対応が必要です」です。この記事では、その理由を、WordPressとPHPの関係から説明します。

## WordPressとPHPは、「車」と「エンジン」のような関係です

WordPressは、ホームページを作って管理するためのソフトウェアで、PHPというプログラミング言語で書かれています。サーバーの上でPHPが動くことで、WordPressは動きます。

たとえるなら、WordPressは「車」、PHPは「エンジン」です。車の部品（WordPress本体、テーマ、プラグイン）を最新のものに交換しても、エンジン（PHP）に欠陥があれば、その欠陥はなくなりません。エンジンの欠陥は、エンジンそのものを直す必要があります。

## 今回の脆弱性は、PHP本体にあります

2026年10月21日に修正された脆弱性は、WordPressの中ではなく、PHP本体にあります。このため、WordPress本体やプラグインを更新しても直りません。サーバー側のPHPを、修正版（8.2.35、8.3.36、8.4.27、8.5.12のいずれか以上）に更新する必要があります。

セキュリティ会社のWiz社は、最新のWordPressの環境でも攻撃が成立することを確かめたと報告しています（Patchstack社の解説による）。ニュースの全体像は、[【2026年10月】PHPの重大な脆弱性とは？](critical-php-vulnerability-2026-10.html)で説明しています。

## 更新するものは、3つの層に分かれています

WordPressのホームページには、更新が必要なものが3つの層に分かれています。WordPressの更新と、PHPの更新は別の作業です。それぞれ、更新する人も違うことが多いので、「だれが担当か」を確認しておくことが大切です。

| 層 | 更新が必要なもの | 一般的な担当 |
| --- | --- | --- |
| サーバー | OS、Webサーバーなど | サーバー会社 |
| PHP | PHP本体 | サーバー会社が更新する場合と、管理画面でお客様や制作会社が切り替える場合があります |
| WordPress | WordPress本体、テーマ、プラグイン | ホームページの管理者（制作会社・保守会社・事業所） |

どの層も、更新されないまま古くなると、ホームページ全体の安全性が下がります。「サーバー会社が全部やってくれている」と思い込まず、契約や保守の内容で、自分のホームページではどこまでが担当範囲かを確認しましょう。

## WordPressは、どのPHPのバージョンで使うのがよいですか？

WordPress公式サイトの動作要件のページ（2026年5月7日更新）では、PHP 8.3以上が推奨されています。また、PHP 7.4は公式にサポートが終了しており、サイトがセキュリティ上の問題にさらされるおそれがあると注意されています。

お使いのPHPのバージョンの確認方法は、[PHPのバージョンを確認する方法](php-version-check.html)で説明しています。

## WordPressとPHPを更新するときの、基本の順番

更新の順番を間違えると、表示が崩れたり、管理画面が開かなくなったりすることがあります。基本は次の順番です。

1. バックアップを取る（ホームページのファイルと、データベースの両方）
2. WordPress本体・テーマ・プラグインを、最新の版にする（新しいPHPに対応した版にしておくため）
3. 開発が止まっているプラグインがあれば、代わりのものに入れ替えるか、使うのをやめる
4. サーバーのPHPの版を上げる
5. トップページ、各ページ、問い合わせフォーム、管理画面が、正しく動くかを確認する

古いプラグインが残っていると、PHPの版を上げたときに、画面が真っ白になる、エラーが出る、といった問題が起きやすくなります。自信がない場合は、制作会社や保守会社に相談してください。費用の考え方は[PHPのアップデート費用はいくら？](php-update-cost.html)で説明しています。

## WordPressは、やめたほうがよいのですか？

いいえ。WordPressを使い続けることが悪いわけではありません。WordPressは多くの人に使われている仕組みで、ブログやお知らせを頻繁に更新するホームページには、とても便利です。PHPとWordPressを、きちんと更新できる体制があるなら、そのまま使い続けて問題ありません。

一方で、次のような場合は、別の選択肢も比べてみる価値があります。

- 更新を頼める人がいない・続けるための費用が負担になっている
- 管理画面を、ほとんど使っていない
- 事業所の紹介が中心で、ブログや会員機能はほとんど使っていない

PHPを使わないホームページの考え方は、[PHPを使わないホームページとは？](homepage-without-php.html)で、WordPressから移るときのメリット・デメリットは、[WordPressから静的HTMLへ移行するメリット・デメリット](wordpress-to-static-pros-cons.html)で説明しています。更新を続ける方法も含めた比較は、[PHPホームページの更新・乗り換え方法を比較](../php-homepage-comparison.html)をご覧ください。

<div class="article-cta-box">
  <h3>WordPressを続けるか、迷ったときは</h3>
  <p>今の管理費や保守の内容、サイトの使い方を一緒に確認する「HP維持費削減診断」は0円です。診断の結果、WordPressのまま続けたほうがよい場合は、そのようにお伝えします。</p>
  <p><a href="../homepage-cost-reduction.html" class="btn btn-accent">0円の診断について見る</a></p>
</div>
