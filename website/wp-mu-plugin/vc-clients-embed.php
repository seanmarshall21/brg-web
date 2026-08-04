<?php
/**
 * Plugin Name: VC-Clients Embed
 * Description: Vivo Creative client sites built as code-driven HTML fragments on Netlify, rendered natively via shortcodes (no iframe). Per-client pages are driven by a repo manifest (pages.json) + shared assets — so adding a page NEVER requires editing this file. Namespaced to coexist with FC-Brands Embed.
 * Version: 2.0.0
 * Author: Vivo Creative
 *
 * ── INSTALL ONCE. DO NOT EDIT AFTER INSTALL. ─────────────────────────────────
 *   Upload to  /wp-content/mu-plugins/vc-clients-embed.php   (auto-activates).
 *   Everything page-specific (markup, animations, scripts) lives in the client's
 *   Netlify repo and is pulled at render time. You only touch this file to add a
 *   whole new CLIENT (rare) — never to add a page.
 *
 * USE (WP page / Oxygen Shortcode element — NOT an Oxygen Text element):
 *   [brg page="community"]     → BRG Community page   (generic form, always works)
 *   [brg_community]            → same page            (per-page alias, from pages.json)
 *   [brg_home ttl="0"]         → no server cache (put on TEST pages for instant edits)
 *   ?brg_refresh=1 on the URL  → bust the cache immediately
 *
 * ADD A PAGE (no code pasted on the site):
 *   1. Claude adds  website/<slug>/embed.html  + a line in  website/pages.json ; push.
 *   2. You create the WP page and drop  [brg page="<slug>"]  (or [brg_<slug>]). Done.
 *
 * Output carries  <!-- vc_embed <client>/<slug> vX.Y.Z -->  so the live version is verifiable.
 */
if ( ! defined( 'ABSPATH' ) ) return;

if ( ! defined( 'VCC_VERSION' ) ) define( 'VCC_VERSION', '2.0.0' );
if ( ! defined( 'VCC_TTL' ) )     define( 'VCC_TTL', 120 ); // default cache seconds

/* ── CLIENTS — the ONLY thing you edit here, and only to add a new client. ──── */
$GLOBALS['VCC_CLIENTS'] = array(
  'brg' => array(
    'base'     => 'https://blacktoprg.netlify.app', // Netlify site (publish dir = website/)
    'manifest' => '/pages.json',                    // list of pages Claude maintains
    'assets'   => array( '/assets/brgw.css', '/assets/brgw.js' ), // shared, inlined once/page
  ),
  // 'acme' => array('base'=>'https://acme-web.netlify.app','manifest'=>'/pages.json','assets'=>array('/assets/acme.css','/assets/acme.js')),
);

/* ── Fetch a repo file (transient-cached; ttl=0 or ?brg_refresh=1 = always fresh) ── */
if ( ! function_exists( 'vcc_fetch' ) ) {
    function vcc_fetch( $url, $ttl ) {
        $host = wp_parse_url( $url, PHP_URL_HOST );
        if ( ! $host || ! preg_match( '/\.netlify\.app$/', $host ) ) return ''; // netlify only
        $key = 'vcc_' . md5( $url );
        if ( $ttl > 0 ) { $c = get_transient( $key ); if ( $c !== false ) return $c; }
        $res = wp_remote_get( $url, array( 'timeout' => 8 ) );
        if ( is_wp_error( $res ) || wp_remote_retrieve_response_code( $res ) !== 200 ) {
            $stale = get_transient( $key . '_stale' );     // serve last-good rather than nothing
            return $stale !== false ? $stale : '';
        }
        $body = wp_remote_retrieve_body( $res );
        if ( $ttl > 0 ) set_transient( $key, $body, $ttl );
        set_transient( $key . '_stale', $body, WEEK_IN_SECONDS );
        return $body;
    }
}

/* ── Shared HEADER (nav built from the repo manifest) + FOOTER ─────────────── */
if ( ! function_exists( 'vcc_chrome' ) ) {
    function vcc_chrome( $cfg, $current_slug ) {
        $manifest = vcc_fetch( rtrim( $cfg['base'], '/' ) . $cfg['manifest'], VCC_TTL );
        $pages    = $manifest ? json_decode( $manifest, true ) : array();
        $links = '';
        if ( is_array( $pages ) ) {
            foreach ( $pages as $pg ) {
                $slug  = is_array( $pg ) ? ( isset( $pg['slug'] ) ? $pg['slug'] : '' ) : ( is_string( $pg ) ? $pg : '' );
                $slug  = preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $slug ) );
                if ( $slug === '' ) continue;
                $title = is_array( $pg ) && isset( $pg['title'] ) ? $pg['title'] : ucwords( str_replace( '-', ' ', $slug ) );
                $url   = ( $slug === 'home' ) ? '/' : '/' . $slug . '/';
                $cls   = ( $slug === $current_slug ) ? ' class="is-active"' : '';
                $links .= '<a href="' . esc_url( $url ) . '"' . $cls . '>' . esc_html( $title ) . '</a>';
            }
        }
        $header = '<header class="brgw-header"><a class="brgw-logo" href="/"><b>BLACKTOP</b>'
                . '<span>Restaurant Group</span></a><nav class="brgw-nav">' . $links . '</nav></header>';
        $footer = '<footer class="brgw__footer reveal"><div class="lockup anim-up"><b>BLACKTOP</b><br>Restaurant Group</div></footer>';
        return array( $header, $footer );
    }
}

/* ── Render a client page fragment inline (shared CSS → markup → shared JS) ──── */
if ( ! function_exists( 'vcc_render_page' ) ) {
    function vcc_render_page( $client, $slug, $atts ) {
        $cfg = isset( $GLOBALS['VCC_CLIENTS'][ $client ] ) ? $GLOBALS['VCC_CLIENTS'][ $client ] : null;
        if ( ! $cfg ) return '<!-- vc_embed: unknown client -->';

        $slug = preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $slug ) );
        if ( $slug === '' ) return '';

        $ttl  = isset( $atts['ttl'] ) ? max( 0, intval( $atts['ttl'] ) ) : VCC_TTL;
        if ( isset( $_GET['brg_refresh'] ) ) $ttl = 0;
        $base = rtrim( $cfg['base'], '/' );

        $frag = vcc_fetch( $base . '/' . $slug . '/embed.html', $ttl );
        if ( $frag === '' ) return '<!-- vc_embed: ' . esc_html( $client . '/' . $slug ) . ' fragment not found -->';

        // Shared assets (tokens/reveal engine) inlined ONCE per client per request.
        static $shared = array();
        $css = ''; $js = '';
        if ( empty( $shared[ $client ] ) ) {
            $shared[ $client ] = true;
            foreach ( $cfg['assets'] as $a ) {
                $body = vcc_fetch( $base . $a, $ttl );
                if ( $body === '' ) continue;
                if ( substr( $a, -4 ) === '.css' )      $css .= '<style id="vcc-' . esc_attr( $client ) . '-css">' . $body . '</style>';
                else if ( substr( $a, -3 ) === '.js' )  $js  .= '<script id="vcc-' . esc_attr( $client ) . '-js">' . $body . '</script>';
            }
        }

        // Wrap in an outer .brgw shell with shared header + footer (chrome="0" to skip).
        $chrome = ! ( isset( $atts['chrome'] ) && $atts['chrome'] === '0' );
        list( $header, $footer ) = $chrome ? vcc_chrome( $cfg, $slug ) : array( '', '' );

        $out = "\n<!-- vc_embed " . esc_html( $client . '/' . $slug ) . ' v' . VCC_VERSION . " -->\n"
             . $css
             . '<div class="brgw brgw-shell">' . $header . $frag . $footer . '</div>'
             . $js;

        // WordPress/Oxygen runs do_shortcode again on rendered content; neutralise any
        // literal [brg… token in our output so it can't recursively re-expand.
        $out = preg_replace( '/\[(' . preg_quote( $client, '/' ) . '[_a-z0-9-]*)/', '[' . "\xE2\x80\x8B" . '$1', $out );
        return $out;
    }
}

/* ── Register shortcodes: generic [client] + per-page [client_slug] from manifest ── */
add_action( 'init', function () {
    foreach ( $GLOBALS['VCC_CLIENTS'] as $client => $cfg ) {

        // Generic form — always works, needs no manifest: [brg page="community"]
        add_shortcode( $client, function ( $atts ) use ( $client ) {
            $atts = is_array( $atts ) ? $atts : array();
            $slug = isset( $atts['page'] ) ? $atts['page'] : 'home';
            return vcc_render_page( $client, $slug, $atts );
        } );

        // Per-page aliases [brg_<slug>] read from the repo manifest (cached).
        $manifest = vcc_fetch( rtrim( $cfg['base'], '/' ) . $cfg['manifest'], VCC_TTL );
        $pages    = $manifest ? json_decode( $manifest, true ) : array();
        if ( is_array( $pages ) ) {
            foreach ( $pages as $pg ) {
                $slug = is_array( $pg ) ? ( isset( $pg['slug'] ) ? $pg['slug'] : '' ) : ( is_string( $pg ) ? $pg : '' );
                $slug = preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $slug ) );
                if ( $slug === '' ) continue;
                add_shortcode( $client . '_' . $slug, function ( $atts ) use ( $client, $slug ) {
                    return vcc_render_page( $client, $slug, is_array( $atts ) ? $atts : array() );
                } );
            }
        }
    }
}, 20 );

/* Generic one-off (rare): [vc_embed url="https://xxx.netlify.app/foo/embed.html"] */
add_shortcode( 'vc_embed', function ( $atts ) {
    $a = shortcode_atts( array( 'url' => '', 'ttl' => (string) VCC_TTL ), $atts, 'vc_embed' );
    if ( ! $a['url'] ) return '<!-- vc_embed: no url -->';
    $ttl = isset( $_GET['brg_refresh'] ) ? 0 : max( 0, intval( $a['ttl'] ) );
    $body = vcc_fetch( $a['url'], $ttl );
    return $body !== '' ? $body : '<!-- vc_embed: fetch failed -->';
} );
