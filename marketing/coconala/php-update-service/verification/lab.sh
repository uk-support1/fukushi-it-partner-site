#!/usr/bin/env bash
# PHP更新代行：手順の実機検証用の環境（このコンテナの中だけ。お客様のデータは使わない）
#
# 「サーバー会社の管理画面」の代わりに、PHPの組み込みサーバーを版ごとに起動し直す（panel_switch）ことで、
# 「PHPの版の切り替え」と「元に戻す」を再現する。バックアップ・復元・動作確認の手順そのものは、
# 03-work-procedure.md と同じ（ファイル＋データベースの取得、中身の確認、別の場所への復元、ページの比較）。
# ※サーバー会社の管理画面・バックアップ機能の検証ではない（11-verification-report.md の「できていないこと」）。
#
# 必要なもの：php7.4 / php8.1 / php8.3 のCLI（mysqli つき）、MariaDB（またはMySQL）、curl、python3、tar、gzip、
#            WordPress の tar.gz と wp-cli.phar（$LAB/cache/ に置く。get_cache で取得できる）
LAB=${LAB:-/opt/lab}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITES="$LAB/sites"; BACKUPS="$LAB/backups"; LOGS="$LAB/logs"; STATE="$LAB/state"; RES="$LAB/results"; CACHE="$LAB/cache"
WPCLI="$CACHE/wp-cli.phar"; WPTGZ="$CACHE/wp-ja.tar.gz"
ADMIN_USER=labadmin; ADMIN_PASS='lab-only-Pass-1234'      # 検証用のダミー（実在のアカウントではない）
export PHP_CLI_SERVER_WORKERS=4
mkdir -p "$SITES" "$BACKUPS" "$LOGS" "$STATE" "$RES" "$CACHE"

now() { date +%s.%N; }
elapsed() { awk -v a="$1" -v b="$(now)" 'BEGIN{printf "%.1f", b-a}'; }
dbq() { mariadb -uroot -N -e "$1" 2>/dev/null; }

get_cache() {
  [ -s "$WPCLI" ] && file "$WPCLI" 2>/dev/null | grep -qi php || curl -sSL -m 120 -o "$WPCLI" https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
  if [ ! -s "$WPTGZ" ]; then curl -sSL -m 300 -o "$WPTGZ" https://ja.wordpress.org/latest-ja.tar.gz; fi
  [ -d "$CACHE/wordpress" ] || tar -xzf "$WPTGZ" -C "$CACHE"
}

# wp-cli（実行するPHPの版を指定する）
wpc() { local site=$1 php=$2; shift 2; "php$php" -d memory_limit=512M "$WPCLI" --allow-root --path="$SITES/$site" --url="http://127.0.0.1:$(cat "$STATE/$site.port")" "$@" 2>&1; }

# ---- 「サーバー会社の管理画面でPHPの版を切り替える」の再現 ----
panel_switch() { # site ver
  local site=$1 ver=$2 port; port=$(cat "$STATE/$site.port")
  pkill -f "php[0-9.]* .*-S 127.0.0.1:$port " 2>/dev/null; sleep 0.5
  : > /dev/null
  nohup "php$ver" -d error_log="$LOGS/$site-php-error.log" -d log_errors=1 -d display_errors=0 -d error_reporting=32767 \
        -S "127.0.0.1:$port" -t "$SITES/$site" >/dev/null 2>&1 &
  echo "$ver" > "$STATE/$site.php"
  local i; for i in $(seq 1 40); do curl -s -o /dev/null -m 2 "http://127.0.0.1:$port/wp-login.php" && return 0; sleep 0.5; done
  return 1
}
panel_current() { cat "$STATE/$1.php"; }

site_destroy() { local site=$1 db; db="lab_$site"; pkill -f "php[0-9.]* .*-S 127.0.0.1:$(cat "$STATE/$site.port" 2>/dev/null || echo 0) " 2>/dev/null
  dbq "DROP DATABASE IF EXISTS $db"; rm -rf "$SITES/$site" "$LOGS/$site-php-error.log"; }

# お客様のサイトに見立てた、WordPressのサイトを作る
site_create() { # site php port [legacy=0|1]
  local site=$1 php=$2 port=$3 legacy=${4:-0} db="lab_$1"
  site_destroy "$site"
  echo "$port" > "$STATE/$site.port"
  cp -r "$CACHE/wordpress" "$SITES/$site"
  dbq "CREATE DATABASE $db CHARACTER SET utf8mb4; CREATE USER IF NOT EXISTS '$db'@'localhost' IDENTIFIED BY 'labdb-$site'; GRANT ALL ON $db.* TO '$db'@'localhost'; FLUSH PRIVILEGES"
  wpc "$site" "$php" config create --dbname="$db" --dbuser="$db" --dbpass="labdb-$site" --dbhost=localhost --skip-check >/dev/null
  panel_switch "$site" "$php" || return 1
  wpc "$site" "$php" core install --title="検証用サイト $site" --admin_user="$ADMIN_USER" --admin_password="$ADMIN_PASS" --admin_email=lab@example.invalid --skip-email >/dev/null
  wpc "$site" "$php" language core install ja --activate >/dev/null 2>&1
  wpc "$site" "$php" rewrite structure '' >/dev/null
  local i; for i in 1 2 3 4; do wpc "$site" "$php" post create --post_title="お知らせ $i" --post_content="これは検証用のお知らせ $i の本文です。検索用の言葉 test。" --post_status=publish >/dev/null; done
  wpc "$site" "$php" post create --post_type=page --post_title="事業所案内" --post_content="検証用の固定ページです。" --post_status=publish >/dev/null
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' | base64 -d > "$LAB/cache/lab.png"
  wpc "$site" "$php" media import "$LAB/cache/lab.png" --title="検証用画像" >/dev/null
  wpc "$site" "$php" plugin install classic-editor --activate >/dev/null
  wpc "$site" "$php" plugin install contact-form-7 --version=6.1.4 --activate >/dev/null   # 最新版（6.2系）は PHP 8.3 以上が必要。古い版を入れて、お客様のサイトを再現
  if [ "$legacy" = 1 ]; then mkdir -p "$SITES/$site/wp-content/plugins/legacy-widget"; cp "$HERE/legacy-plugin/legacy-widget.php" "$SITES/$site/wp-content/plugins/legacy-widget/"; wpc "$site" "$php" plugin activate legacy-widget >/dev/null 2>&1; fi
  : > "$LOGS/$site-php-error.log"
}

# ---- 画面の確認（動作確認の自動化。手作業のときは目で見る） ----
page_text() { # url -> 表示されている文字だけを取り出す（日付・認証用の乱数は除く）
  curl -sL -m 20 "$1" | python3 -I -c '
import sys,re
h=sys.stdin.read()
h=re.sub(r"(?is)<(script|style).*?</\1>","",h); h=re.sub(r"(?s)<!--.*?-->","",h); h=re.sub(r"<[^>]+>"," ",h)
h=re.sub(r"[0-9a-f]{10}","#",h); print(re.sub(r"\s+"," ",h).strip())'
}
http_code() { curl -sL -o /dev/null -m 20 -w "%{http_code}" "$1"; }
snapshot() { # site outfile：主なページ（公開中の投稿・固定ページ）の状態コードと、表示の文字のハッシュ
  local p ids id u out=""; p=$(cat "$STATE/$1.port"); local b="http://127.0.0.1:$p"
  ids=$(dbq "SELECT ID FROM lab_$1.wp_posts WHERE post_status='publish' AND post_type IN ('post','page') ORDER BY ID LIMIT 8")
  for u in "/" $(for id in $ids; do echo "/?p=$id"; done) "/?s=test" "/wp-login.php"; do
    out+="$u $(http_code "$b$u") $(page_text "$b$u" | sha256sum | cut -c1-16)"$'\n'; done
  printf '%s' "$out" > "$2"
}
admin_ok() { # site user pass：ログインして、管理画面（ダッシュボード・投稿の作成画面）が開けるか
  local p jar; p=$(cat "$STATE/$1.port"); jar=$(mktemp)
  curl -s -m 20 -c "$jar" -b "wordpress_test_cookie=WP%20Cookie%20check" -o /dev/null \
       --data-urlencode "log=$2" --data-urlencode "pwd=$3" --data-urlencode "redirect_to=http://127.0.0.1:$p/wp-admin/" --data "testcookie=1" "http://127.0.0.1:$p/wp-login.php"
  local c1 c2; c1=$(curl -s -m 20 -b "$jar" -o /dev/null -w "%{http_code}" "http://127.0.0.1:$p/wp-admin/")
  c2=$(curl -s -m 20 -b "$jar" -o /dev/null -w "%{http_code}" "http://127.0.0.1:$p/wp-admin/post-new.php")
  rm -f "$jar"; [ "$c1" = 200 ] && [ "$c2" = 200 ]
}
site_health_php() { # site user pass：サイトヘルス（情報）に表示される、PHPの版
  local p jar html; p=$(cat "$STATE/$1.port"); jar=$(mktemp)
  curl -s -m 20 -c "$jar" -b "wordpress_test_cookie=WP%20Cookie%20check" -o /dev/null --data-urlencode "log=$2" --data-urlencode "pwd=$3" --data "testcookie=1" "http://127.0.0.1:$p/wp-login.php"
  curl -s -m 30 -b "$jar" "http://127.0.0.1:$p/wp-admin/site-health.php?tab=debug" | python3 -I -c '
import sys,re
h=sys.stdin.read()
m=re.search(r"PHP[^<]{0,12}(?:バージョン|version)[^0-9]{0,200}?(\d+\.\d+\.\d+)",h,re.I|re.S)
print(m.group(1) if m else "不明")'
  rm -f "$jar"
}
err_count() { grep -c "$2" "$LOGS/$1-php-error.log" 2>/dev/null || true; }

# ---- バックアップ・復元 ----
tables_sum() { dbq "CHECKSUM TABLE lab_$1.wp_posts, lab_$1.wp_postmeta, lab_$1.wp_users, lab_$1.wp_usermeta, lab_$1.wp_terms, lab_$1.wp_term_relationships, lab_$1.wp_comments" | awk '{print $1" "$2}' | sed "s/lab_[a-z0-9_]*\.//"; }
backup_site() { # site dir：ファイル＋データベース。保管先は、公開されないフォルダ
  local site=$1 dir=$2; mkdir -p "$dir"; chmod 700 "$dir"
  tar -czf "$dir/files.tar.gz" -C "$SITES" "$site"
  mariadb-dump -uroot --single-transaction --default-character-set=utf8mb4 "lab_$site" | gzip > "$dir/db.sql.gz"
  (cd "$dir" && sha256sum files.tar.gz db.sql.gz > SHA256SUMS)
  tables_sum "$site" > "$dir/tables.sum"
}
verify_backup() { # site dir：取っただけで終わりにしない（03-work-procedure.md §4-2）。失敗した項目を出力
  local site=$1 dir=$2 bad=0
  (cd "$dir" && sha256sum -c SHA256SUMS >/dev/null 2>&1) || { echo "チェックサム不一致"; bad=1; }
  gzip -t "$dir/files.tar.gz" 2>/dev/null && gzip -t "$dir/db.sql.gz" 2>/dev/null || { echo "圧縮ファイルが壊れている"; bad=1; }
  local list; list=$(tar -tzf "$dir/files.tar.gz")
  for need in "$site/wp-config.php" "$site/wp-content/uploads" "$site/wp-content/plugins/contact-form-7"; do echo "$list" | grep -q "^$need" || { echo "ファイルに含まれていない: $need"; bad=1; }; done
  local nfiles; nfiles=$(find "$SITES/$site" -type f | wc -l); local ntar; ntar=$(echo "$list" | grep -vc '/$')
  [ "$ntar" -ge "$nfiles" ] || { echo "ファイル数が少ない: サイト$nfiles / バックアップ$ntar"; bad=1; }
  local sql; sql=$(gunzip -c "$dir/db.sql.gz")
  echo "$sql" | grep -q 'CREATE TABLE `wp_posts`' || { echo "データベースに wp_posts がない"; bad=1; }
  echo "$sql" | grep -q 'INSERT INTO `wp_posts`' || { echo "wp_posts のデータがない"; bad=1; }
  echo "$sql" | grep -q "siteurl" || { echo "設定（siteurl）がない"; bad=1; }
  [ "$(stat -c %a "$dir")" = 700 ] || { echo "保管先の権限が広い"; bad=1; }
  return $bad
}
restore_site() { # backupdir site port [dbname]：バックアップから、新しい場所または同じ場所へ復元
  local dir=$1 newsite=$2 port=$3 old=$4 db="lab_$2" tmp; tmp=$(mktemp -d)
  site_destroy "$newsite"; echo "$port" > "$STATE/$newsite.port"
  tar -xzf "$dir/files.tar.gz" -C "$tmp"; mv "$tmp/$old" "$SITES/$newsite"; rmdir "$tmp"
  dbq "CREATE DATABASE $db CHARACTER SET utf8mb4; CREATE USER IF NOT EXISTS '$db'@'localhost' IDENTIFIED BY 'labdb-$newsite'; GRANT ALL ON $db.* TO '$db'@'localhost'; FLUSH PRIVILEGES"
  gunzip -c "$dir/db.sql.gz" | mariadb -uroot "$db"
  # 別の名前へ復元するときは、設定（データベース名・パスワード）を直す。URLのポートも合わせる
  sed -i "s/lab_$old/$db/g; s/labdb-$old/labdb-$newsite/g" "$SITES/$newsite/wp-config.php"
  local oldport; oldport=$(grep -o "127.0.0.1:[0-9]*" <<<"$(gunzip -c "$dir/db.sql.gz" | grep -m1 "'siteurl'")" | head -1 | cut -d: -f2)
  [ "$oldport" != "$port" ] && dbq "UPDATE $db.wp_options SET option_value=REPLACE(option_value,'127.0.0.1:$oldport','127.0.0.1:$port') WHERE option_name IN ('siteurl','home')"
  return 0
}

# 有効なプラグインごとに、今の版と、WordPress.org の最新版が必要とするPHPの版を調べる（読み取りだけ。互換性の確認の一部）
plugin_reqs() { # site
  local site=$1 slugs; slugs=$(dbq "SELECT option_value FROM lab_$site.wp_options WHERE option_name='active_plugins'" | grep -oP 's:\d+:"\K[^/"]+(?=/)' | tr '\n' ' ')
  local slug cur req latest
  for slug in $slugs; do
    cur=$(grep -hm1 -i '^[ */#]*Version:' "$SITES/$site/wp-content/plugins/$slug/"*.php 2>/dev/null | head -1 | sed 's/.*Version:[ ]*//I' | tr -d '\r ')
    read -r latest req < <(curl -s -m 20 "https://api.wordpress.org/plugins/info/1.0/$slug.json" | python3 -I -c 'import sys,json
try:
  d=json.load(sys.stdin); print(d.get("version","-"), d.get("requires_php") or "-")
except Exception: print("- -")')
    echo "$slug 現在=${cur:-不明} 最新=$latest 最新版が必要とするPHP=$req"
  done
}
