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
        /* LinkedIn, bottom right — BugHerd #32, reported by joyce@blacktoprg.com 14 Sep.
         * A LUCIDE LINE ICON drawn inline, per the house rule: no emoji, and no second
         * request for a 1KB mark. stroke="currentColor" so it inherits the footer's colour
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
        $logo = vcc_brand( 'footer_logo' );
        $name = vcc_brand( 'name' );
        if ( $name === '' || $name === null ) $name = 'Blacktop Restaurant Group';
        $style = ( is_string( $logo ) && $logo !== '' )
               ? ' style="--brgw-footer-logo:url(\'' . esc_url( $logo ) . '\')"' : '';
        $footer = '<footer class="brgw__footer reveal"><div class="lockup anim-up"' . $style . '>'
                . esc_html( $name ) . '</div>'
                . $li . '</footer>';
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
             * \r\n and \r are normalised first: a paste from Word or Notes carries \r\n, which
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
        $layout = ( is_array( $atts ) && isset( $atts['layout'] ) ) ? preg_replace( '/[^a-z]/', '', strtolower( $atts['layout'] ) ) : 'left';
        if ( ! in_array( $layout, array( 'left', 'split', 'center', 'compact' ), true ) ) $layout = 'left';
        $left   = ( is_array( $atts ) && isset( $atts['left'] ) )  ? max( 0, intval( $atts['left'] ) )  : 2;
        $right  = ( is_array( $atts ) && isset( $atts['right'] ) ) ? max( 0, intval( $atts['right'] ) ) : 2;
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

        $header = '<header class="bnav lay-' . esc_attr( $layout ) . ' bg-' . esc_attr( $bg ) . '"'
                . ( $style !== '' ? ' style="' . esc_attr( $style ) . '"' : '' )
                . ' data-left="' . esc_attr( $left )
                . '" data-right="' . esc_attr( $right ) . '" data-sticky="' . esc_attr( $sticky ) . '">'
                . '<a class="bnav-logo" href="' . esc_url( $home ) . '" aria-label="Blacktop Restaurant Group — home">'
                . ( $logo ? '<img src="' . esc_url( $logo ) . '" alt="Blacktop Restaurant Group">' : '' )
                . '</a>'
                . $menu                                             // hidden <ul class="nav-src"> source (JS reads it)
                . $social                                           // hidden <ul class="nav-social-src">, may be empty
                . '<div class="bnav-grp bnav-grp-a"></div><div class="bnav-grp bnav-grp-b"></div>'
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
