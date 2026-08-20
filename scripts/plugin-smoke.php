<?php
/**
 * plugin-smoke.php — prove a mu-plugin RUNS, not merely that it PARSES.
 *
 * WHY THIS EXISTS. v2.9.0 defined vcc_chrome() INSIDE another function's body.
 * `php -l` passed and was RIGHT to: nesting a function is valid PHP and the file
 * parses. But the nested function does not exist until the outer one has run, and
 * vcc_render_nav() calls it before then — so every page fataled with "call to
 * undefined function", including wp-admin. The site was white for five hours.
 *
 * A lint proves a file PARSES. Nothing proved it LOADS. This does.
 *
 * HOW. Define ABSPATH, stub the WordPress functions the file touches at include
 * time, then require it in a real PHP process. Anything that fatals on load takes
 * the process down and we report it. Then assert that every function the file
 * DECLARES is actually defined afterwards — a nested declaration silently is not.
 *
 * THE EXPECTED LIST IS DERIVED FROM THE SOURCE, NEVER TYPED. This workflow has
 * been bitten twice by checkers that knew less than the thing they checked: a
 * version grep that compared nothing, and a file list that went blind the day a
 * third plugin was added. Add a function to a plugin and it is covered here
 * automatically; there is no list to forget to update.
 *
 * Usage:  php scripts/plugin-smoke.php <file.php> [more.php ...]
 * Exit:   0 all clean · 1 a plugin failed to load or lost a declaration
 */

if ($argc < 2) {
    fwrite(STDERR, "usage: php plugin-smoke.php <plugin.php> [...]\n");
    exit(2);
}

// ABSPATH must exist or every mu-plugin returns at line 1 and we would "pass"
// a file we never actually loaded — a check that examines nothing.
if (!defined('ABSPATH')) define('ABSPATH', sys_get_temp_dir() . '/');

/* WordPress surface touched at include time. No-ops: we are proving the file
 * LOADS, not that WordPress behaves. Registration calls are recorded so the
 * report can show the plugin actually wired something up. */
$GLOBALS['__smoke_hooks'] = ['actions' => [], 'shortcodes' => [], 'filters' => []];
if (!function_exists('add_action')) {
    function add_action($h, $cb = null, $p = 10, $a = 1) { $GLOBALS['__smoke_hooks']['actions'][] = $h; return true; }
}
if (!function_exists('add_shortcode')) {
    function add_shortcode($t, $cb = null) { $GLOBALS['__smoke_hooks']['shortcodes'][] = $t; return true; }
}
if (!function_exists('add_filter')) {
    function add_filter($h, $cb = null, $p = 10, $a = 1) { $GLOBALS['__smoke_hooks']['filters'][] = $h; return true; }
}
foreach ([
    'wp_parse_url','wp_remote_get','wp_remote_retrieve_body','wp_remote_retrieve_response_code',
    'is_wp_error','get_transient','set_transient','esc_html','esc_attr','esc_url','wp_kses_post',
    'get_field','is_admin','has_shortcode','wp_get_attachment_image_url','sanitize_text_field',
    'shortcode_atts','wp_json_encode','trailingslashit','untrailingslashit','get_option',
    'wp_enqueue_style','wp_enqueue_script','plugin_dir_url','add_options_page',
    'acf_add_options_page','acf_add_options_sub_page','acf_add_local_field_group','wp_nav_menu',
] as $fn) {
    if (!function_exists($fn)) {
        eval("function {$fn}() { return null; }");
    }
}

/** Named functions the source DECLARES. Closures have no name and are skipped. */
function smoke_declared_functions(string $src): array {
    preg_match_all('/^[ \t]*function\s+([a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)\s*\(/m', $src, $m);
    return array_values(array_unique($m[1]));
}

$failed = 0;
foreach (array_slice($argv, 1) as $file) {
    if (!is_file($file)) { fwrite(STDERR, "::error::no such file: {$file}\n"); $failed = 1; continue; }

    $src      = file_get_contents($file);
    $declared = smoke_declared_functions($src);
    $before   = get_defined_functions()['user'];

    // A fatal here kills the process; the shutdown handler names the file.
    $GLOBALS['__smoke_current'] = $file;
    register_shutdown_function(function () {
        $e = error_get_last();
        if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_COMPILE_ERROR, E_CORE_ERROR], true)) {
            fwrite(STDERR, "::error file={$GLOBALS['__smoke_current']}::FATAL on load — {$e['message']} (line {$e['line']})\n");
        }
    });
    require_once $file;

    $after   = get_defined_functions()['user'];
    $gained  = array_diff($after, $before);
    $missing = [];
    foreach ($declared as $fn) {
        if (!function_exists($fn)) $missing[] = $fn;
    }

    $name = basename($file);
    if ($missing) {
        fwrite(STDERR, "::error file={$file}::declared but NOT defined after load: " . implode(', ', $missing) . "\n");
        fwrite(STDERR, "      A function declared inside another function's body does not exist until that\n");
        fwrite(STDERR, "      outer function runs. This is what took the site down on v2.9.0.\n");
        $failed = 1;
    } else {
        printf("  OK   %-28s loaded; %d declared, %d defined\n", $name, count($declared), count($gained));
    }
    if (!$declared) {
        fwrite(STDERR, "::warning file={$file}::declares no named functions — nothing to assert\n");
    }
}

$h = $GLOBALS['__smoke_hooks'];
printf("  hooks registered: %d action(s), %d shortcode(s), %d filter(s)\n",
    count($h['actions']), count($h['shortcodes']), count($h['filters']));

exit($failed);
