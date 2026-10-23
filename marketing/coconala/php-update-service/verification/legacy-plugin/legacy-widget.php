<?php
/**
 * Plugin Name: Legacy Widget（検証用・架空）
 * Description: PHP 7系では動き、PHP 8では動かない、古い書き方（create_function）を使う検証用プラグイン。お客様のものではなく、実在しない。
 * Version: 0.1
 */
if (!defined('ABSPATH')) { exit; }

// create_function は PHP 8.0 で削除された。PHP 7.4 では動く（非推奨の警告のみ）。
add_action('init', function () {
    $f = create_function('$a', 'return strtoupper($a);');
    $GLOBALS['legacy_widget_text'] = $f('legacy');
});

add_filter('the_content', function ($content) {
    return $content . '<p class="legacy-widget">' . esc_html($GLOBALS['legacy_widget_text'] ?? '') . '</p>';
});
