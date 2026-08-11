<?php
/**
 * Plugin Name: VC-Clients Embed
 * Description: Vivo Creative client sites built as code-driven HTML fragments on Netlify, rendered natively via shortcodes (no iframe). Pages AND sections are driven by repo manifests (pages.json + sections.json) + shared assets — so adding a page or a section NEVER requires editing this file. Namespaced to coexist with FC-Brands Embed.
 * Version: 2.2.0
 * Author: Vivo Creative
 *
 * ── INSTALL ONCE. DO NOT EDIT AFTER INSTALL. ─────────────────────────────────
 *   Upload to  /wp-content/mu-plugins/vc-clients-embed.php   (auto-activates).
 *   Everything page/section-specific (markup, animations, scripts) lives in the
 *   client's Netlify repo and is pulled at render time. You only touch this file
 *   to add a whole new CLIENT (rare) — never to add a page or a section.
 *
 * USE (WP page / Oxygen Shortcode element — NOT an Oxygen Text element):
 *   Whole-page (v2.0 monolith, still supported):
 *     [brg_community]            → the whole Community page fragment + chrome
 *     [brg page="community"]     → same, generic form
 *   Stacked sections (v2.1):
 *     [brg_nav]                  → shared header/nav (auto-highlights the current page)
 *     [brg_community-hero]       → website/sections/community-hero/embed.html (no chrome)
 *     [brg_section id="cta-band" heading="Apply today"]  → generic form + {{slot}} overrides
 *     [brg_footer]               → shared footer
 *   Any shortcode: add ttl="0" (no server cache) on test pages, or ?brg_refresh=1 on the URL.
 *   A page is EITHER one monolith shortcode OR [brg_nav] + sections + [brg_footer] — not both
 *   (mixing would double the chrome).
 *
 * ADD A PAGE:     Claude adds website/<slug>/embed.html + a line in pages.json; push.
 * ADD A SECTION:  Claude adds website/sections/<id>/embed.html + a line in sections.json; push.
 *                 Then drop [brg_<id>] on the WP page. No plugin change either way.
 *
 * Output carries  <!-- vc_embed <client>/<what> vX.Y.Z -->  so the live version is verifiable.
 */
if ( ! defined( 'ABSPATH' ) ) return;

if ( ! defined( 'VCC_VERSION' ) ) define( 'VCC_VERSION', '2.2.0' );
if ( ! defined( 'VCC_TTL' ) )     define( 'VCC_TTL', 120 ); // default cache seconds

/* ── CLIENTS — the ONLY thing you edit here, and only to add a new client. ──── */
$GLOBALS['VCC_CLIENTS'] = array(
  'brg' => array(
    'base'     => 'https://blacktoprg.netlify.app', // Netlify site (publish dir = website/)
    'manifest' => '/pages.json',                    // list of pages Claude maintains
    'sections' => '/sections.json',                 // list of stackable sections
    'assets'   => array( '/assets/brgw.css', '/assets/brgw.js', '/assets/brgw-nav.css', '/assets/brgw-nav.js' ), // shared, inlined once/page
    // Nav is WordPress-MENU driven (Appearance → Menus). [brg_nav] runs wp_nav_menu() for this location.
    'nav_menu' => 'brg_primary',                    // registered menu location (Manage Locations)
    'nav_logo' => '/assets/media/logos/logo-brg-nav-sm.svg',
    'home_url' => '/brg-home/',                      // logo link + home
  ),
  // 'acme' => array('base'=>'https://acme-web.netlify.app','manifest'=>'/pages.json','sections'=>'/sections.json','assets'=>array('/assets/acme.css','/assets/acme.js')),
);

/* ── Register WordPress menu LOCATIONS so nav content is managed in WP (not code).
      User assigns a menu under Appearance → Menus → Manage Locations, exactly like Temper. ── */
add_action( 'after_setup_theme', function () {
    register_nav_menus( array(
        'brg_primary' => 'BRG — Primary',
        'brg_social'  => 'BRG — Social',
    ) );
} );

/* ── ttl for a shortcode call (ttl="N" attr, or 0 via ?brg_refresh=1) ───────── */
if ( ! function_exists( 'vcc_ttl' ) ) {
    function vcc_ttl( $atts ) {
        $ttl = ( is_array( $atts ) && isset( $atts['ttl'] ) ) ? max( 0, intval( $atts['ttl'] ) ) : VCC_TTL;
        if ( isset( $_GET['brg_refresh'] ) ) $ttl = 0;
        return $ttl;
    }
}

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

/* ── Shared assets (tokens/reveal engine) — emitted ONCE per client per request.
      Lifted out of vcc_render_page so the section & chrome renderers share the
      same static: a page mixing a monolith + sections inlines brgw.css/js once. ── */
if ( ! function_exists( 'vcc_shared_assets' ) ) {
    function vcc_shared_assets( $client, $cfg, $ttl ) {
        static $shared = array();
        if ( ! empty( $shared[ $client ] ) ) return array( '', '' );
        $shared[ $client ] = true;
        $css = ''; $js = ''; $base = rtrim( $cfg['base'], '/' );
        foreach ( $cfg['assets'] as $a ) {
            $body = vcc_fetch( $base . $a, $ttl );
            if ( $body === '' ) continue;
            if ( substr( $a, -4 ) === '.css' )      $css .= '<style id="vcc-' . esc_attr( $client ) . '-css">' . $body . '</style>';
            else if ( substr( $a, -3 ) === '.js' )  $js  .= '<script id="vcc-' . esc_attr( $client ) . '-js">' . $body . '</script>';
        }
        return array( $css, $js );
    }
}

/* ── Neutralise any literal [client… token in our output (WP re-runs do_shortcode
      on rendered content) so it can't recursively re-expand. ─────────────────── */
if ( ! function_exists( 'vcc_guard' ) ) {
    function vcc_guard( $client, $out ) {
        return preg_replace( '/\[(' . preg_quote( $client, '/' ) . '[_a-z0-9-]*)/', '[' . "\xE2\x80\x8B" . '$1', $out );
    }
}

/* ── The current WP page's slug (for nav auto-highlight when [brg_nav] has no active=) ── */
if ( ! function_exists( 'vcc_current_slug' ) ) {
    function vcc_current_slug() {
        $q = get_queried_object();
        return ( $q && isset( $q->post_name ) ) ? $q->post_name : '';
    }
}

/* ── Shared HEADER (nav built from pages.json) + FOOTER ─────────────────────── */
if ( ! function_exists( 'vcc_chrome' ) ) {
    function vcc_chrome( $cfg, $current_slug ) {
        $manifest = vcc_fetch( rtrim( $cfg['base'], '/' ) . $cfg['manifest'], VCC_TTL );
        $pages    = $manifest ? json_decode( $manifest, true ) : array();
        // current request path, e.g. "brg-home" — lets a page at a non-matching URL
        // (Home lives at /brg-home/) still highlight via its manifest "url" override.
        $req_path = isset( $_SERVER['REQUEST_URI'] ) ? trim( (string) wp_parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ), '/' ) : '';
        $links = ''; $home_url = '/';
        if ( is_array( $pages ) ) {
            foreach ( $pages as $pg ) {
                $slug  = is_array( $pg ) ? ( isset( $pg['slug'] ) ? $pg['slug'] : '' ) : ( is_string( $pg ) ? $pg : '' );
                $slug  = preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $slug ) );
                if ( $slug === '' ) continue;
                $title = is_array( $pg ) && isset( $pg['title'] ) ? $pg['title'] : ucwords( str_replace( '-', ' ', $slug ) );
                // URL: explicit manifest "url" wins, else home→"/", others→"/slug/".
                $url   = ( is_array( $pg ) && ! empty( $pg['url'] ) ) ? $pg['url'] : ( ( $slug === 'home' ) ? '/' : '/' . $slug . '/' );
                if ( $slug === 'home' ) $home_url = $url;
                $upath = trim( (string) wp_parse_url( $url, PHP_URL_PATH ), '/' );
                $active = ( $slug === $current_slug ) || ( $upath !== '' && $upath === $req_path );
                $cls    = $active ? ' class="is-active"' : '';
                $links .= '<a href="' . esc_url( $url ) . '"' . $cls . '>' . esc_html( $title ) . '</a>';
            }
        }
        $header = '<header class="brgw-header"><a class="brgw-logo" href="' . esc_url( $home_url ) . '"><b>BLACKTOP</b>'
                . '<span>Restaurant Group</span></a><nav class="brgw-nav">' . $links . '</nav></header>';
        $footer = '<footer class="brgw__footer reveal"><div class="lockup anim-up"><b>BLACKTOP</b><br>Restaurant Group</div></footer>';
        return array( $header, $footer );
    }
}

/* ── Fill {{slot}} tokens in a section fragment from sections.json + shortcode atts.
      Whitelisted by the manifest; escaped by declared type. Leftover tokens stripped. ── */
if ( ! function_exists( 'vcc_fill_slots' ) ) {
    function vcc_fill_slots( $frag, $id, $atts, $cfg, $ttl ) {
        $slots = array();
        if ( isset( $cfg['sections'] ) ) {
            $man  = vcc_fetch( rtrim( $cfg['base'], '/' ) . $cfg['sections'], $ttl > 0 ? $ttl : VCC_TTL );
            $data = $man ? json_decode( $man, true ) : null;
            if ( is_array( $data ) && ! empty( $data['sections'] ) && is_array( $data['sections'] ) ) {
                foreach ( $data['sections'] as $s ) {
                    if ( isset( $s['id'] ) && $s['id'] === $id && ! empty( $s['slots'] ) && is_array( $s['slots'] ) ) { $slots = $s['slots']; break; }
                }
            }
        }
        foreach ( $slots as $key => $def ) {
            $type    = ( is_array( $def ) && isset( $def['type'] ) )    ? $def['type']    : 'text';
            $default = ( is_array( $def ) && isset( $def['default'] ) ) ? $def['default'] : '';
            $val     = ( is_array( $atts ) && isset( $atts[ $key ] ) )  ? $atts[ $key ]   : $default;
            if      ( $type === 'url' )  $val = esc_url( $val );
            else if ( $type === 'html' ) $val = wp_kses_post( $val );
            else                         $val = esc_html( $val );
            $frag = str_replace( '{{' . $key . '}}', $val, $frag );
        }
        return preg_replace( '/\{\{[a-z0-9_]+\}\}/i', '', $frag ); // strip any leftover tokens
    }
}

/* ── Render a whole-page fragment inline (v2.0 monolith: chrome + page) ──────── */
if ( ! function_exists( 'vcc_render_page' ) ) {
    function vcc_render_page( $client, $slug, $atts ) {
        $cfg = isset( $GLOBALS['VCC_CLIENTS'][ $client ] ) ? $GLOBALS['VCC_CLIENTS'][ $client ] : null;
        if ( ! $cfg ) return '<!-- vc_embed: unknown client -->';

        $slug = preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $slug ) );
        if ( $slug === '' ) return '';

        $ttl  = vcc_ttl( $atts );
        $base = rtrim( $cfg['base'], '/' );

        $frag = vcc_fetch( $base . '/' . $slug . '/embed.html', $ttl );
        if ( $frag === '' ) return '<!-- vc_embed: ' . esc_html( $client . '/' . $slug ) . ' fragment not found -->';

        list( $css, $js ) = vcc_shared_assets( $client, $cfg, $ttl );

        // Chrome unless chrome="0".
        $chrome = ! ( is_array( $atts ) && isset( $atts['chrome'] ) && $atts['chrome'] === '0' );
        list( $header, $footer ) = $chrome ? vcc_chrome( $cfg, $slug ) : array( '', '' );

        $out = "\n<!-- vc_embed " . esc_html( $client . '/' . $slug ) . ' v' . VCC_VERSION . " -->\n"
             . $css
             . '<div class="brgw brgw-shell">' . $header . $frag . $footer . '</div>'
             . $js;
        return vcc_guard( $client, $out );
    }
}

/* ── Render a single SECTION fragment inline (v2.1: no chrome) ──────────────── */
if ( ! function_exists( 'vcc_render_section' ) ) {
    function vcc_render_section( $client, $id, $atts ) {
        $cfg = isset( $GLOBALS['VCC_CLIENTS'][ $client ] ) ? $GLOBALS['VCC_CLIENTS'][ $client ] : null;
        if ( ! $cfg ) return '<!-- vc_embed: unknown client -->';

        $id = preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $id ) );
        if ( $id === '' ) return '';

        $ttl  = vcc_ttl( $atts );
        $base = rtrim( $cfg['base'], '/' );

        $frag = vcc_fetch( $base . '/sections/' . $id . '/embed.html', $ttl );
        if ( $frag === '' ) return '<!-- vc_embed: ' . esc_html( $client . '/section/' . $id ) . ' not built yet -->';

        $frag = vcc_fill_slots( $frag, $id, $atts, $cfg, $ttl );

        // Optional anchor: inject id="…" onto the fragment's root element.
        if ( is_array( $atts ) && ! empty( $atts['anchor'] ) ) {
            $anchor = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $atts['anchor'] );
            if ( $anchor !== '' ) $frag = preg_replace( '/<(section|div)\b/', '<$1 id="' . esc_attr( $anchor ) . '"', $frag, 1 );
        }

        list( $css, $js ) = vcc_shared_assets( $client, $cfg, $ttl );

        $out = "\n<!-- vc_embed " . esc_html( $client . '/section/' . $id ) . ' v' . VCC_VERSION . " -->\n"
             . $css
             . '<div class="brgw brgw-shell">' . $frag . '</div>'
             . $js;
        return vcc_guard( $client, $out );
    }
}

/* ── Render just the chrome header or footer (v2.1: [brg_nav] / [brg_footer]) ── */
if ( ! function_exists( 'vcc_render_chrome' ) ) {
    function vcc_render_chrome( $client, $which, $atts ) {
        $cfg = isset( $GLOBALS['VCC_CLIENTS'][ $client ] ) ? $GLOBALS['VCC_CLIENTS'][ $client ] : null;
        if ( ! $cfg ) return '';
        $ttl    = vcc_ttl( $atts );
        $active = ( is_array( $atts ) && ! empty( $atts['active'] ) )
                  ? preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $atts['active'] ) )
                  : vcc_current_slug();
        list( $header, $footer ) = vcc_chrome( $cfg, $active );
        list( $css, $js )        = vcc_shared_assets( $client, $cfg, $ttl );
        $piece = ( $which === 'footer' ) ? $footer : $header;
        $out = "\n<!-- vc_embed " . esc_html( $client . '/' . $which ) . ' v' . VCC_VERSION . " -->\n"
             . $css
             . '<div class="brgw brgw-shell">' . $piece . '</div>'
             . $js;
        return vcc_guard( $client, $out );
    }
}

/* ── Render the WP-menu-driven nav (v2.2: [brg_nav]). Content = wp_nav_menu() for the
      configured location; styling/behaviour = brgw-nav.css/js. brgw-nav.js injects the
      pen-stroke marker underline + builds the mobile takeover from the same menu. ──── */
if ( ! function_exists( 'vcc_render_nav' ) ) {
    function vcc_render_nav( $client, $atts ) {
        $cfg = isset( $GLOBALS['VCC_CLIENTS'][ $client ] ) ? $GLOBALS['VCC_CLIENTS'][ $client ] : null;
        if ( ! $cfg ) return '';
        $ttl  = vcc_ttl( $atts );
        $base = rtrim( $cfg['base'], '/' );
        $home = isset( $cfg['home_url'] ) ? $cfg['home_url'] : '/';
        $loc  = isset( $cfg['nav_menu'] ) ? $cfg['nav_menu'] : '';
        $logo = isset( $cfg['nav_logo'] ) ? $base . $cfg['nav_logo'] : '';

        $menu = '';
        if ( $loc && function_exists( 'has_nav_menu' ) && has_nav_menu( $loc ) ) {
            $menu = wp_nav_menu( array(
                'theme_location' => $loc, 'container' => false, 'menu_class' => 'nav-src',
                'echo' => false, 'fallback_cb' => false, 'depth' => 2,
            ) );
        }
        if ( ! is_string( $menu ) || $menu === '' ) {
            // No menu assigned yet — a helpful, unstyled note instead of a blank bar.
            $menu = '<ul class="nav-src"><li><a class="bnav-link" href="' . esc_url( admin_url( 'nav-menus.php?action=locations' ) )
                  . '">Assign a menu to “BRG — Primary” in Appearance → Menus → Manage Locations</a></li></ul>';
        }

        $header = '<header class="bnav">'
                . '<a class="bnav-logo" href="' . esc_url( $home ) . '" aria-label="Blacktop Restaurant Group — home">'
                . ( $logo ? '<img src="' . esc_url( $logo ) . '" alt="Blacktop Restaurant Group">' : '' )
                . '</a>'
                . $menu
                . '<button class="bnav-ham" aria-label="Menu"><i></i><i></i></button>'
                . '</header>';

        list( $css, $js ) = vcc_shared_assets( $client, $cfg, $ttl );
        $out = "\n<!-- vc_embed " . esc_html( $client . '/nav' ) . ' v' . VCC_VERSION . " -->\n"
             . $css . '<div class="brgw brgw-shell">' . $header . '</div>' . $js;
        return vcc_guard( $client, $out );
    }
}

/* ── Register shortcodes from the manifests (adding a page/section needs no edit here) ── */
add_action( 'init', function () {
    foreach ( $GLOBALS['VCC_CLIENTS'] as $client => $cfg ) {

        // Generic whole-page form: [brg page="community"]
        add_shortcode( $client, function ( $atts ) use ( $client ) {
            $atts = is_array( $atts ) ? $atts : array();
            $slug = isset( $atts['page'] ) ? $atts['page'] : 'home';
            return vcc_render_page( $client, $slug, $atts );
        } );

        // Generic section form: [brg_section id="cta-band" heading="…"]
        add_shortcode( $client . '_section', function ( $atts ) use ( $client ) {
            $atts = is_array( $atts ) ? $atts : array();
            $id   = isset( $atts['id'] ) ? $atts['id'] : '';
            return $id === '' ? '<!-- vc_embed: section id missing -->' : vcc_render_section( $client, $id, $atts );
        } );

        // Nav: [brg_nav] = WP-menu-driven header (v2.2). Footer stays the simple lockup.
        add_shortcode( $client . '_nav', function ( $atts ) use ( $client ) {
            return vcc_render_nav( $client, is_array( $atts ) ? $atts : array() );
        } );
        add_shortcode( $client . '_footer', function ( $atts ) use ( $client ) {
            return vcc_render_chrome( $client, 'footer', is_array( $atts ) ? $atts : array() );
        } );

        // Per-page aliases [brg_<slug>] from pages.json (whole-page monolith).
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

        // Per-section aliases [brg_<id>] from sections.json. Registered even for
        // status:stub ids so a page never shows a raw [brg_…] token — a not-yet-built
        // section renders an invisible comment until its fragment lands.
        if ( ! empty( $cfg['sections'] ) ) {
            $smanifest = vcc_fetch( rtrim( $cfg['base'], '/' ) . $cfg['sections'], VCC_TTL );
            $sdata     = $smanifest ? json_decode( $smanifest, true ) : null;
            if ( is_array( $sdata ) && ! empty( $sdata['sections'] ) && is_array( $sdata['sections'] ) ) {
                foreach ( $sdata['sections'] as $s ) {
                    $id = isset( $s['id'] ) ? preg_replace( '/[^a-z0-9-]/', '', strtolower( (string) $s['id'] ) ) : '';
                    if ( $id === '' ) continue;
                    add_shortcode( $client . '_' . $id, function ( $atts ) use ( $client, $id ) {
                        return vcc_render_section( $client, $id, is_array( $atts ) ? $atts : array() );
                    } );
                }
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
