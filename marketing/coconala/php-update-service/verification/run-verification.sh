#!/usr/bin/env bash
# PHP更新代行：バックアップ・復元・切り替え・切り戻しの手順の実機検証（このコンテナの中）
#   使い方：bash marketing/coconala/php-update-service/verification/run-verification.sh
#   結果：$LAB/results/results.md（既定 /opt/lab/results/results.md）。内容は 11-verification-report.md にまとめる。
#   お客様のデータは使わない。サイトも認証情報も、すべて検証用のダミー。
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lab.sh"
get_cache
rm -rf "$BACKUPS" "$STATE"; mkdir -p "$BACKUPS" "$STATE"
OUT="$RES/results.md"; : > "$OUT"
FAILS=0
rec() { # ID 内容 結果(PASS/FAIL) 秒 メモ
  [ "$3" = PASS ] || FAILS=$((FAILS+1))
  printf '| %s | %s | %s | %s | %s |\n' "$1" "$2" "$3" "$4" "${5:-}" | tee -a "$OUT"; }
ok() { [ "$1" = 0 ] && echo PASS || echo FAIL; }
{
echo "# 実機検証の結果（$(date '+%Y-%m-%d %H:%M')）"; echo
echo "## 環境"; echo
echo "- OS：$(. /etc/os-release; echo "$PRETTY_NAME")"
echo "- PHP：$(php7.4 -r 'echo PHP_VERSION;') / $(php8.1 -r 'echo PHP_VERSION;') / $(php8.3 -r 'echo PHP_VERSION;')（組み込みサーバーを、版ごとに起動し直して、管理画面の「PHP版の切り替え」を再現）"
echo "- データベース：$(mariadb -uroot -N -e 'select version()')"
echo "- WordPress：$(grep -oP "wp_version = '\K[^']+" "$CACHE/wordpress/wp-includes/version.php")（日本語版）、プラグイン：classic-editor・Contact Form 7 6.1.4（いずれも公式配布）＋検証用の架空プラグイン（legacy-widget）"
echo; echo "## 結果"; echo
echo "| ID | 確認した内容 | 結果 | 秒 | メモ |"; echo "| --- | --- | --- | --- | --- |"; } | tee "$OUT" >/dev/null
cat "$OUT" | tail -n +1 >/dev/null

############################ S1：標準（PHP 8.1 → 8.3、問題なし） ############################
S=std
t=$(now); site_create $S 8.1 8081 0; rec S1-0 "検証用サイトの作成（WordPress＋プラグイン2つ、投稿5・固定ページ1・画像1）" "$(ok $?)" "$(elapsed $t)" "PHP 8.1 で作成"
t=$(now); v=$(site_health_php $S "$ADMIN_USER" "$ADMIN_PASS"); snapshot $S "$LAB/state/$S.before"; b_fatal=$(err_count $S "PHP Fatal"); b_warn=$(err_count $S "PHP Warning")
[ "${v%%.*}.$(echo $v | cut -d. -f2)" = "8.1" ] && r=0 || r=1
rec S1-1 "P1 事前確認：サイトヘルスのPHPの版／主なページ10件の状態と表示を記録／エラーログの基準" "$(ok $r)" "$(elapsed $t)" "サイトヘルス表示：PHP $v、エラーログ（基準）Fatal=$b_fatal Warning=$b_warn"
t=$(now); backup_site $S "$BACKUPS/s1"; msg=$(verify_backup $S "$BACKUPS/s1"); r=$?
rec S1-2 "P2 バックアップ（ファイル＋データベース）と、中身の確認（チェックサム・圧縮の整合・主なファイル・ファイル数・テーブル・権限700）" "$(ok $r)" "$(elapsed $t)" "files $(du -h "$BACKUPS/s1/files.tar.gz" | cut -f1)／db $(du -h "$BACKUPS/s1/db.sql.gz" | cut -f1)${msg:+／$msg}"
############################ S5：確認の仕組みそのものの確認（壊れたバックアップを見つけられるか） ############################
t=$(now); cp -r "$BACKUPS/s1" "$BACKUPS/s5"; head -c $(( $(stat -c %s "$BACKUPS/s5/db.sql.gz") / 2 )) "$BACKUPS/s5/db.sql.gz" > "$BACKUPS/s5/db.tmp" && mv "$BACKUPS/s5/db.tmp" "$BACKUPS/s5/db.sql.gz"
msg=$(verify_backup $S "$BACKUPS/s5"); r=$?
[ $r != 0 ] && rr=0 || rr=1
rec S5-1 "途中で切れたバックアップ（データベースの書き出しが半分）を、中身の確認で見つけられる" "$(ok $rr)" "$(elapsed $t)" "検出：$(echo "$msg" | sed 's/$/；/' | tr -d '\n')"

t=$(now); lint_bad=0; lint_n=0
while IFS= read -r f; do lint_n=$((lint_n+1)); php8.3 -l "$f" >/dev/null 2>&1 || lint_bad=$((lint_bad+1)); done < <(find "$SITES/$S/wp-content/plugins" "$SITES/$S/wp-content/themes" -name '*.php')
scan=$(grep -rEl --include='*.php' 'create_function|[^_a-z>.]each\(|money_format|mysql_(connect|query)\(' "$SITES/$S/wp-content/plugins" "$SITES/$S/wp-content/themes" 2>/dev/null | wc -l)
rec S1-3 "P3 互換性の確認：PHP 8.3 での構文チェック（php -l）と、PHP 8 で削除された関数の検索（*.php のみ）" "$(ok $(( lint_bad + scan )))" "$(elapsed $t)" "PHPファイル${lint_n}件・構文エラー${lint_bad}件・削除された関数を使うファイル${scan}件"
t=$(now); reqs=$(plugin_reqs $S); echo "$reqs" | grep -q "contact-form-7" && r=0 || r=1
rec S1-3b "P3 互換性の確認：有効なプラグインごとに、公式の最新版が必要とするPHPの版を調べる（読み取りだけ）" "$(ok $r)" "$(elapsed $t)" "$(echo "$reqs" | sed 's/$/；/' | tr -d '\n')"
t=$(now); wpc $S 8.1 plugin update contact-form-7 >/dev/null 2>&1; cv=$(wpc $S 8.1 plugin get contact-form-7 --field=version 2>/dev/null | tail -1); [ "$cv" = "6.1.4" ] && r=0 || r=1
rec S1-3c "（参考）PHP 8.1 のままでは、Contact Form 7 を最新版（PHP 8.3 が必要）へ更新できない（WordPressが断る。サイトは変わらない）" "$(ok $r)" "$(elapsed $t)" "更新後の版：$cv（6.1.4のまま）"
wpc $S 8.1 user create tmpwork tmpwork@example.invalid --role=administrator --user_pass='tmp-Work-Pass-5678' >/dev/null
t=$(now); panel_switch $S 8.3; r=$?; v=$(site_health_php $S tmpwork 'tmp-Work-Pass-5678')
[[ "$v" == 8.3.* ]] && [ $r = 0 ] && r=0 || r=1
rec S1-4 "P4 PHPの切り替え（8.1 → 8.3）と、切り替え後の版の確認（サイトヘルス。臨時の管理者ユーザーでログイン）" "$(ok $r)" "$(elapsed $t)" "サイトヘルス表示：PHP $v（今回の修正版 8.3.36 以上か：$([[ "$v" =~ ^8\.3\.([0-9]+)$ && ${BASH_REMATCH[1]} -ge 36 ]] && echo 以上 || echo 未満)）"
t=$(now); snapshot $S "$LAB/state/$S.after"; diff -q "$LAB/state/$S.before" "$LAB/state/$S.after" >/dev/null; r1=$?
admin_ok $S tmpwork 'tmp-Work-Pass-5678'; r2=$?; a_fatal=$(err_count $S "PHP Fatal"); a_warn=$(err_count $S "PHP Warning")
[ $r1 = 0 ] && [ $r2 = 0 ] && [ "$a_fatal" = "$b_fatal" ] && r=0 || r=1
rec S1-5 "P5 更新後の動作確認：主なページ10件の状態コードと表示が更新前と同じ／管理画面（ダッシュボード・投稿作成画面）／エラーログに新しいFatalなし" "$(ok $r)" "$(elapsed $t)" "ページ一致=$([ $r1 = 0 ] && echo はい || echo いいえ)、管理画面=$([ $r2 = 0 ] && echo 開けた || echo 不可)、Fatal $b_fatal→$a_fatal、Warning $b_warn→$a_warn"
t=$(now); wpc $S 8.3 plugin update contact-form-7 >/dev/null 2>&1; cv=$(wpc $S 8.3 plugin get contact-form-7 --field=version 2>/dev/null | tail -1); snapshot $S "$LAB/state/$S.after2"
diff -q "$LAB/state/$S.before" "$LAB/state/$S.after2" >/dev/null; r1=$?; admin_ok $S tmpwork 'tmp-Work-Pass-5678'; r2=$?; [ "$cv" != "6.1.4" ] && [ $r1 = 0 ] && [ $r2 = 0 ] && r=0 || r=1
rec S1-5b "P3の「互換性のための更新」：PHP 8.3 にしたあとに、Contact Form 7 を最新版へ更新できる（8.1のままでは更新できなかった）／更新後も表示・管理画面が変わらない" "$(ok $r)" "$(elapsed $t)" "Contact Form 7：6.1.4 → $cv、表示一致=$([ $r1 = 0 ] && echo はい || echo いいえ)、管理画面=$([ $r2 = 0 ] && echo 開けた || echo 不可)"
t=$(now); wpc $S 8.3 user delete tmpwork --yes >/dev/null; admin_ok $S tmpwork 'tmp-Work-Pass-5678'; [ $? != 0 ] && r=0 || r=1
admin_ok $S "$ADMIN_USER" "$ADMIN_PASS" && r=$r || r=1
rec S1-6 "P7 後片付け：臨時の管理者ユーザーを削除し、そのユーザーでは入れなくなる（既存の管理者は影響なし）" "$(ok $r)" "$(elapsed $t)" ""

############################ S2：古いプラグインがある場合（PHP 7.4 → 8.3、切り戻し） ############################
L=legacy
t=$(now); site_create $L 7.4 8082 1; rec S2-0 "検証用サイトの作成（PHP 7.4。PHP 8 で動かない古い書き方のプラグインつき）" "$(ok $?)" "$(elapsed $t)" "架空のプラグイン legacy-widget（create_function を使用）"
t=$(now); v=$(site_health_php $L "$ADMIN_USER" "$ADMIN_PASS"); snapshot $L "$LAB/state/$L.before"; lb_fatal=$(err_count $L "PHP Fatal")
grep -q "LEGACY" <(page_text "http://127.0.0.1:8082/?p=1") && lg=ある || lg=ない
[[ "$v" == 7.4.* ]] && r=0 || r=1
rec S2-1 "P1 事前確認（PHP 7.4）：サイトヘルスの版、表示の記録（古いプラグインの出力 LEGACY が表示されている）" "$(ok $r)" "$(elapsed $t)" "サイトヘルス表示：PHP $v、LEGACYの表示：$lg"
t=$(now); backup_site $L "$BACKUPS/s2"; msg=$(verify_backup $L "$BACKUPS/s2"); r=$?
rec S2-2 "P2 バックアップと中身の確認" "$(ok $r)" "$(elapsed $t)" "${msg:-}"
t=$(now); lint_bad=0; lint_n=0
while IFS= read -r f; do lint_n=$((lint_n+1)); php8.3 -l "$f" >/dev/null 2>&1 || lint_bad=$((lint_bad+1)); done < <(find "$SITES/$L/wp-content/plugins" "$SITES/$L/wp-content/themes" -name '*.php')
scan=$(grep -rEl --include='*.php' 'create_function|[^_a-z>.]each\(|money_format|mysql_(connect|query)\(' "$SITES/$L/wp-content/plugins" "$SITES/$L/wp-content/themes" 2>/dev/null | sed "s#$SITES/$L/wp-content/##" | tr '\n' ' ')
[ -n "$scan" ] && r=0 || r=1
rec S2-3 "P3 互換性の確認：構文チェック（php -l）は通るが、削除された関数の検索で、問題のあるファイルを検出できる" "$(ok $r)" "$(elapsed $t)" "構文エラー${lint_bad}件（構文チェックだけでは見つからない）。検索で検出：${scan:-なし}"
# テスト環境（オプション2）：バックアップから別の場所に復元し、先に8.3で動かす
t=$(now); restore_site "$BACKUPS/s2" stg 8092 $L; panel_switch stg 7.4; snapshot stg "$LAB/state/stg.on74"
sed "s#8082#8092#g" "$LAB/state/$L.before" > /dev/null
diff <(cut -d' ' -f1,2 "$LAB/state/$L.before") <(cut -d' ' -f1,2 "$LAB/state/stg.on74") >/dev/null; r1=$?
diff <(cut -d' ' -f1,3 "$LAB/state/$L.before") <(cut -d' ' -f1,3 "$LAB/state/stg.on74") >/dev/null; r2=$?
[ $r1 = 0 ] && [ $r2 = 0 ] && r=0 || r=1
rec S2-4 "テスト環境：バックアップから別の場所（別ポート・別データベース）へ復元し、元と同じ版（7.4）で表示が元のサイトと一致する（＝バックアップだけで、サイトが再現できる）" "$(ok $r)" "$(elapsed $t)" "状態コード一致=$([ $r1 = 0 ] && echo はい || echo いいえ)、表示一致=$([ $r2 = 0 ] && echo はい || echo いいえ)"
t=$(now); panel_switch stg 8.3; c=$(http_code "http://127.0.0.1:8092/?p=1"); lg=$(grep -c "create_function" "$LOGS/stg-php-error.log")
[ "$c" = 500 ] && [ "$lg" -ge 1 ] && r=0 || r=1
rec S2-5 "テスト環境で、PHP 8.3 に切り替えて表示を確認 → 不具合を検出（本番を変更せずに、更新できないと判断できる）" "$(ok $r)" "$(elapsed $t)" "ページの状態コード=$c、エラーログの create_function の記録=${lg}件"
# 本番：確認を省いて、そのまま切り替えた場合
t=$(now); panel_switch $L 8.3; c=$(http_code "http://127.0.0.1:8082/?p=1"); d=$(elapsed $t); lg=$(grep -c "create_function" "$LOGS/$L-php-error.log")
[ "$c" = 500 ] && r=0 || r=1
rec S2-6 "（確認を省いた場合の想定）本番を 8.3 に切り替えると、サイトが表示されなくなることを確認" "$(ok $r)" "$d" "状態コード=$c、ログの記録=${lg}件。→ ここで、元の版へ戻す"
t=$(now); panel_switch $L 7.4; snapshot $L "$LAB/state/$L.after"; tables_sum $L > "$LAB/state/$L.tables"
diff -q "$LAB/state/$L.before" "$LAB/state/$L.after" >/dev/null; r1=$?; diff -q "$LAB/state/$L.tables" "$BACKUPS/s2/tables.sum" >/dev/null; r2=$?
admin_ok $L "$ADMIN_USER" "$ADMIN_PASS"; r3=$?
[ $r1 = 0 ] && [ $r2 = 0 ] && [ $r3 = 0 ] && r=0 || r=1
rec S2-7 "切り戻し：元のPHPの版（7.4）に戻し、表示が更新前と一致／データベースの主なテーブルがバックアップと同じ（データを戻さなくてよい）／管理画面に入れる" "$(ok $r)" "$(elapsed $t)" "表示一致=$([ $r1 = 0 ] && echo はい || echo いいえ)、テーブル一致=$([ $r2 = 0 ] && echo はい || echo いいえ)、管理画面=$([ $r3 = 0 ] && echo 開けた || echo 不可)"

############################ S3：最悪の場合（サイトのファイルとデータベースが失われた） ############################
t=$(now); pkill -f "php[0-9.]* .*-S 127.0.0.1:8082 "; rm -rf "$SITES/$L"; dbq "DROP DATABASE lab_$L"
c=$(http_code "http://127.0.0.1:8082/"); [ "$c" != 200 ] && r=0 || r=1
rec S3-1 "（想定）サイトのファイルとデータベースが失われた状態を作る" "$(ok $r)" "$(elapsed $t)" "表示：状態コード=$c（失われた）"
t=$(now); restore_site "$BACKUPS/s2" $L 8082 $L; panel_switch $L 7.4; snapshot $L "$LAB/state/$L.restored"; tables_sum $L > "$LAB/state/$L.tables2"
diff -q "$LAB/state/$L.before" "$LAB/state/$L.restored" >/dev/null; r1=$?; diff -q "$LAB/state/$L.tables2" "$BACKUPS/s2/tables.sum" >/dev/null; r2=$?; admin_ok $L "$ADMIN_USER" "$ADMIN_PASS"; r3=$?
[ $r1 = 0 ] && [ $r2 = 0 ] && [ $r3 = 0 ] && r=0 || r=1
rec S3-2 "バックアップから、同じ場所へ復元：表示が更新前と一致／テーブルが一致／元の管理者でログインできる" "$(ok $r)" "$(elapsed $t)" "表示一致=$([ $r1 = 0 ] && echo はい || echo いいえ)、テーブル一致=$([ $r2 = 0 ] && echo はい || echo いいえ)、管理画面=$([ $r3 = 0 ] && echo 開けた || echo 不可)"

############################ S4：バックアップの保管場所（個人情報の漏えいを防ぐ） ############################
t=$(now); cp "$BACKUPS/s1/db.sql.gz" "$SITES/$S/oops-backup.sql.gz"; c1=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "http://127.0.0.1:8081/oops-backup.sql.gz"); rm -f "$SITES/$S/oops-backup.sql.gz"
c2=$(curl -s -o /dev/null -m 10 -w "%{http_code}" "http://127.0.0.1:8081/s1/db.sql.gz")
[ "$c1" = 200 ] && [ "$c2" = 404 ] && r=0 || r=1
rec S4-1 "バックアップを公開フォルダに置くと、外から取得できてしまう（悪い例）／公開フォルダの外に置けば、取得できない" "$(ok $r)" "$(elapsed $t)" "公開フォルダ内=$c1（取得できた）、公開フォルダ外=$c2。→ 保管先は公開されない場所にする。作業後に、公開フォルダに残っていないか確認する"

echo; echo "合計：失敗 $FAILS 件"; echo "- 失敗：$FAILS 件" >> "$OUT"
exit $FAILS
