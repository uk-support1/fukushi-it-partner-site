# 毎朝6時のブログ処理入口

## 現在の処理

`.github/workflows/daily-blog.yml` の `Daily Blog` は、UTCで `17 21 * * *`、
日本時間では翌日の毎朝06:17ごろに起動します。夏時間補正は不要です。
時刻を変更する場合はこのcron行と説明を変更してください。

mainへの反映後にスケジュールが有効になります。GitHubのデフォルトブランチが
mainであることが前提です。workflow_dispatchによるmainでの手動実行にも対応します。
GitHub Actionsのスケジュールは定刻を保証せず、混雑による遅延・取りこぼしがあり得ます。
公開リポジトリでは60日間活動がないとスケジュールが自動無効化される点にも注意してください。

起動 → checkout → Node.js 24 → 依存導入 → 全ローカルテスト → scripts/daily-blog.js
→ 新規下書き1件だけを検証・commit・push → 対象記事だけを公開化・生成・commit・push
→ Pages artifact作成・デプロイ → 正常終了です。スクリプトは公開済み記事と下書きからタイトル・カテゴリ・
概要・見出しを読み、公式RSSから最新情報候補を収集して、Gemini APIのgenerateContentで
テーマ選定と独立した重複確認を行います。
`DUPLICATE_TOPIC` の場合だけ、却下済み候補のtitle・category・keyword・angleを渡して、
実質的に異なるテーマを最大3回（初回を含む）選びます。重複判定の基準は変更しません。
最新情報モードで2回連続重複した場合、3回目は通常のevergreenテーマへ切り替えます。
3回とも重複した場合は記事を生成・保存せず失敗します。認証・JSON・保存などのエラーは再試行しません。
重複がなければ、選定テーマを使って記事本文を生成・検証し、既存形式の下書きMarkdownを
`content/articles/` に保存します。成功結果を標準出力（Actionsログ）へ表示します。

APIキーはRepository Secretの `GEMINI_API_KEY`、モデルはRepository Variableの
`GEMINI_MODEL` から取得します。基本モデルは `gemini-3.5-flash-lite` で、Variableが
未設定の場合もこのモデルを使用します。必要な場合はVariableを `gemini-3.5-flash`
へ変更して切り替えます。この2モデル以外は拒否します。値はコードへ保存しません。
APIキー未設定、API失敗、JSON不正、必須項目不足、既存記事との重複がある場合は
失敗終了します。記事の本文が空、短すぎる、長すぎる、見出し構成が不正、タイトルが
選定テーマと異なる場合も失敗します。エラーログにはキー、API本文、既存記事本文を出しません。

最初の保存時は必ず `published: false` とします。生成結果はrunnerの
一時ファイルを介して `scripts/commit-draft.js` へ渡し、その実行で作成された新規Markdown
1件だけをmainへcommit・pushします。その成功結果を使って同じ記事だけを
`published: true`へ変更し、公開に必要な5ファイルだけを別commitでpushします。
GITHUB_TOKENはDaily Blogワークフローだけ `contents: write` とし、他のワークフローの
権限は変更しません。独自ドメインと既存Generate Blogワークフローは維持します。

ローカル確認は `npm test`。実APIを使う場合は `GEMINI_API_KEY` を環境変数に設定し、
必要に応じて `GEMINI_MODEL` も設定して `node scripts/daily-blog.js` を実行します。
GitHub ActionsではSettings → Secrets and variables → Actionsで、Repository Secretに
`GEMINI_API_KEY`、Repository Variableに必要なら `GEMINI_MODEL` を設定します。
実APIテストは費用が発生するため、この段階では行いません。

## テーマJSON

`title`、`category`、`target`、`keyword`、`reason`、`angle`、`service` を必須にします。
カテゴリは許可済み一覧に限定し、余分な項目、不正文字、長すぎる値を拒否します。
Gemini APIには `application/json` とJSON Schemaを指定し、返却後も同じローカル検証を行います。

重複回避は二段階です。最初の選定で公開済み記事と下書きの本文概要・見出しまで比較し、
次に別のAPI要求で候補と全既存記事を1件ずつ比較します。表現だけ違う同じ問い・
解決策、判断が曖昧な候補は重複として失敗させます。完全一致と近いタイトルは
ローカル処理でも拒否します。直近記事の日付・カテゴリ・キーワードも渡し、同じ話題の
連続を避けます。重大な新しい公式発表だけは `importance: high` として関連テーマを許容します。

## 最新情報の取得

`scripts/latest-info.js` が、厚生労働省、福祉医療機構（WAM NET）、デジタル庁、内閣府の
公式RSSを並行取得します。WAM NETは障害福祉サービス等報酬改定や介護保険部会など、福祉事業者に
直結する審議会・行政資料を配信しており、利用者に関心の薄い一般的な省庁ニュースだけに偏らない
ようにするための情報源です。Yahoo!ニュース等の一般ニュースサイトは、RSS・掲載情報の商用利用や
それを用いたプログラムでの二次利用を利用規約で明確に禁止しているため、情報源には採用しません。
HTTPSの公式ホストを固定の許可リストにし、応答サイズ、15秒のタイムアウト、公開日、
直近7日、福祉・就労・DX・AI・IT・補助金等の関連語を検査します。URLとタイトルの重複を除き、
新しさ、関連度、情報源の優先順位から3〜10件をGeminiへ渡します。各候補はタイトル、URL、
公開日時、情報源、短い概要だけです。取得した文章は転載せず、記事内では要約・再構成します。

同じ情報源（`source`）が最終候補（最大10件）のうち`PER_SOURCE_CAP`（3件）を超えて
独占することはありません。動画の概要欄に毎回同じ宣伝文を入れているチャンネルなど、
内容に関係なく関連語ヒットでスコアが底上げされ続ける情報源が候補を埋め尽くすのを防ぐため
です。ただし他の情報源だけでは最大件数に届かない場合は、上限を機械的に緩めて埋め、
候補の総数が減ることはありません（`scripts/latest-info.js`の`collectLatestInfo`）。

3件未満の場合やRSS取得が失敗した場合は、その実行を止めず、従来の通常テーマ選定へ
自動的に切り替えます。通常テーマでは最新の制度・金額・期限を断定しません。

## YouTubeチャンネルの動画情報

障害福祉・精神保健・介護の現場に詳しい発信者4チャンネル（精神保健福祉士うさぎ、精神科医
がこころの病気を解説するCh／益田裕介、WithYouチャンネル、ケアきょう）の公式チャンネルRSS
（`youtube.com/feeds/videos.xml?channel_id=...`）も候補として扱います。これはGoogleが
提供する公式機能で、Yahoo!ニュースのような商用利用禁止規約はありません。取得できるのは
動画タイトルと概要欄だけで、実際の発話内容（文字起こし）は取得しません。YouTubeの動画
ページはJavaScriptアプリのため、本文相当のテキストが取れず記事生成が誤った情報を作る
原因になり得るので、`NO_ENRICH_HOSTS`によりページ本文の追加取得（enrichCandidate）は
スキップします。

これらの候補は`kind: "video"`を持ち、`scripts/article-generator.js`が記事生成時に
「公的機関の発表ではなく発信者個人の見解・経験として扱い、断定せず、詳しくは動画本編の
確認を読者に促す」よう追加指示します。医学的判断（診断・治療方針）に踏み込む断定もしません。

### 記事生成時はGeminiに動画そのものを直接理解させる（ハイブリッド方式）

`data/youtube-cache.json`にある概要欄の要約はRSS由来で浅い（タイトルとせいぜい数行）ため、
選ばれたテーマの出典に`kind: "video"`が含まれる場合、記事生成のリクエストに動画URLを
`fileData`パートとして直接添付します（`scripts/topic-selector.js`の`requestGemini`の
`fileParts`引数）。Gemini APIはYouTubeの公開動画URLを渡すと、Google側のサーバーが
その動画（音声・映像）を直接取得・理解してくれる公式機能を持っており、これは
`responseJsonSchema`による厳密なJSON出力とも問題なく組み合わせられることを実機検証済み
です。この経路はYouTube動画専用の特別な仕組みで、GitHub Actions側からYouTubeへ
直接アクセスするわけではないため、動画一覧の取得（RSS）で起きているブロック問題とは
無関係に機能します。

一方で、Geminiの汎用Web取得ツール（`urlContext`）でYouTubeのRSSフィードURLを
取得させる方式は`URL_RETRIEVAL_STATUS_ERROR`で失敗することを実機検証で確認済みです。
そのため「新着動画の一覧を知る」部分は次項のセルフホストランナー方式のまま維持し、
「選ばれた動画の中身を理解して書く」部分だけをGeminiのYouTube動画理解に任せる
ハイブリッド構成になっています。

### GitHub Actionsから直接取得しない理由とキャッシュ方式

検証の結果、YouTubeのフィードURLはGitHub Actionsの共有クラウドランナーからの
自動アクセスに対して一時的に404や500を返すことが多く、実運用でもYouTube候補が
ほぼ選ばれませんでした。個人のPCなど別のネットワークからは同じURLが問題なく
取得できたため、共有クラウドランナー（データセンターIP）側が継続的に不利な扱いを
受けていると考えられます。

そのためDaily Blog本体（`scripts/daily-blog.js`、GitHub Actionsのクラウドランナー）は
YouTubeへ直接アクセスしません。代わりに、`.github/workflows/youtube-cache.yml`が
別リポジトリ内の**セルフホストランナー（自宅PC等）**上で`scripts/fetch-youtube-cache.js`
を実行し、4チャンネル分の候補を`data/youtube-cache.json`にコミットします。Daily Blog
本体は`loadYoutubeCache()`でこのファイルを読み、7日以内に更新されていれば候補として
合流させ（`collectLatestInfo`の`extraCandidates`）、古い・存在しない場合は無視します。

この分離により、セルフホストランナー（自宅PCの電源やネットワーク）が何日オフラインでも
Daily Blog自体の毎日の公開は一切影響を受けません（既存の「候補3件未満なら通常テーマへ
自動フォールバック」がそのまま効きます）。YouTube側の取得だけを切り分けて確認したい
場合は、Actionsの「Run workflow」から`sources_filter`を`video_only`にしてDaily Blogを
手動実行すると、その回だけYouTubeの4チャンネルへ直接ライブ接続を試せます
（`DAILY_BLOG_SOURCES_FILTER`環境変数）。通常のスケジュール実行では常にキャッシュ経由
（`all`）です。

### セルフホストランナーのセットアップ（初回のみ）

1. リポジトリの Settings → Actions → Runners → “New self-hosted runner” を開く
2. 表示されるコマンドを、自宅ネットワークに接続するPCのターミナルにコピペ実行
3. Node.js 24とgitがそのPCに入っていることを確認（`actions/setup-node`がNodeは
   自動導入しますが、gitは事前にインストールされている必要があります）
4. `run.sh`（Windowsは`run.cmd`）を実行してランナーを起動したままにしておく

このリポジトリは自分だけが変更する非公開の業務サイトなので、セルフホストランナーを
使っても安全です（不特定多数がPRを送れる公開リポジトリでは使わないでください）。

## 記事JSON

`title`、`description`、`bodyMarkdown` を必須にします。本文は1,500〜2,500文字程度を
Geminiへ指示し、ローカルでは1,200〜3,500文字を許容範囲として検証します。
既存記事と同じく本文の主見出しは `##`、補助見出しは `###` を使い、H1、front matter、
HTML、画像、URL、Markdownリンクを拒否します。制度、法律、補助金、報酬改定、金額、
期限など、最新の一次情報が入力されていない事項は一般論に留めるよう指示します。
最新情報がある記事は、最新情報、発表・変更点、福祉事業者との関係、現場の検討事項、
福祉ITパートナーとしての見解、まとめの順に構成します。出典名・発表タイトル・URLは
AIに作らせず、選定済みの公式候補からコードが `出典・参考情報` セクションへ追加します。

記事生成は `scripts/article-generator.js`、Markdown保存は `scripts/article-writer.js` に
分離しています。日付、slug、ファイル名、画像、公開状態はAIに決めさせません。
保存時のfront matterは `type: column`、`category_label`、`title`、`date`、`image`、
`image_alt`、`published: false`、`description`、`slug` です。カテゴリに応じた既存の
サービス画像をコード側で選びます。

slugは日本語や特殊文字をファイル名へ直接含めず、`article-YYYY-MM-DD-<hash>` とします。
hashは正規化したタイトルのSHA-256先頭12桁です。同じslugが存在する場合は `-2`、
`-3` の順に空いている名前を選び、排他的な新規作成によって既存ファイルを上書きしません。
下書き保存後は `articlesCreated` が1、`shouldPublish` はfalseです。

## 下書きの永続保存

`scripts/commit-draft.js` は、結果JSONが示すファイルと実際の新規ファイルを照合します。
保存先、拡張子、slug、本文、front matterの `published: false`、未追跡状態を検査し、
既存のtracked変更や事前にstageされたファイルがあれば停止します。stageには生成された
相対パス1件だけを明示し、stage後とcommit後にも対象がその1件だけであることを検査します。
commitメッセージは `blog: add daily draft YYYY-MM-DD` です。

push前にはorigin/mainをfetchし、下書きcommitの親が最新のorigin/mainと一致する場合だけ
`git push origin HEAD:main` を実行します。mainが更新されていた場合や通常pushが拒否された
場合は失敗終了し、force push、merge、rebaseは行いません。成功時の最終結果は
`status: draft_committed`、`articlesCreated: 1`、`shouldPublish: false` です。
GITHUB_TOKENによるpushは後続のGenerate Blogワークフローを起動しないため、Daily Blog自身が
後続の公開処理を同じワークフロー内で実行します。

## 公開処理

`scripts/daily-blog.js` はテーマ選定、記事生成、検証、下書き保存を順番に呼び出します。
`scripts/publish-draft.js` は下書きcommitのcommit ID、slug、ファイルパスを照合し、
今回のMarkdownにある `published: false` の1行だけを `published: true`へ変更します。
すでに公開済み、個別HTMLが存在する、下書きcommitが1ファイル追加ではない、mainが更新済み
などの状態では停止します。

`scripts/generate-blog.js` のslug限定モードを使い、新規記事の個別HTMLだけを生成します。
`blog.html`、`sitemap.xml`、`data/blog-index.json`は全公開記事から更新します。
既存記事HTMLは再生成しません。公開commitは次の5ファイルに限定します。

1. `content/articles/<slug>.md`
2. `blog/<slug>.html`
3. `blog.html`
4. `sitemap.xml`
5. `data/blog-index.json`

stage前、commit後、push直前に対象一覧を検査します。origin/mainが下書きcommitから
進んでいれば停止し、merge、rebase、force pushは行いません。公開commit成功後に
`scripts/prepare-pages.js`、`upload-pages-artifact`、`deploy-pages`を同じワークフローで
実行します。公開commit時点では `status: publication_committed` とし、deploy-pagesまで
成功した最後のステップだけが `status: published`、`articlesCreated: 1`、
`shouldPublish: true`を報告します。途中で失敗した場合は成功状態を報告しません。

Daily BlogとGenerate Blogは同じ `github-pages` concurrency groupを使い、CMS更新と
自動投稿の生成・デプロイを直列化します。既存Generate BlogはCMS更新用として維持します。
