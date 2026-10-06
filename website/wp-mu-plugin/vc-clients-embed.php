<?php
/**
 * Plugin Name: VC-Clients Embed
 * Description: Vivo Creative client sites built as code-driven HTML fragments on Netlify, rendered natively via shortcodes (no iframe). Pages AND sections are driven by repo manifests (pages.json + sections.json) + shared assets — so adding a page or a section NEVER requires editing this file. Namespaced to coexist with FC-Brands Embed.
 * Version: 2.14.0
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

if ( ! defined( 'VCC_VERSION' ) ) define( 'VCC_VERSION', '2.14.0' );
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
    'nav_social' => 'brg_social',                   // optional; blank or unassigned = no social row
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

/* ── BRAND INFO — one source of truth for values used on more than one page ──
 *
 * Ported from Oak + Elm (oak-elm-embed.php, plugin 1.7.8) at Sean's instruction, including
 * the traps its author paid for, so the two sites share one vocabulary.
 *
 * TWO FORMS, because a link and a sentence need different escaping:
 *     #brand-email        in an href / src          -> esc_url()
 *     [brand email]       anywhere in text          -> esc_html()
 * Both resolve in PHP at render. Nothing reaches the browser unresolved.
 *
 * AN UNKNOWN KEY LEAVES ITS TOKEN ON THE PAGE. This is the one place this build DEPARTS
 * from Oak + Elm, deliberately. There, a typo like [brand emial] renders as an empty
 * string — the sentence silently loses a word and nothing says so. This project has
 * already been bitten by exactly that: unresolved {{tokens}} were stripped and emptied
 * live copy with no error. Their author's own advice was "render the raw token, or log
 * it, rather than ''". A visible [brand emial] on the page is ugly and gets fixed in a
 * minute; an invisible deletion is found by a customer.
 *
 * A KNOWN KEY THAT IS EMPTY still resolves to empty, which is intentional and different:
 * that is an editor choosing not to supply a value, not a mistake.
 *
 * THE KEY LIST IS AN ALLOW-LIST, not a pattern. #brand-<anything> would otherwise read
 * any option in the database by name. It also satisfies build-acf.py's reader check,
 * which requires each chrome field to appear literally in this file — a field nobody
 * reads is a field the editor fills to no effect.
 * Keys must match website/chrome/brand/slots.json. --check enforces that in one direction;
 * adding a key there without adding it here fails the build rather than failing quietly. */
if ( ! function_exists( 'vcc_brand_keys' ) ) {
    function vcc_brand_keys() {
        /* TOKEN KEY => OPTION NAME, written out rather than composed with
         * 'brg_brand_' . $key. Composing it reads as tidier and is worse twice over: the
         * option names then exist nowhere in this file, so build-acf.py's reader check —
         * which greps for each literal — reports all ten fields as "accepts input that
         * changes nothing", and a human grepping for brg_brand_phone finds no reader
         * either. The check is right to insist: a field nobody reads is a field the editor
         * fills to no effect, and that is listed as something that has already bitten this
         * project twice. The map is also the allow-list; #brand-<anything> cannot reach an
         * option that is not named here. */
        return array(
            'name'          => 'brg_brand_name',
            'email'         => 'brg_brand_email',
            'phone'         => 'brg_brand_phone',
            'address'       => 'brg_brand_address',
            'careers_email' => 'brg_brand_careers_email',
            'instagram'     => 'brg_brand_instagram',
            'facebook'      => 'brg_brand_facebook',
            'tiktok'        => 'brg_brand_tiktok',
            'linkedin'      => 'brg_brand_linkedin',
            'privacy'       => 'brg_brand_privacy',
            'footer_logo'   => 'brg_brand_footer_logo',
        );
    }
}

/* The raw saved value, falling back to the default declared in slots.json — the same
 * precedence a section slot gets, so one place defines a default and the admin and the
 * page cannot disagree about it. */
if ( ! function_exists( 'vcc_brand' ) ) {
    function vcc_brand( $key, $cfg = null ) {
        static $defaults = null;
        $map = vcc_brand_keys();
        if ( ! isset( $map[ $key ] ) ) return null;                      // null = unknown key
        $val = function_exists( 'get_field' ) ? get_field( $map[ $key ], 'option' ) : '';
        $val = is_string( $val ) ? trim( $val ) : '';
        if ( $val !== '' ) return $val;
        if ( $defaults === null ) {
            $defaults = array();
            if ( ! $cfg && isset( $GLOBALS['VCC_CLIENTS']['brg'] ) ) $cfg = $GLOBALS['VCC_CLIENTS']['brg'];
            if ( is_array( $cfg ) && ! empty( $cfg['base'] ) ) {
                $raw = vcc_fetch( rtrim( $cfg['base'], '/' ) . '/chrome/brand/slots.json', VCC_TTL );
                $d   = $raw ? json_decode( $raw, true ) : null;
                if ( is_array( $d ) ) foreach ( $d as $k => $v ) {
                    if ( strpos( (string) $k, '_' ) !== 0 && is_array( $v ) && isset( $v['default'] ) ) {
                        $defaults[ $k ] = (string) $v['default'];
                    }
                }
            }
        }
        return isset( $defaults[ $key ] ) ? $defaults[ $key ] : '';
    }
}

/* mailto: for an address, tel: for a number, the value as typed for anything else.
 * The tel: form keeps only digits and a leading +, because a number written for READING
 * — (760) 555-0134 — is not a number a phone can dial. */
if ( ! function_exists( 'vcc_brand_link' ) ) {
    function vcc_brand_link( $key ) {
        $v = vcc_brand( $key );
        if ( $v === null || $v === '' ) return '';
        if ( $key === 'email' || $key === 'careers_email' ) return 'mailto:' . $v;
        if ( $key === 'phone' ) {
            $digits = preg_replace( '/(?!^\+)[^0-9]/', '', $v );
            return $digits !== '' ? 'tel:' . $digits : '';
        }
        return $v;
    }
}

if ( ! function_exists( 'vcc_brand_resolve' ) ) {
    function vcc_brand_resolve( $html, $cfg = null ) {
        if ( ! is_string( $html ) || $html === '' ) return $html;
        if ( strpos( $html, 'brand-' ) === false && strpos( $html, '[brand ' ) === false ) return $html;

        /* Links first. Only inside an attribute, so a #brand- written in prose is left for
         * the text pass rather than being silently turned into a URL. */
        $html = preg_replace_callback(
            '/(href|src)="#brand-([a-z0-9_]+)"/i',
            function ( $m ) {
                $url = vcc_brand_link( strtolower( $m[2] ) );
                if ( $url === '' ) return $m[0];     // unknown or unset: leave it visible
                return $m[1] . '="' . esc_url( $url ) . '"';
            }, $html );

        $html = preg_replace_callback(
            '/\[brand\s+([a-z0-9_]+)\]/i',
            function ( $m ) {
                $v = vcc_brand( strtolower( $m[1] ) );
                if ( $v === null ) return $m[0];     // unknown key: leave the token ON THE PAGE
                return esc_html( $v );
            }, $html );

        return $html;
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

/* ── Neutralize any literal [client… token in our output (WP re-runs do_shortcode
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
        /* LinkedIn, bottom right — BugHerd #32, reported by joyce@blacktoprg.com 14 Sep.
         * A LUCIDE LINE ICON drawn inline, per the house rule: no emoji, and no second
         * request for a 1KB mark. stroke="currentColor" so it inherits the footer's color
         * rather than carrying a hex that has to be kept in step with the palette.
         * aria-label, not title text: the link has no visible words, so without it a screen
         * reader announces "link" and nothing else. */
        /* THE URL NOW COMES FROM BRAND INFO, not from this line. It was hardcoded here an
         * hour ago; leaving it would have made the footer the second place the address
         * lives, which is the exact duplication Brand info exists to end. The address in
         * the ticket is the DEFAULT in website/chrome/brand/slots.json, so this renders
         * identically with nothing saved, and changing it in wp-admin changes it here.
         * An empty value hides the link rather than linking to nowhere. */
        $li_url = vcc_brand_link( 'linkedin' );
        $li     = '';
        if ( $li_url !== '' ) {
        $li  = '<a class="brgw__social" href="' . esc_url( $li_url ) . '"'
             . ' target="_blank" rel="noopener noreferrer" aria-label="Blacktop Restaurant Group on LinkedIn">'
             . '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"'
             . ' stroke-linejoin="round" aria-hidden="true" focusable="false">'
             . '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>'
             . '<rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg></a>';
        }
        /* THE LOCKUP IS ARTWORK, NOT TYPE. brgw.css replaces this element's text with a
         * background image and pushes the words off-screen (text-indent:-200vw), keeping
         * them only as the accessible name. So the editable thing here is the IMAGE — a
         * field for "BLACKTOP" would have let someone retype a word nobody can see and
         * wonder why the footer never changed. The name comes from Brand info too, so the
         * announced name and the company name cannot drift apart. */
        /* THE FOOTER TAB. Same three routes as the header: sizes become custom properties,
         * choices become data-attributes, text is printed. The logo and the social links
         * still come from Brand info, because that is where the company's details live —
         * this tab governs how they are PRESENTED, not what they are. */
        $logo = vcc_chrome_setting( 'footer', 'logo' );
        if ( $logo === '' ) $logo = vcc_brand( 'footer_logo' );
        $name = vcc_brand( 'name' );
        if ( $name === '' || $name === null ) $name = 'Blacktop Restaurant Group';

        $fvars = '';
        $fw = intval( vcc_chrome_setting( 'footer', 'logo_width' ) );
        /* THE BOUNDS HERE AND THE FIELD'S min/max MUST AGREE. They did not: the field offered
         * up to 720 and Sean typed 800, so this test silently threw it away and the logo stayed
         * at the stylesheet's 360 default — a number accepted by the box and discarded on the
         * way to the page, with nothing to say so. Both are 120–960 now. */
        if ( $fw >= 120 && $fw <= 960 )           $fvars .= '--brgw-footer-logo-w:' . $fw . 'px;';
        $pt = intval( vcc_chrome_setting( 'footer', 'pad_top' ) );
        $pb = intval( vcc_chrome_setting( 'footer', 'pad_bottom' ) );
        if ( $pt >= 0 && $pt <= 180 ) $fvars .= '--brgw-footer-pt:' . $pt . 'px;';
        if ( $pb >= 0 && $pb <= 180 ) $fvars .= '--brgw-footer-pb:' . $pb . 'px;';
        $ss = intval( vcc_chrome_setting( 'footer', 'social_size' ) );
        if ( $ss >= 12 && $ss <= 48 )  $fvars .= '--brgw-footer-social:' . $ss . 'px;';

        $falign  = vcc_chrome_setting( 'footer', 'align' );
        $fsocial = vcc_chrome_setting( 'footer', 'show_social' ) === '0' ? '0' : '1';
        $fhref   = vcc_chrome_setting( 'footer', 'logo_href' );
        $flegal  = vcc_chrome_setting( 'footer', 'legal' );

        /* LEGAL LINKS, written as "Label|/path" and separated by commas — the shape an editor
         * can hold in their head. Anything without a pipe is skipped rather than rendered as
         * a link to nowhere. */
        /* LEGAL LINKS — one per line, "Words|/path". Sean, 4 Oct: "I just don't know where
         * or how to input it in here." The format was only ever stated inside the field's
         * help tooltip, which is a place nobody looks. The field is a multi-line box now so
         * it is visibly a list, and this parser stopped being fussy:
         *   - lines are the separator; a single line of comma-separated pairs still works,
         *     which is what the field used to ask for;
         *   - the bar is optional. A bare /privacy-policy/ becomes "Privacy Policy", so
         *     pasting a path does the obvious thing instead of silently rendering nothing. */
        $flinksRaw = vcc_chrome_setting( 'footer', 'links' );
        $flinks = '';
        if ( is_string( $flinksRaw ) && trim( $flinksRaw ) !== '' ) {
            $lines = preg_split( '/[\r\n]+/', trim( $flinksRaw ) );
            if ( count( $lines ) === 1 && strpos( $lines[0], ',' ) !== false ) {
                $lines = explode( ',', $lines[0] );           // the old single-line format
            }
            $items = array();
            foreach ( $lines as $pair ) {
                $pair = trim( $pair );
                if ( $pair === '' ) continue;
                if ( strpos( $pair, '|' ) !== false ) {
                    list( $lbl, $href ) = array_map( 'trim', explode( '|', $pair, 2 ) );
                } else {
                    $href = $pair;
                    $segs = array_values( array_filter( explode( '/', (string) parse_url( $href, PHP_URL_PATH ) ) ) );
                    $slug = $segs ? end( $segs ) : $href;
                    $lbl  = ucwords( str_replace( array( '-', '_' ), ' ', $slug ) );
                }
                if ( $lbl === '' || $href === '' ) continue;
                $items[] = '<a href="' . esc_url( $href ) . '">' . esc_html( $lbl ) . '</a>';
            }
            if ( $items ) $flinks = '<span class="legal-links">' . implode( '', $items ) . '</span>';
        }

        /* A REAL <img>, so the logo carries its own proportions — see the note on .lockup in
         * brgw.css. The literal below is the same fallback the stylesheet used to hold, kept
         * so the footer can never render with no logo at all. The company name becomes the
         * image's alt text, which is what a screen reader should read out. */
        $logo_src = ( is_string( $logo ) && $logo !== '' )
            ? $logo
            : 'https://blacktoprg.netlify.app/assets/media/logos/logo-brg-footer-lg.svg';
        $lock = '<img class="lockup anim-up" src="' . esc_url( $logo_src ) . '"'
              . ' alt="' . esc_attr( $name ) . '" decoding="async">';
        if ( is_string( $fhref ) && $fhref !== '' ) {
            $lock = '<a class="lockup-link" href="' . esc_url( $fhref ) . '">' . $lock . '</a>';
        }
        /* {year} IS FILLED IN HERE, then corrected by the browser. PHP renders the year the
         * page was BUILT, and a cached page can outlive a New Year — so the markup carries
         * a span that brgw.js resets to the real current year on load. Without JS the server
         * value still shows, which is right every day but a handful. Escape first, then swap
         * the token: {year} has no HTML-special characters, so it survives esc_html intact. */
        $legalHtml = esc_html( $flegal );
        if ( strpos( $legalHtml, '{year}' ) !== false ) {
            $legalHtml = str_replace( '{year}',
                '<span data-brgw-year>' . esc_html( date_i18n( 'Y' ) ) . '</span>', $legalHtml );
        }
        $lalign = vcc_chrome_setting( 'footer', 'legal_align' );
        if ( ! in_array( $lalign, array( 'left', 'center', 'right' ), true ) ) $lalign = 'left';
        $small = ( $legalHtml !== '' || $flinks !== '' )
               ? '<p class="legal anim-up" data-legal-align="' . esc_attr( $lalign ) . '">'
                 . ( $legalHtml !== '' ? '<span class="legal-text">' . $legalHtml . '</span>' : '' )
                 . $flinks . '</p>' : '';

        $footer = '<footer class="brgw__footer reveal" data-align="' . esc_attr( $falign ) . '"'
                . ' data-social="' . esc_attr( $fsocial ) . '"'
                . ( $fvars !== '' ? ' style="' . esc_attr( $fvars ) . '"' : '' ) . '>'
                . $lock
                . ( $fsocial === '1' ? $li : '' )
                . $small
                . '</footer>';
        return array( $header, $footer );
    }
}

/* ── Fill {{slot}} tokens in a section fragment. Slots come from sections/<id>/slots.json,
      falling back to the inline `slots` block in sections.json. Whitelisted by the declaration;
      escaped by declared type. Leftover tokens stripped. ── */
if ( ! function_exists( 'vcc_fill_slots' ) ) {
    function vcc_fill_slots( $frag, $id, $atts, $cfg, $ttl ) {
        $slots = array();
        // PREFERRED: website/sections/<id>/slots.json — beside the fragment, same owner as the
        // {{tokens}}, so a slot and its token ship in one commit. Mirrors kit/build-acf.py
        // slots_for(). It lives inside the publish dir, so it is already served by the CDN.
        //
        // This was missed when the declarations moved (v2.5.0 read sections.json ONLY). The
        // failure mode was silent and destructive rather than merely wrong: with slots declared
        // in slots.json and the inline block gone, the plugin finds zero slots and :196 strips
        // every {{token}} — an empty button and an empty line of copy on the live page.
        $base = rtrim( $cfg['base'], '/' );
        $cttl = $ttl > 0 ? $ttl : VCC_TTL;
        $raw  = vcc_fetch( $base . '/sections/' . rawurlencode( $id ) . '/slots.json', $cttl );
        if ( $raw ) {
            $d = json_decode( $raw, true );
            if ( is_array( $d ) ) {
                foreach ( $d as $k => $v ) {
                    // `_`-prefixed keys are documentation, not slots (build-acf.py does the same).
                    if ( strpos( (string) $k, '_' ) !== 0 ) $slots[ $k ] = $v;
                }
            }
        }
        if ( ! $slots && isset( $cfg['sections'] ) ) {
            $man  = vcc_fetch( rtrim( $cfg['base'], '/' ) . $cfg['sections'], $ttl > 0 ? $ttl : VCC_TTL );
            $data = $man ? json_decode( $man, true ) : null;
            if ( is_array( $data ) && ! empty( $data['sections'] ) && is_array( $data['sections'] ) ) {
                foreach ( $data['sections'] as $s ) {
                    if ( isset( $s['id'] ) && $s['id'] === $id && ! empty( $s['slots'] ) && is_array( $s['slots'] ) ) { $slots = $s['slots']; break; }
                }
            }
        }
        /* ── REPEATERS ─────────────────────────────────────────────────────────────
         * Runs BEFORE the scalar pass, because a row template contains {{name.sub}}
         * tokens that the scalar pass would strip as unknown.
         *
         * Grammar, in the fragment:
         *
         *   <!--brg:repeat members-->
         *     <div class="card">{{members.name}} — {{members.title}}</div>
         *   <!--brg:empty-->
         *     whatever should render when nobody has been added yet
         *   <!--/brg:repeat-->
         *
         * The brg:empty half is not decoration. Without it, wiring a repeater would take
         * a section that renders nine cards today to one that renders none the moment the
         * template lands and before anyone has typed a row — a live regression caused by
         * shipping the mechanism. With it, the current markup stays put until there is
         * something to replace it.
         *
         * Sub-values are escaped by their DECLARED sub-type, same rule as scalars, so an
         * image sub-field still goes through esc_url and a text one through esc_html.
         */
        if ( strpos( $frag, '<!--brg:repeat' ) !== false ) {
            $frag = preg_replace_callback(
                '/<!--brg:repeat\s+([a-z0-9_]+)-->([\s\S]*?)<!--\/brg:repeat-->/i',
                function ( $m ) use ( $slots, $id ) {
                    $name = $m[1];
                    $body = $m[2];
                    $tpl  = $body;
                    $empty = '';
                    if ( strpos( $body, '<!--brg:empty-->' ) !== false ) {
                        list( $tpl, $empty ) = explode( '<!--brg:empty-->', $body, 2 );
                    }

                    $def  = isset( $slots[ $name ] ) && is_array( $slots[ $name ] ) ? $slots[ $name ] : array();
                    $subs = isset( $def['sub'] ) && is_array( $def['sub'] ) ? $def['sub'] : array();

                    $rows = array();
                    if ( function_exists( 'get_field' ) ) {
                        $v = get_field( 'brg_' . str_replace( '-', '_', $id ) . '_' . $name, 'option' );
                        if ( is_array( $v ) ) $rows = $v;
                    }
                    if ( ! $rows ) return $empty;

                    $out = '';
                    foreach ( $rows as $row ) {
                        if ( ! is_array( $row ) ) continue;
                        $piece = $tpl;
                        foreach ( $subs as $sk => $sdef ) {
                            $stype = is_array( $sdef ) && isset( $sdef['type'] ) ? $sdef['type'] : 'text';
                            $sval  = isset( $row[ $sk ] ) ? $row[ $sk ] : '';
                            if ( $stype === 'image' ) {
                                if ( is_array( $sval ) && isset( $sval['url'] ) ) $sval = $sval['url'];
                                else if ( is_numeric( $sval ) )                    $sval = wp_get_attachment_image_url( (int) $sval, 'full' );
                                $sval = esc_url( (string) $sval );
                            }
                            else if ( $stype === 'url' )  $sval = esc_url( (string) $sval );
                            else if ( $stype === 'html' ) $sval = wp_kses_post( (string) $sval );
                            else                          $sval = esc_html( (string) $sval );
                            $piece = str_replace( '{{' . $name . '.' . $sk . '}}', $sval, $piece );
                        }
                        // Any sub-token the row does not carry is stripped, not left visible.
                        $piece = preg_replace( '/\{\{' . preg_quote( $name, '/' ) . '\.[a-z0-9_-]+\}\}/i', '', $piece );
                        $out  .= $piece;
                    }
                    return $out;
                },
                $frag
            );
        }

        /* Images whose value came from the EDITOR rather than the built-in default. Collected
         * so the srcset can be dropped from those tags below — see the note after the loop. */
        $swapped_images = array();

        foreach ( $slots as $key => $def ) {
            $type    = ( is_array( $def ) && isset( $def['type'] ) )    ? $def['type']    : 'text';
            $default = ( is_array( $def ) && isset( $def['default'] ) ) ? $def['default'] : '';
            // Precedence: shortcode attr override > ACF option value > default.
            // ACF field name = brg_<section-id with _>_<slot>, read from the "Section Content"
            // options page (see website/wp-snippets/brg-section-content-options.php + the acf.json).
            if ( is_array( $atts ) && isset( $atts[ $key ] ) ) {
                $val = $atts[ $key ];
            } else {
                $val = $default;
                if ( function_exists( 'get_field' ) ) {
                    $acf = 'brg_' . str_replace( '-', '_', $id ) . '_' . $key;
                    $v   = get_field( $acf, 'option' );
                    if ( $v !== null && $v !== false && $v !== '' && $v !== array() ) {
                        $val = $v;
                    } else {
                        /* AN EMPTIED BOX MEANS AN EMPTY PAGE. Sean, 3 Oct: "I tried to delete
                         * this intro paragraph… If I have nothing in this box, then there
                         * shouldn't be anything there."
                         *
                         * Until now a blank value fell back to the built-in default, so there
                         * was NO WAY to remove a paragraph from the admin — you cleared the
                         * box, saved, and the old wording came straight back with nothing to
                         * explain why.
                         *
                         * The two states look identical to get_field(), which returns '' both
                         * for a field nobody has ever touched and one deliberately emptied.
                         * The OPTION ROW tells them apart: ACF writes options_<name> the first
                         * time a group is saved, so an absent row means untouched and an
                         * existing row holding '' means cleared on purpose. That distinction
                         * is the whole reason this is safe — a section nobody has opened still
                         * renders its built-in copy exactly as before.
                         *
                         * Deliberately NOT applied to images: an empty image is already a
                         * supported state everywhere (no hero photo, no section background),
                         * and those fragments key their own layout off an empty value. */
                        if ( $type !== 'image' ) {
                            $raw = get_option( 'options_' . $acf, null );
                            if ( $raw !== null && $raw !== false ) $val = '';
                        }
                    }
                }
            }
            if ( $type === 'image' ) {                       // ACF image → URL (array / id / url)
                $was_default = ( $val === $default );
                if ( is_array( $val ) && isset( $val['url'] ) ) $val = $val['url'];
                else if ( is_numeric( $val ) )                  $val = wp_get_attachment_image_url( (int) $val, 'full' );
                $val = esc_url( (string) $val );
                if ( ! $was_default && $val !== '' ) $swapped_images[] = $val;
            }
            else if ( $type === 'url' )  $val = esc_url( (string) $val );
            else if ( $type === 'html' ) $val = wp_kses_post( (string) $val );
            /* `lines` — plain text where the EDITOR'S line breaks are kept.
             *
             * Sean: "I need to be able to do line breaks for the hero sentences and headlines."
             * Joyce asked the same for the Brands headline (#33, "each sentence should share
             * one line"). Until now every slot was esc_html'd, so a typed newline collapsed to
             * a space and a headline could only ever break where the browser chose.
             *
             * ESCAPED FIRST, THEN BREAKS ADDED. esc_html turns any real markup into visible
             * text, and only afterwards do \n become <br>. So the editor cannot inject HTML —
             * typing <script> still renders as the literal characters — while still controlling
             * where the line turns. A `html`/wysiwyg field would have allowed the break AND the
             * markup, which is why it was never the answer for a headline.
             *
             * \r\n and \r are normalized first: a paste from Word or Notes carries \r\n, which
             * would otherwise leave a stray carriage return inside the tag. */
            else if ( $type === 'lines' ) {
                $val = esc_html( (string) $val );
                $val = str_replace( array( "\r\n", "\r" ), "\n", $val );
                $val = preg_replace( '/\n+/', '<br>', $val );
            }
            else                         $val = esc_html( (string) $val );
            $frag = str_replace( '{{' . $key . '}}', $val, $frag );
        }
        /* AN UPLOADED IMAGE MUST BEAT THE srcset, or it never appears at all.
         *
         * home-hero's background ships seven fixed widths in a srcset so a phone pulls base-390
         * instead of the 800KB base-1920. A browser picks its candidate from srcset and IGNORES
         * src — so swapping the src for an uploaded photo would change nothing on screen, with
         * no error, and the editor would reasonably conclude the feature was broken.
         *
         * So: where an image slot resolved to the EDITOR'S choice rather than the built-in
         * default, drop the srcset from that one tag. The default keeps its seven widths and
         * stays as fast as it is today; only a deliberately swapped image forgoes them. That is
         * the right trade — a correct picture at one size beats the wrong picture at seven.
         *
         * Matched on the tag containing that exact src, so tags with no swapped image are
         * untouched. */
        if ( $swapped_images ) {
            $frag = preg_replace_callback( '/<img\b[^>]*>/i', function ( $m ) use ( $swapped_images ) {
                foreach ( $swapped_images as $u ) {
                    if ( strpos( $m[0], 'src="' . $u . '"' ) !== false ) {
                        return preg_replace( '/\s+srcset="[^"]*"/i', '', $m[0] );
                    }
                }
                return $m[0];
            }, $frag );
        }

        // Strip any leftover tokens. The class includes `-` deliberately: slot names are
        // underscores by convention, so a hyphenated token is always a typo — but before v2.6.1
        // this regex didn't match one, so `{{cta-label}}` reached the VISITOR as raw template
        // syntax. A missing line of copy is a defect; template syntax on a live page is a worse
        // one. The typo itself is caught before deploy by build-acf.py --check.
        // GRAMMAR IS DEFINED IN kit/README.md — it is duplicated in build-acf.py and both
        // compose harnesses, and all four must agree.
        return preg_replace( '/\{\{[a-z0-9_-]+\}\}/i', '', $frag );
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
             . vcc_shell_open() . $header . $frag . $footer . '</div>'
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

        /* "Show this section" — the switch at the top of each tab in Section Content.
         *
         * HIDES ONLY ON AN EXPLICIT FALSE. An unset field returns null, which means nobody
         * has ever opened that tab, and that must keep rendering exactly as it does today.
         * Treating null as "hidden" would blank every section on the site the moment this
         * deployed, before anyone had touched a switch.
         *
         * Checked BEFORE the fetch, so a hidden section costs no CDN round trip either —
         * which matters on a page that pays ~0.175s per section.
         *
         * A shortcode attribute still wins, as everywhere else: [brg_section id=… show="1"]
         * forces it back on without touching the admin.
         */
        if ( ! ( is_array( $atts ) && isset( $atts['show'] ) && $atts['show'] === '1' )
             && function_exists( 'get_field' ) ) {
            $vis = get_field( 'brg_' . str_replace( '-', '_', $id ) . '_show_section', 'option' );
            if ( $vis !== null && ! $vis ) {
                return "\n<!-- vc_embed " . esc_html( $client . '/section/' . $id )
                     . ' hidden via Section Content -->' . "\n";
            }
        }

        $ttl  = vcc_ttl( $atts );
        $base = rtrim( $cfg['base'], '/' );

        $frag = vcc_fetch( $base . '/sections/' . $id . '/embed.html', $ttl );
        if ( $frag === '' ) return '<!-- vc_embed: ' . esc_html( $client . '/section/' . $id ) . ' not built yet -->';

        $frag = vcc_fill_slots( $frag, $id, $atts, $cfg, $ttl );

        /* BRAND INFO RESOLVES AFTER THE SLOTS ARE FILLED, not before and not on each value
         * separately. A slot can itself hold "#brand-email", so the token only exists once
         * the slot has been placed into the markup — resolving earlier would miss it, and
         * resolving each value in isolation would miss the ones written straight into the
         * fragment. One pass over the assembled HTML catches both. */
        $frag = vcc_brand_resolve( $frag, $cfg );

        /* "Show the divider icon" — the round badge between this section and the one above.
         *
         * Marks the ROOT rather than cutting the markup out. Stripping the <span class="seam">
         * would mean this file carrying a copy of another file's markup shape, and it would
         * break silently the day that span gains a wrapper. An attribute states the intent and
         * lets the stylesheet decide what to do with it.
         *
         * Same rule as the section switch: hides only on an explicit false, never on unset. */
        if ( function_exists( 'get_field' ) ) {
            $seam = get_field( 'brg_' . str_replace( '-', '_', $id ) . '_show_divider', 'option' );
            if ( $seam !== null && ! $seam ) {
                $frag = preg_replace( '/<(section|div)\b/', '<$1 data-seam="off"', $frag, 1 );
            }
        }

        // Optional anchor: inject id="…" onto the fragment's root element.
        if ( is_array( $atts ) && ! empty( $atts['anchor'] ) ) {
            $anchor = preg_replace( '/[^A-Za-z0-9_-]/', '', (string) $atts['anchor'] );
            if ( $anchor !== '' ) $frag = preg_replace( '/<(section|div)\b/', '<$1 id="' . esc_attr( $anchor ) . '"', $frag, 1 );
        }

        list( $css, $js ) = vcc_shared_assets( $client, $cfg, $ttl );

        $out = "\n<!-- vc_embed " . esc_html( $client . '/section/' . $id ) . ' v' . VCC_VERSION . " -->\n"
             . $css
             . vcc_shell_open() . $frag . '</div>'
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
             . vcc_shell_open() . $piece . '</div>'
             . $js;
        return vcc_guard( $client, $out );
    }
}

/* ── Render the WP-menu-driven nav (v2.2: [brg_nav]). Content = wp_nav_menu() for the
      configured location; styling/behavior = brgw-nav.css/js. brgw-nav.js injects the
      pen-stroke marker underline + builds the mobile takeover from the same menu. ──── */
/* ── Header and footer settings, edited in wp-admin ───────────────────────────────
 * Declared in website/chrome/header|footer/slots.json, which generate the Site-wide
 * admin page (one tab each); read here. */
if ( ! function_exists( 'vcc_header_keys' ) ) {
    function vcc_header_keys() {
        /* TOKEN KEY => OPTION NAME, written out rather than composed. Composing reads as
         * tidier and is worse twice over: the option names would exist nowhere in this file,
         * so build-acf.py's reader check reports every field as "accepts input that changes
         * nothing", and a human grepping for one finds no reader either. The map is also the
         * allow-list. */
        return array(
            'logo'              => 'brg_header_logo',
            'logo_height'       => 'brg_header_logo_height',
            'brand_name'        => 'brg_header_brand_name',
            'logo_href'         => 'brg_header_logo_href',
            'layout'            => 'brg_header_layout',
            'link_size'         => 'brg_header_link_size',
            'link_gap'          => 'brg_header_link_gap',
            'left'              => 'brg_header_left',
            'right'             => 'brg_header_right',
            'more_label'        => 'brg_header_more_label',
            'bar_max'           => 'brg_header_bar_max',
            'pin_pages'         => 'brg_header_pin_pages',
            'pin_social'        => 'brg_header_pin_social',
            'pin_wordmark'      => 'brg_header_pin_wordmark',
            'order_pages'       => 'brg_header_order_pages',
            'order_social'      => 'brg_header_order_social',
            'order_wordmark'    => 'brg_header_order_wordmark',
            'tm_link_size'      => 'brg_header_tm_link_size',
            'tm_gap'            => 'brg_header_tm_gap',
            'tm_wordmark_size'  => 'brg_header_tm_wordmark_size',
            'tm_label_size'     => 'brg_header_tm_label_size',
            'show_pages'        => 'brg_header_show_pages',
            'show_social'       => 'brg_header_show_social',
            'show_wordmark'     => 'brg_header_show_wordmark',
            'show_menu_label'   => 'brg_header_show_menu_label',
            'show_social_label' => 'brg_header_show_social_label',
            'show_numbers'      => 'brg_header_show_numbers',
            'num_pos'           => 'brg_header_num_pos',
            'num_align'         => 'brg_header_num_align',
            'num_color'         => 'brg_header_num_color',
            'menu_label'        => 'brg_header_menu_label',
            'social_label'      => 'brg_header_social_label',
            'wordmark'          => 'brg_header_wordmark',
            'wordmark_line'     => 'brg_header_wordmark_line',
        );
    }
}

if ( ! function_exists( 'vcc_footer_keys' ) ) {
    function vcc_footer_keys() {
        /* TOKEN KEY => OPTION NAME, written out rather than composed. Composing reads as
         * tidier and is worse twice over: the option names would exist nowhere in this file,
         * so build-acf.py's reader check reports every field as "accepts input that changes
         * nothing", and a human grepping for one finds no reader either. The map is also the
         * allow-list. */
        return array(
            'logo'        => 'brg_footer_logo',
            'logo_width'  => 'brg_footer_logo_width',
            'logo_href'   => 'brg_footer_logo_href',
            'pad_top'     => 'brg_footer_pad_top',
            'pad_bottom'  => 'brg_footer_pad_bottom',
            'align'       => 'brg_footer_align',
            'show_social' => 'brg_footer_show_social',
            'social_size' => 'brg_footer_social_size',
            'legal'       => 'brg_footer_legal',
            'legal_align' => 'brg_footer_legal_align',
            'links'       => 'brg_footer_links',
        );
    }
}

/* One reader for both. Precedence is shortcode attribute > saved value > the default
 * declared in slots.json, the same order a section slot uses, so a shortcode can still make
 * one placement differ and an untouched site renders exactly as designed. */
if ( ! function_exists( 'vcc_buttons_keys' ) ) {
    function vcc_buttons_keys() {
        /* TOKEN KEY => OPTION NAME, written out for the same reasons as the header and footer
         * maps above: the names exist in this file, so build-acf.py's reader check can see
         * them and a human can grep for them. */
        return array(
            'size'       => 'brg_buttons_size',
            'style'      => 'brg_buttons_style',
            'btn_effect' => 'brg_buttons_btn_effect',
            'btn_hover'  => 'brg_buttons_btn_hover',
            'light_bg'    => 'brg_buttons_light_bg',
            'light_fg'    => 'brg_buttons_light_fg',
            'light_hover_bg' => 'brg_buttons_light_hover_bg',
            'light_hover_fg' => 'brg_buttons_light_hover_fg',
            'dark_bg'     => 'brg_buttons_dark_bg',
            'dark_fg'     => 'brg_buttons_dark_fg',
            'dark_hover_bg' => 'brg_buttons_dark_hover_bg',
            'dark_hover_fg' => 'brg_buttons_dark_hover_fg',
            'accent_bg'   => 'brg_buttons_accent_bg',
            'accent_fg'   => 'brg_buttons_accent_fg',
            'accent_hover_bg' => 'brg_buttons_accent_hover_bg',
            'accent_hover_fg' => 'brg_buttons_accent_hover_fg',
            'alt_bg'      => 'brg_buttons_alt_bg',
            'alt_fg'      => 'brg_buttons_alt_fg',
            'alt_hover_bg' => 'brg_buttons_alt_hover_bg',
            'alt_hover_fg' => 'brg_buttons_alt_hover_fg',
        );
    }
}

if ( ! function_exists( 'vcc_shell_open' ) ) {
    function vcc_shell_open() {
        /* THE TOP OF THE BUTTON CASCADE. Four things are decided here for every button on
         * the site, and each may be overruled by the section it is in and then by the button
         * itself: size, fill, hover, and the four COLOR ROLES.
         *
         * The roles are the point of this page. A button is set to Accent rather than to
         * yellow, so changing what Accent means repaints every accent button on the site at
         * once. The literal colors are still offered on each button for anything that has to
         * be one specific shade, and nothing already set changes.
         *
         * Colors leave as CUSTOM PROPERTIES rather than as rules, so the stylesheet keeps
         * every clamp, hover and outline behavior it already has and simply reads a
         * different value. A field left empty emits nothing and the stylesheet's own
         * fallback — the brand palette — applies. */
        $fx = vcc_chrome_setting( 'buttons', 'btn_effect' );
        if ( ! in_array( $fx, array( 'lift','lift-swap','underline','grow','press','fill','none' ), true ) ) $fx = 'lift';
        $size = vcc_chrome_setting( 'buttons', 'size' );
        if ( ! in_array( $size, array( 'large','medium','small' ), true ) ) $size = 'large';
        $style = vcc_chrome_setting( 'buttons', 'style' );
        if ( ! in_array( $style, array( 'filled','outline','text' ), true ) ) $style = 'filled';
        /* The hover COLOUR, the fourth thing decided here. "keep" is not a value to send
         * down — it is the site saying "leave each button to its own colour" — so it is
         * emitted as empty and a section or a button below is free to name one. Same rule
         * the other three already follow, and the same rule brgw.js applies on the way
         * down: a "keep" is never copied onto something that chose nothing. */
        $hover = vcc_chrome_setting( 'buttons', 'btn_hover' );
        if ( ! in_array( $hover, array( 'light','dark','accent','alt','yellow','teal','pink','orange','white','ink' ), true ) ) $hover = '';

        /* THE SIXTEEN ROLE COLORS, WRITTEN OUT. Composing these names from two nested loops
         * read as tidier and cost a real bug elsewhere in this file: a name that is built at
         * runtime exists nowhere in the source, so nobody can grep for it and the
         * field->reader check cannot see it. Brand info carried a dead "Footer logo width"
         * for exactly that reason until Sean edited it and the logo did not move. */
        $role_props = array(
            'light_bg'       => 'light-bg',   'light_fg'       => 'light-fg',
            'light_hover_bg' => 'light-hbg',  'light_hover_fg' => 'light-hfg',
            'dark_bg'        => 'dark-bg',    'dark_fg'        => 'dark-fg',
            'dark_hover_bg'  => 'dark-hbg',   'dark_hover_fg'  => 'dark-hfg',
            'accent_bg'      => 'accent-bg',  'accent_fg'      => 'accent-fg',
            'accent_hover_bg'=> 'accent-hbg', 'accent_hover_fg'=> 'accent-hfg',
            'alt_bg'         => 'alt-bg',     'alt_fg'         => 'alt-fg',
            'alt_hover_bg'   => 'alt-hbg',    'alt_hover_fg'   => 'alt-hfg',
        );
        $vars = '';
        {
            foreach ( $role_props as $slot => $prop ) {
                $v = vcc_chrome_setting( 'buttons', $slot );
                /* A HEX STRING ONLY. The value is pasted straight into a style attribute, so
                 * anything that is not plainly a color is dropped rather than escaped and
                 * hoped for. */
                if ( is_string( $v ) && preg_match( '/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', trim( $v ) ) ) {
                    $vars .= '--brgw-role-' . $prop . ':' . trim( $v ) . ';';
                }
            }
        }

        return '<div class="brgw brgw-shell"'
             . ' data-btn-fx="' . esc_attr( $fx ) . '"'
             . ' data-btn-size="' . esc_attr( $size ) . '"'
             . ' data-btn-style="' . esc_attr( $style ) . '"'
             . ( $hover !== '' ? ' data-btn-hover="' . esc_attr( $hover ) . '"' : '' )
             . ( $vars !== '' ? ' style="' . esc_attr( $vars ) . '"' : '' )
             . '>';
    }
}

if ( ! function_exists( 'vcc_chrome_setting' ) ) {
    function vcc_chrome_setting( $which, $key, $atts = null, $cfg = null ) {
        $map = $which === 'footer'  ? vcc_footer_keys()
             : ( $which === 'buttons' ? vcc_buttons_keys() : vcc_header_keys() );
        if ( ! isset( $map[ $key ] ) ) return '';
        if ( is_array( $atts ) && isset( $atts[ $key ] ) && $atts[ $key ] !== '' ) {
            return (string) $atts[ $key ];
        }
        if ( function_exists( 'get_field' ) ) {
            $v = get_field( $map[ $key ], 'option' );
            if ( is_array( $v ) && isset( $v['url'] ) ) $v = $v['url'];
            if ( is_string( $v ) ) $v = trim( $v );
            if ( $v !== null && $v !== false && $v !== '' ) return (string) $v;
        }
        static $defaults = array();
        if ( ! isset( $defaults[ $which ] ) ) {
            $defaults[ $which ] = array();
            if ( ! $cfg && isset( $GLOBALS['VCC_CLIENTS']['brg'] ) ) $cfg = $GLOBALS['VCC_CLIENTS']['brg'];
            if ( is_array( $cfg ) && ! empty( $cfg['base'] ) ) {
                $raw = vcc_fetch( rtrim( $cfg['base'], '/' ) . '/chrome/' . $which . '/slots.json', VCC_TTL );
                $d   = $raw ? json_decode( $raw, true ) : null;
                if ( is_array( $d ) ) foreach ( $d as $k => $v ) {
                    if ( strpos( (string) $k, '_' ) !== 0 && is_array( $v ) && isset( $v['default'] ) ) {
                        $defaults[ $which ][ $k ] = (string) $v['default'];
                    }
                }
            }
        }
        return isset( $defaults[ $which ][ $key ] ) ? $defaults[ $which ][ $key ] : '';
    }
}

/* ── The header logo, inlined so part of it can change color ──────────────────────────
 * Sean, 3 Oct: the white "RESTAURANT GROUP" should flip to black over a light section,
 * the way the menu links already do. A logo loaded through <img> cannot be restyled by
 * the page at all — the browser treats it as an opaque picture — so the only way to
 * recolor one piece of it is to put the SVG in the document.
 *
 * Returns '' for anything it is not completely sure about: a non-SVG logo, a logo on a
 * host that is not ours, an unreadable file. The caller then emits the <img> it always
 * did, so the worst case is today's behavior.
 *
 * THREE THINGS ARE DONE TO THE FILE, and each is here for a reason:
 *
 * 1. SANITISED. An inlined SVG is live markup in the page, not a picture. The file comes
 *    from the media library, so it is not hostile — but "trusted today" is not a property
 *    worth betting a site on, and a script tag inside an uploaded SVG is a known trick.
 *
 * 2. ITS CLASS NAMES ARE NAMESPACED. An SVG's <style> block is NOT scoped to that SVG —
 *    once inlined, its rules apply to the whole document. Illustrator names every export
 *    .st0/.st1/.st2, so two inlined logos would silently restyle each other. This is the
 *    same shape as the collision that took /team/ down this morning, so it is designed
 *    out rather than remembered.
 *
 * 3. WHITE BECOMES A VARIABLE. Rather than hunting for one class by name — which would
 *    break the next time the logo is re-exported — every white fill becomes
 *    var(--bnav-logo-ink, <the original white>). Nothing changes until something sets
 *    that property, and brgw-nav.css sets it only on .on-light. So the rule is "the white
 *    parts of the logo turn black over a light section", which survives a re-export. */
if ( ! function_exists( 'vcc_logo_svg' ) ) {
    function vcc_logo_svg( $url ) {
        if ( ! is_string( $url ) || $url === '' ) return '';
        $path = (string) parse_url( $url, PHP_URL_PATH );
        if ( strtolower( substr( $path, -4 ) ) !== '.svg' ) return '';

        /* Our own hosts only — the site itself and the CDN the fragments come from. */
        $host = strtolower( (string) parse_url( $url, PHP_URL_HOST ) );
        $ours = array( strtolower( (string) parse_url( home_url(), PHP_URL_HOST ) ) );
        if ( isset( $GLOBALS['VCC_CLIENTS']['brg']['base'] ) ) {
            $ours[] = strtolower( (string) parse_url( $GLOBALS['VCC_CLIENTS']['brg']['base'], PHP_URL_HOST ) );
        }
        if ( ! in_array( $host, array_values( array_filter( $ours ) ), true ) ) return '';

        $raw = vcc_fetch( $url, VCC_TTL );
        if ( ! is_string( $raw ) || $raw === '' ) return '';
        $i = stripos( $raw, '<svg' );
        $j = strripos( $raw, '</svg>' );
        if ( $i === false || $j === false || $j <= $i ) return '';
        $svg = substr( $raw, $i, $j - $i + 6 );

        /* 1 — sanitise */
        /* <use> is deliberately NOT stripped: it normally points at a <defs> id inside the
         * same file, and removing it would quietly blank part of some other logo rather
         * than failing cleanly to the <img>. Browsers already refuse a cross-origin <use>. */
        $svg = preg_replace( '#<(script|foreignObject|iframe)\b[^>]*>.*?</\1\s*>#is', '', $svg );
        $svg = preg_replace( '#<(script|foreignObject|iframe)\b[^>]*/\s*>#is', '', $svg );
        $svg = preg_replace( '#\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\')#i', '', $svg );
        $svg = preg_replace( '#(xlink:href|href)\s*=\s*("|\')\s*(javascript|data):[^"\']*\2#i', '', $svg );
        if ( ! is_string( $svg ) || $svg === '' ) return '';

        /* 2 — namespace the file's own class names, selectors and attributes together */
        $uid = 'bl' . substr( md5( $url ), 0, 6 );
        $classes = array();
        if ( preg_match_all( '/\.([A-Za-z_][\w-]*)\s*(?=[\{,])/', $svg, $m ) ) {
            $classes = array_values( array_unique( $m[1] ) );
        }
        if ( $classes ) {
            $svg = preg_replace_callback( '/class\s*=\s*"([^"]*)"/', function ( $m ) use ( $classes, $uid ) {
                $out = array();
                foreach ( preg_split( '/\s+/', trim( $m[1] ) ) as $c ) {
                    if ( $c === '' ) continue;
                    $out[] = in_array( $c, $classes, true ) ? $uid . '-' . $c : $c;
                }
                return 'class="' . implode( ' ', $out ) . '"';
            }, $svg );
            foreach ( $classes as $c ) {
                $svg = preg_replace( '/\.' . preg_quote( $c, '/' ) . '(?=\s*[\{,])/', '.' . $uid . '-' . $c, $svg );
            }
        }

        /* 3 — white becomes a variable, in the style block and on any inline attribute */
        $svg = preg_replace( '/fill\s*:\s*(#fff(?:fff)?|white)\b/i', 'fill:var(--bnav-logo-ink,$1)', $svg );
        $svg = preg_replace( '/fill\s*=\s*"\s*(#fff(?:fff)?|white)\s*"/i', 'fill="var(--bnav-logo-ink,$1)"', $svg );

        /* The <a> around it already carries the accessible name, so the art is decorative.
         * width/height are dropped from the ROOT TAG ONLY — stripping them globally would
         * also hit the <rect> that draws the yellow box. */
        $end = strpos( $svg, '>' );
        if ( $end === false ) return '';
        $open = substr( $svg, 0, $end + 1 );
        $open = preg_replace( '/\s(width|height)\s*=\s*("[^"]*"|\'[^\']*\')/i', '', $open );
        $open = preg_replace( '/<svg\b/i', '<svg aria-hidden="true" focusable="false"', $open, 1 );
        return $open . substr( $svg, $end + 1 );
    }
}

if ( ! function_exists( 'vcc_render_nav' ) ) {
    function vcc_render_nav( $client, $atts ) {
        $cfg = isset( $GLOBALS['VCC_CLIENTS'][ $client ] ) ? $GLOBALS['VCC_CLIENTS'][ $client ] : null;
        if ( ! $cfg ) return '';
        $ttl  = vcc_ttl( $atts );
        $base = rtrim( $cfg['base'], '/' );
        $home = isset( $cfg['home_url'] ) ? $cfg['home_url'] : '/';
        $loc  = isset( $cfg['nav_menu'] ) ? $cfg['nav_menu'] : '';
        /* The editor's logo wins; the path in the plugin config is the fallback, so a site
         * that has never opened this page looks exactly as it did. */
        $logo = vcc_chrome_setting( 'header', 'logo', $atts );
        if ( $logo === '' ) $logo = isset( $cfg['nav_logo'] ) ? $base . $cfg['nav_logo'] : '';

        /* The SOCIAL menu. brg_social has been a registered location since v2.2 and
         * nothing ever rendered it — an editor could assign a menu to it and get no
         * output and no error, which is the silent-failure shape this codebase keeps
         * paying for. It is emitted as a second hidden source list; brgw-nav.js reads
         * it and builds the social row in the drawer.
         *
         * Content lives in a WP MENU rather than ACF on purpose: these are links with
         * labels, which is exactly what the menu editor is for, and it means adding a
         * platform needs no field, no deploy and no chat. */
        $social = '';
        $sloc   = isset( $cfg['nav_social'] ) ? $cfg['nav_social'] : '';
        if ( $sloc && function_exists( 'has_nav_menu' ) && has_nav_menu( $sloc ) ) {
            $social = wp_nav_menu( array(
                'theme_location' => $sloc, 'container' => false, 'menu_class' => 'nav-social-src',
                'echo' => false, 'fallback_cb' => false, 'depth' => 1,
            ) );
            if ( ! is_string( $social ) ) $social = '';
        }

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

        // Layout controls (shortcode attrs): layout=left|split|center|compact, left/right (per-side
        // counts, overflow → More drawer), sticky=pin|hide (hide-on-scroll-down). Default = left.
        $layout = preg_replace( '/[^a-z]/', '', strtolower( vcc_chrome_setting( 'header', 'layout', $atts ) ) );
        if ( ! in_array( $layout, array( 'left', 'split', 'center', 'compact' ), true ) ) $layout = 'left';
        $left   = max( 0, intval( vcc_chrome_setting( 'header', 'left', $atts ) ) );
        $right  = max( 0, intval( vcc_chrome_setting( 'header', 'right', $atts ) ) );
        $sticky = ( is_array( $atts ) && isset( $atts['sticky'] ) && $atts['sticky'] === 'hide' ) ? 'hide' : 'pin';

        // Background: bg=solid|none|frost, bgcolor="#hex|rgb()|name", opacity="0–1".
        $bg = ( is_array( $atts ) && isset( $atts['bg'] ) ) ? preg_replace( '/[^a-z]/', '', strtolower( $atts['bg'] ) ) : 'solid';
        if ( ! in_array( $bg, array( 'solid', 'none', 'frost' ), true ) ) $bg = 'solid';
        $style = '';
        if ( is_array( $atts ) && isset( $atts['bgcolor'] ) && $atts['bgcolor'] !== '' ) {
            $c = preg_replace( '/[^#0-9a-zA-Z(),.% ]/', '', (string) $atts['bgcolor'] );
            if ( $c !== '' ) $style .= '--bnav-bg:' . $c . ';';
        }
        if ( is_array( $atts ) && isset( $atts['opacity'] ) && $atts['opacity'] !== '' ) {
            $op = (float) $atts['opacity'];
            if ( $op >= 0 && $op <= 1 ) $style .= '--bnav-op:' . rtrim( rtrim( number_format( $op, 3, '.', '' ), '0' ), '.' ) . ';';
        }

        /* The rest of the editable settings. Sizes go out as CUSTOM PROPERTIES rather than
         * inline width/font-size, so the stylesheet keeps its clamps and responsive rules
         * and simply reads a different number — the same shape Oak + Elm uses. The labels
         * and the two switches go out as data-attributes, which is what brgw-nav.js
         * already reads for `more` and `follow`. */
        /* EVERY SETTING ON THE HEADER TAB REACHES THE BAR, by one of three routes:
         *   - a size becomes a CUSTOM PROPERTY, so the stylesheet keeps its clamps and
         *     responsive rules and simply reads a different number;
         *   - a choice becomes a DATA-ATTRIBUTE that CSS or brgw-nav.js switches on;
         *   - a piece of text goes out as a data-attribute the script already reads.
         * Anything not listed here would be a field that accepts input and changes nothing,
         * which is the failure this project keeps paying for. */
        $px = function ( $v, $lo, $hi, $prop ) {
            $n = intval( $v );
            return ( $n >= $lo && $n <= $hi ) ? $prop . ':' . $n . 'px;' : '';
        };
        $style .= $px( vcc_chrome_setting( 'header', 'link_size',       $atts ),  9,  22, '--bnav-link-size' );
        $style .= $px( vcc_chrome_setting( 'header', 'link_gap',        $atts ),  8,  64, '--bnav-link-gap' );
        $style .= $px( vcc_chrome_setting( 'header', 'logo_height',     $atts ), 16,  96, '--bnav-logo-size' );
        $style .= $px( vcc_chrome_setting( 'header', 'tm_link_size',    $atts ), 18,  84, '--bnav-tm-link' );
        $style .= $px( vcc_chrome_setting( 'header', 'tm_gap',          $atts ),  0,  80, '--bnav-tm-gap' );
        $style .= $px( vcc_chrome_setting( 'header', 'tm_wordmark_size',$atts ), 60, 420, '--bnav-tm-wm' );
        $style .= $px( vcc_chrome_setting( 'header', 'tm_label_size',   $atts ),  8,  20, '--bnav-tm-label' );

        /* The number's colour rides out as a CUSTOM PROPERTY, not a data-attribute, because
         * it is a value the stylesheet reads rather than a state it switches on. Hex only,
         * and anything else is dropped rather than escaped and hoped for — the same rule the
         * button roles follow, and for the same reason: this is pasted into a style attribute. */
        $numc = vcc_chrome_setting( 'header', 'num_color', $atts );
        if ( is_string( $numc ) && preg_match( '/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/', trim( $numc ) ) ) {
            $style .= '--bnav-num-color:' . trim( $numc ) . ';';
        }

        $onoff = function ( $v ) { return $v === '0' ? '0' : '1'; };
        $data = array(
            'more'          => vcc_chrome_setting( 'header', 'more_label',        $atts ),
            'follow'        => vcc_chrome_setting( 'header', 'social_label',      $atts ),
            'menulabel'     => vcc_chrome_setting( 'header', 'menu_label',        $atts ),
            'barmax'        => intval( vcc_chrome_setting( 'header', 'bar_max',   $atts ) ),
            'wordmark'      => vcc_chrome_setting( 'header', 'wordmark',          $atts ),
            'meta'          => vcc_chrome_setting( 'header', 'wordmark_line',     $atts ),
            'brand'         => vcc_chrome_setting( 'header', 'brand_name',        $atts ),
            'pin-pages'     => vcc_chrome_setting( 'header', 'pin_pages',         $atts ),
            'pin-social'    => vcc_chrome_setting( 'header', 'pin_social',        $atts ),
            'pin-wordmark'  => vcc_chrome_setting( 'header', 'pin_wordmark',      $atts ),
            'order-pages'   => vcc_chrome_setting( 'header', 'order_pages',       $atts ),
            'order-social'  => vcc_chrome_setting( 'header', 'order_social',      $atts ),
            'order-wordmark'=> vcc_chrome_setting( 'header', 'order_wordmark',    $atts ),
            'show-pages'    => $onoff( vcc_chrome_setting( 'header', 'show_pages',        $atts ) ),
            'social'        => $onoff( vcc_chrome_setting( 'header', 'show_social',       $atts ) ),
            'show-wordmark' => $onoff( vcc_chrome_setting( 'header', 'show_wordmark',     $atts ) ),
            'menulabel-on'  => $onoff( vcc_chrome_setting( 'header', 'show_menu_label',   $atts ) ),
            'sociallabel-on'=> $onoff( vcc_chrome_setting( 'header', 'show_social_label', $atts ) ),
            'numbers'       => $onoff( vcc_chrome_setting( 'header', 'show_numbers',      $atts ) ),
            'num-pos'       => vcc_chrome_setting( 'header', 'num_pos',           $atts ),
            'num-align'     => vcc_chrome_setting( 'header', 'num_align',         $atts ),
        );
        $dataAttr = '';
        foreach ( $data as $k => $v ) {
            if ( $v === '' || $v === null ) continue;
            $dataAttr .= ' data-' . $k . '="' . esc_attr( $v ) . '"';
        }

        $brand    = vcc_chrome_setting( 'header', 'brand_name', $atts );
        if ( $brand === '' ) $brand = 'Blacktop Restaurant Group';
        $logoHref = vcc_chrome_setting( 'header', 'logo_href', $atts );
        if ( $logoHref === '' ) $logoHref = $home;

        $header = '<header class="bnav lay-' . esc_attr( $layout ) . ' bg-' . esc_attr( $bg ) . '"'
                . ( $style !== '' ? ' style="' . esc_attr( $style ) . '"' : '' )
                . ' data-left="' . esc_attr( $left )
                . '" data-right="' . esc_attr( $right ) . '" data-sticky="' . esc_attr( $sticky ) . '"'
                . $dataAttr . '>'
                . '<a class="bnav-logo" href="' . esc_url( $logoHref ) . '" aria-label="' . esc_attr( $brand ) . ' — home">'
                . ( $logo ? ( ( $inline = vcc_logo_svg( $logo ) )
                      ? $inline
                      : '<img src="' . esc_url( $logo ) . '" alt="' . esc_attr( $brand ) . '">' ) : '' )
                . '</a>'
                . $menu                                             // hidden <ul class="nav-src"> source (JS reads it)
                . $social                                           // hidden <ul class="nav-social-src">, may be empty
                . '<div class="bnav-grp bnav-grp-a"></div><div class="bnav-grp bnav-grp-b"></div>'
                . '<button class="bnav-ham" aria-label="Menu"><i></i><i></i></button>'
                . '</header>';

        list( $css, $js ) = vcc_shared_assets( $client, $cfg, $ttl );
        $out = "\n<!-- vc_embed " . esc_html( $client . '/nav' ) . ' v' . VCC_VERSION . " -->\n"
             . $css . vcc_shell_open() . $header . '</div>' . $js;
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
/* ── [brand email] OUTSIDE OUR FRAGMENTS ──────────────────────────────────────────────
 * Sean, 5 Oct: the splash page's contact email should come from Brand info.
 *
 * It could not. The splash is an Oxygen page built in WordPress, and brand tokens are
 * resolved in exactly one place — inside a fragment, as it renders — so the syntax Brand
 * info's own note tells you to use, "[brand phone]", did nothing anywhere else on the
 * site. A shortcode makes the documented syntax true everywhere instead of only where it
 * happened to be wired.
 *
 *   [brand email]             the address, as text
 *   [brand email as=mailto]   mailto:…  — for a link's href
 *   [brand email as=link]     a finished <a> with the address as its words
 *
 * Any Brand info key works: email, careers_email, phone, name, address, instagram…
 * An empty field prints nothing rather than an empty link.
 *
 * GUARDED because `brand` is a short, generic name: if another plugin has already claimed
 * it, ours stands down rather than overwriting theirs and breaking their pages. */
/* shortcode_exists() is a WordPress function, and the deploy's smoke check loads this file
 * with only the handful of WP functions it stubs — so calling it unguarded fataled the check
 * before anything was copied. Guarded, the check loads the file and the real site still gets
 * the collision test. */
if ( ! function_exists( 'shortcode_exists' ) || ! shortcode_exists( 'brand' ) ) {
    add_shortcode( 'brand', function ( $atts ) {
        $atts = (array) $atts;
        $key  = '';
        foreach ( $atts as $k => $v ) {
            if ( is_int( $k ) ) { $key = strtolower( trim( (string) $v ) ); break; }
        }
        if ( $key === '' && isset( $atts['key'] ) ) $key = strtolower( trim( (string) $atts['key'] ) );
        if ( $key === '' || ! function_exists( 'vcc_brand' ) ) return '';

        $val = (string) vcc_brand( $key );
        if ( $val === '' ) return '';
        $as = isset( $atts['as'] ) ? strtolower( trim( (string) $atts['as'] ) ) : '';
        if ( $as === 'mailto' || $as === 'href' || $as === 'url' ) {
            return esc_url( vcc_brand_link( $key ) );
        }
        if ( $as === 'link' ) {
            $href = vcc_brand_link( $key );
            if ( $href === '' ) return esc_html( $val );
            return '<a href="' . esc_url( $href ) . '">' . esc_html( $val ) . '</a>';
        }
        return esc_html( $val );
    } );
}

add_shortcode( 'vc_embed', function ( $atts ) {
    $a = shortcode_atts( array( 'url' => '', 'ttl' => (string) VCC_TTL ), $atts, 'vc_embed' );
    if ( ! $a['url'] ) return '<!-- vc_embed: no url -->';
    $ttl = isset( $_GET['brg_refresh'] ) ? 0 : max( 0, intval( $a['ttl'] ) );
    $body = vcc_fetch( $a['url'], $ttl );
    return $body !== '' ? $body : '<!-- vc_embed: fetch failed -->';
} );
