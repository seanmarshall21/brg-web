<?php
/**
 * BRG — "Section Content" ACF options page
 * -----------------------------------------------------------------------------
 * Registers ONE options page that every section's field group attaches to:
 *
 *     Section Content   (top-level in wp-admin)
 *
 * Values live at the SITE level — read with get_field( 'brg_<id>_<slot>', 'option' ).
 * One set of content per section, shared wherever that section is placed. (Correct
 * for a brochure site; if a section ever needs different copy on two pages, move that
 * group's location to the page and read with the page id instead.)
 *
 * WHY ONE PAGE, NOT ONE PER SECTION
 *   Named for the JOB ("Section Content"), so each section's generated field group
 *   attaches to the SAME page as another box — no menu clutter.
 *
 * THE ONE VALUE THAT MUST MATCH (silent failure if it doesn't):
 *   menu_slug here === every generated acf.json's location value ("brg-section-content").
 *   If they differ the group imports fine and shows up NOWHERE, with no error.
 *
 * INSTALL: paste into a WPCode PHP snippet, "Run Everywhere", Active. Requires ACF Pro
 * (acf_add_options_page). Then import each section's acf.json under ACF → Tools.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'acf/init', function () {
    if ( ! function_exists( 'acf_add_options_page' ) ) return;   // ACF Pro not active
    acf_add_options_page( array(
        'page_title'      => 'Section Content',
        'menu_title'      => 'Section Content',
        'menu_slug'       => 'brg-section-content',   // MUST equal each acf.json location value
        'capability'      => 'edit_posts',            // editors can maintain copy
        'autoload'        => true,                    // one query for all of it on the front end
        'icon_url'        => 'dashicons-layout',
        'position'        => 26,
        'update_button'   => 'Save content',
        'updated_message' => 'Section content saved.',
    ) );
} );
