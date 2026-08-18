<?php
/**
 * BRG — ACF section content: options page + AUTO-LOADED field groups
 * -----------------------------------------------------------------------------
 * Version: 1.0.0
 * INSTALL ONCE → /wp-content/mu-plugins/brg-acf.php  (auto-activates). Needs ACF Pro.
 *
 * Why this exists: so you NEVER import a field group by hand again. This file is a
 * stable loader — it registers the "Section Content" options page, then fetches the
 * generated field-group DEFINITIONS from Netlify (website/acf/all.acf.json) and
 * registers them with acf_add_local_field_group(). Add/change a field:
 *     edit sections.json → python3 kit/build-acf.py → git push → live in ~2 min.
 * No re-import, no re-drop (only the field DATA changes; this loader stays put).
 *
 * Safe by construction: it fetches JSON *data* (field definitions), never code —
 * so there is no remote-code-execution surface. Netlify-host-only, transient-cached.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! defined( 'BRG_ACF_SRC' ) ) define( 'BRG_ACF_SRC', 'https://blacktoprg.netlify.app/acf/all.acf.json' );
if ( ! defined( 'BRG_ACF_TTL' ) ) define( 'BRG_ACF_TTL', 300 ); // seconds; ?brg_refresh=1 busts it

/* The options page slug. THREE things must agree on this string: this page, every
 * generated group's location.value, and the screen check in brg-acf-admin-style.php.
 * fc-brands carries it as three literals and lists the agreement as unenforced — a
 * mismatch attaches every group to a page that does not exist and the whole screen
 * renders EMPTY, with no error. It is the one coupling their write-up says actually
 * fired, twice.
 *
 * Here the two PHP copies are DELETED rather than gated: the style file reads this
 * constant. The third lives in kit/build-acf.py, which cannot import a PHP constant,
 * so that one is asserted at generation time instead. */
if ( ! defined( 'BRG_ACF_PAGE' ) ) define( 'BRG_ACF_PAGE', 'brg-section-content' );

add_action( 'acf/init', function () {

    // 1) The PARENT options page. Each page of the site then gets its own SUB-page,
    //    registered in step 2 from the field groups themselves — so the admin sidebar is
    //    the navigation (Home / Brands / Team / …) instead of one long screen of cards.
    //
    //    The first group's location is the parent slug itself, which is the standard WP
    //    pattern for "clicking the parent lands on the first child": without it WordPress
    //    adds an auto sub-menu entry repeating the parent's title and pointing at an
    //    empty page.
    if ( function_exists( 'acf_add_options_page' ) ) {
        acf_add_options_page( array(
            'page_title'      => 'Section Content',
            'menu_title'      => 'Section Content',
            'menu_slug'       => BRG_ACF_PAGE,
            'capability'      => 'edit_posts',
            'autoload'        => true,
            'icon_url'        => 'dashicons-layout',
            'position'        => 26,
            'update_button'   => 'Save content',
            'updated_message' => 'Section content saved.',
        ) );
    }

    // 2) Fetch the generated field groups from Netlify and register them (no import).
    if ( ! function_exists( 'acf_add_local_field_group' ) ) return;

    $ttl  = isset( $_GET['brg_refresh'] ) ? 0 : BRG_ACF_TTL;
    $key  = 'brg_acf_' . md5( BRG_ACF_SRC );
    $json = $ttl > 0 ? get_transient( $key ) : false;
    if ( $json === false ) {
        $host = wp_parse_url( BRG_ACF_SRC, PHP_URL_HOST );
        if ( $host && preg_match( '/\.netlify\.app$/', $host ) ) {          // netlify-only
            $res = wp_remote_get( BRG_ACF_SRC, array( 'timeout' => 8 ) );
            if ( ! is_wp_error( $res ) && wp_remote_retrieve_response_code( $res ) === 200 ) {
                $json = wp_remote_retrieve_body( $res );
                set_transient( $key, $json, max( 60, BRG_ACF_TTL ) );
                set_transient( $key . '_stale', $json, WEEK_IN_SECONDS );
            }
        }
        if ( $json === false || $json === '' ) $json = get_transient( $key . '_stale' ); // last-good
    }

    $groups = $json ? json_decode( $json, true ) : null;
    if ( ! is_array( $groups ) ) return;

    /* 2) Register a sub-page per distinct options_page in the fetched groups, then the
     *    groups themselves. DERIVED, never listed: the generator decides which pages
     *    exist and this follows. A hardcoded list here would be a second home for that
     *    decision, and its failure mode is the quiet one — a group whose page was never
     *    registered attaches to nothing and renders NOWHERE, with no error. fc-brands
     *    names that as the coupling that actually broke their site, twice.
     *
     *    Menu label comes off the group title: "Brands — Content" -> "Brands". */
    if ( function_exists( 'acf_add_options_sub_page' ) ) {
        $seen = array();
        foreach ( $groups as $g ) {
            if ( empty( $g['location'][0][0]['value'] ) ) continue;
            $slug = $g['location'][0][0]['value'];
            if ( $slug === BRG_ACF_PAGE || isset( $seen[ $slug ] ) ) continue;  // parent is already registered
            $seen[ $slug ] = true;
            $label = trim( preg_replace( '/\s*—\s*Content\s*$/u', '', (string) $g['title'] ) );
            acf_add_options_sub_page( array(
                'page_title'      => $label . ' — Section Content',
                'menu_title'      => $label !== '' ? $label : $slug,
                'menu_slug'       => $slug,
                'parent_slug'     => BRG_ACF_PAGE,
                'capability'      => 'edit_posts',
                'autoload'        => true,
                'update_button'   => 'Save content',
                'updated_message' => 'Section content saved.',
            ) );
        }
    }

    foreach ( $groups as $g ) {
        if ( is_array( $g ) && ! empty( $g['key'] ) ) acf_add_local_field_group( $g );
    }
}, 20 );
