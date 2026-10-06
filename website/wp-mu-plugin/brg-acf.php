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

/* ── THE MENU'S OWN NAME, ICON, PLACE AND ORDER ───────────────────────────────────────
 * Sean, 5 Oct: the admin menu title and icon should be settable in Brand info, Section
 * Content should sit first, and the pages inside it should be re-orderable.
 *
 * READ WITH get_option, NOT get_field. This runs on acf/init, BEFORE the field groups are
 * fetched and registered, so ACF cannot answer yet — but the saved value is an ordinary
 * option row and is readable the whole time. A field nobody has touched has no row, and
 * the fallback here is what shipped, so an untouched site looks exactly as it did.
 */
if ( ! function_exists( 'brg_menu_opt' ) ) {
    function brg_menu_opt( $option, $fallback ) {
        /* The FULL option name is passed in by every caller rather than composed from a
         * suffix here. Composed reads tidier and is worse: the names would exist nowhere in
         * this repo's PHP, so build-acf.py's field->reader check reports each one as a field
         * that accepts input and changes nothing, and anyone grepping for one finds no
         * reader either. Same reason the header and footer key maps are written out. */
        $v = get_option( 'options_' . $option, null );
        if ( $v === null || $v === false || trim( (string) $v ) === '' ) return $fallback;
        return trim( (string) $v );
    }
}

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
        $brg_menu_title = brg_menu_opt( 'brg_brand_admin_menu_title', 'Section Content' );
        $brg_menu_icon  = brg_menu_opt( 'brg_brand_admin_menu_icon', 'dashicons-layout' );
        /* AN UPLOADED ICON WINS. ACF stores an image field as the attachment ID, and this
         * runs before ACF can turn that into a URL — wp_get_attachment_url does it without
         * ACF, and is available by the time acf/init fires. A non-numeric or deleted
         * attachment falls through to the Dashicons name rather than showing a broken icon. */
        $brg_icon_id = brg_menu_opt( 'brg_brand_admin_menu_icon_image', '' );
        if ( $brg_icon_id !== '' && ctype_digit( (string) $brg_icon_id ) ) {
            $brg_icon_url = wp_get_attachment_url( (int) $brg_icon_id );
            if ( $brg_icon_url ) $brg_menu_icon = $brg_icon_url;
        }
        $brg_menu_pos   = (int) brg_menu_opt( 'brg_brand_admin_menu_position', 2 );
        if ( $brg_menu_pos < 1 || $brg_menu_pos > 100 ) $brg_menu_pos = 2;
        acf_add_options_page( array(
            'page_title'      => $brg_menu_title,
            'menu_title'      => $brg_menu_title,
            'menu_slug'       => BRG_ACF_PAGE,
            'capability'      => 'edit_posts',
            'autoload'        => true,
            'icon_url'        => $brg_menu_icon,
            'position'        => $brg_menu_pos,
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
     *    Menu label comes off the group title: "Brands — Content" -> "Brands".
     *
     *    THE SAME QUIET FAILURE BIT US HERE, one level down. A group whose page is never
     *    registered renders nowhere with no error — and so does a group whose page IS
     *    registered but has no MENU ENTRY. Home's group sits on the parent slug and was
     *    skipped by this loop, so its 25 fields were reachable only by typing the URL.
     *    Every group now gets a named entry, including the one on the parent slug. */
    /* THE PARENT OWNS NO GROUP ANY MORE, so two things need handling.
     *
     * Every page now has its own slug (kit/build-acf.py), which is what finally gave Home a
     * menu entry. The parent "Section Content" is left as a container with nothing to render.
     *
     * (a) WordPress auto-adds a submenu entry duplicating the parent's title and pointing at
     *     that empty page. remove_submenu_page() drops it, so the sidebar reads exactly the
     *     six real pages and nothing else.
     * (b) On DESKTOP the parent is still a link, so clicking it would land on the empty page.
     *     Send it to the first child instead. On MOBILE the parent only expands the submenu
     *     and never navigates — which is precisely why Home could not live on the parent's
     *     page, and why this redirect is a desktop convenience rather than the mechanism.
     *
     * The target is DERIVED from the first group, never typed. A hardcoded '-home' here
     * would be a second home for a decision the generator already owns, and it would rot the
     * day the page order changes.
     */
    $first_slug = '';
    foreach ( $groups as $g ) {
        $v = $g['location'][0][0]['value'] ?? '';
        if ( $v !== '' && $v !== BRG_ACF_PAGE ) { $first_slug = $v; break; }
    }
    if ( $first_slug !== '' ) {
        add_action( 'admin_menu', function () { remove_submenu_page( BRG_ACF_PAGE, BRG_ACF_PAGE ); }, 999 );
        add_action( 'admin_init', function () use ( $first_slug ) {
            if ( ( $_GET['page'] ?? '' ) === BRG_ACF_PAGE ) {
                wp_safe_redirect( admin_url( 'admin.php?page=' . rawurlencode( $first_slug ) ) );
                exit;
            }
        } );
    }

    if ( function_exists( 'acf_add_options_sub_page' ) ) {
        /* THE SIDEBAR ORDER IS THE ORDER THESE ARE REGISTERED IN, so the editor's list is
         * applied by sorting the groups before the loop rather than by touching WordPress's
         * menu array afterwards. A slug the editor did not mention keeps its generated place
         * AFTER the ones they did, so naming two pages pulls exactly those two to the top
         * instead of silently reordering the rest. */
        /* READ THE REPEATER STRAIGHT FROM THE OPTIONS TABLE. ACF stores a repeater as a row
         * COUNT under the field's own name plus one option per row —
         * options_brg_brand_admin_menu_pages_0_page — and get_field cannot help here because
         * the field groups have not been registered yet when this runs. Reading the rows
         * directly is the same trick the menu title uses, one level deeper. */
        $want = array();
        $brg_rows = (int) brg_menu_opt( 'brg_brand_admin_menu_pages', 0 );
        for ( $i = 0; $i < $brg_rows; $i++ ) {
            $slug = brg_menu_opt( 'brg_brand_admin_menu_pages_' . $i . '_page', '' );
            if ( $slug !== '' && ! isset( $want[ $slug ] ) ) $want[ $slug ] = count( $want );
        }
        if ( $want ) {
            usort( $groups, function ( $a, $b ) use ( $want ) {
                $sa = $a['location'][0][0]['value'] ?? '';
                $sb = $b['location'][0][0]['value'] ?? '';
                $ra = array_key_exists( $sa, $want ) ? $want[ $sa ] : PHP_INT_MAX;
                $rb = array_key_exists( $sb, $want ) ? $want[ $sb ] : PHP_INT_MAX;
                return $ra === $rb ? 0 : ( $ra < $rb ? -1 : 1 );
            } );
        }
        $seen = array();
        foreach ( $groups as $g ) {
            if ( empty( $g['location'][0][0]['value'] ) ) continue;
            $slug = $g['location'][0][0]['value'];
            if ( isset( $seen[ $slug ] ) ) continue;
            // A GROUP ON THE PARENT SLUG STILL NEEDS ITS OWN NAMED ENTRY. Skipping it here was
            // the bug: Home's group sits on BRG_ACF_PAGE, so it got no menu item at all, and
            // clicking "Section Content" landed on the FIRST registered child — Brands. Home's
            // 25 fields existed and were unreachable, and the sidebar read as though the home
            // page simply could not be edited. Sean hit this twice and was right both times.
            //
            // Registering a sub-page whose menu_slug EQUALS the parent slug is the documented
            // WordPress way to label that first entry: it replaces the auto-generated duplicate
            // of the parent title instead of adding a second one. So the parent keeps its own
            // page, that page is Home, and it now says "Home" in the sidebar like the other five.
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
