<?php
/**
 * BRG — Section Content admin styling
 * -----------------------------------------------------------------------------
 * Version: 1.0.0
 * CSS ONLY. Nothing here touches fields, names, values or storage. Deleting this
 * file undoes all of it and loses nothing.
 *
 * WHY IT EXISTS. Nineteen field groups and sixty-two fields on one options page
 * render as nineteen boxes that blend into each other. It is not a cosmetic
 * complaint: with nothing separating the blocks you cannot tell where one
 * section's content ends and the next begins, and the screen stops being usable
 * somewhere around the third section. fc-brands hit this at four groups and
 * thirty-eight fields; we have five times the groups.
 *
 * WHY CSS AND NOT STRUCTURE. fc-brands tried structure twice and both attempts
 * were wrong in the same way. ACF cannot nest tabs. And wrapping fields in an ACF
 * `group` changes how every child is stored — `{group}_{child}` — so every value
 * already typed stops being found: still in the options table, invisible in the
 * admin. **The layout problem was never a data problem**, and every attempt to
 * fix it in the data layer risked the one thing that cannot be rebuilt, which is
 * what the human typed. So: presentation stays in presentation.
 *
 * SCOPING. Returns immediately unless the current screen is our options page, so
 * it never touches the rest of wp-admin. The screen id is derived from
 * BRG_ACF_PAGE rather than repeated — fc-brands lists that repetition as the
 * third unenforced copy of the slug, and a third copy is a third thing to drift.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Collapse every section but the first, ON FIRST VISIT ONLY.
 *
 * Six page cards is better than nineteen, but it is still a long screen and you
 * almost always want one of them. So the default is: Home open, the rest closed.
 *
 * The important half is "default". WordPress stores each user's open/closed choices in
 * user meta and this filter only supplies a value when there is nothing stored — so the
 * moment Sean collapses or expands anything, his choice wins and this stops applying,
 * permanently and per user. Forcing the state on every load would be the obvious
 * implementation and it would be maddening: you open Careers, reload, and it has shut
 * itself again.
 *
 * The group keys are read from ACF rather than listed. The generator names them
 * group_brg_page_<page>, and a hardcoded list here would be a second home for something
 * the field groups already know — and it would silently stop matching the day a page is
 * added, leaving that section always open with nothing to say why.
 */
add_action( 'current_screen', function ( $screen ) {
	if ( ! $screen ) return;
	$slug = defined( 'BRG_ACF_PAGE' ) ? BRG_ACF_PAGE : 'brg-section-content';
	if ( strpos( $screen->id, $slug ) === false ) return;
	if ( ! function_exists( 'acf_get_field_groups' ) ) return;

	add_filter( 'get_user_option_closedpostboxes_' . $screen->id, function ( $closed ) use ( $slug ) {
		// An array means this user has toggled something. Theirs beats ours, always.
		if ( is_array( $closed ) ) return $closed;

		$groups = acf_get_field_groups( array( 'options_page' => $slug ) );
		if ( ! $groups ) return $closed;

		// Same order the screen renders in (menu_order), so "the first one" is the first
		// one he sees rather than whichever ACF happened to return first.
		usort( $groups, function ( $a, $b ) {
			return ( isset( $a['menu_order'] ) ? $a['menu_order'] : 0 )
			     <=> ( isset( $b['menu_order'] ) ? $b['menu_order'] : 0 );
		} );

		$ids = array();
		foreach ( array_slice( $groups, 1 ) as $g ) {
			if ( ! empty( $g['key'] ) ) $ids[] = 'acf-' . $g['key'];
		}
		return $ids;
	} );
} );

add_action( 'admin_head', function () {
	if ( ! function_exists( 'get_current_screen' ) ) return;
	$screen = get_current_screen();
	if ( ! $screen ) return;

	// Derived, never retyped. If the page moves, this follows it.
	$slug = defined( 'BRG_ACF_PAGE' ) ? BRG_ACF_PAGE : 'brg-section-content';
	if ( strpos( $screen->id, $slug ) === false ) return;
	?>
	<style id="brg-acf-admin">
	/* ── Each group reads as its own card, not as more page ──────────────── */
	.acf-postbox,
	#poststuff .postbox {
		border: 1px solid #d5d8dc;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 22px;
		box-shadow: 0 1px 2px rgba(16,15,13,.05);
	}
	#poststuff .postbox > .postbox-header {
		background: #1c1a16;
		border-bottom: 0;
	}
	#poststuff .postbox > .postbox-header h2,
	#poststuff .postbox > .postbox-header h3 {
		color: #f4f1ea;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: .04em;
		padding: 13px 16px;
	}
	/* The collapse/reorder handles are near-invisible on the dark bar otherwise. */
	#poststuff .postbox > .postbox-header .handle-actions .toggle-indicator::before,
	#poststuff .postbox > .postbox-header .handle-order-higher::before,
	#poststuff .postbox > .postbox-header .handle-order-lower::before { color: rgba(244,241,234,.66); }
	#poststuff .postbox > .postbox-header .handle-actions button:hover .toggle-indicator::before { color: #fff; }

	/* A closed card is just its title bar, so that bar has to look clickable. */
	#poststuff .postbox.closed { margin-bottom: 10px; }
	#poststuff .postbox.closed > .postbox-header { border-radius: 9px; }
	#poststuff .postbox > .postbox-header { cursor: pointer; }

	/* ── Rows stop running together ──────────────────────────────────────── */
	.acf-fields > .acf-field {
		padding: 16px 16px 18px;
		border-top: 1px solid #eceef0;
	}
	.acf-fields > .acf-field:first-child { border-top: 0; }
	.acf-field .acf-label label {
		font-weight: 700;
		font-size: 13px;
		color: #1c1a16;
		margin-bottom: 3px;
	}

	/* ── Instructions carry real HTML, so they have to look like something ── */
	.acf-field .acf-label .description,
	.acf-field p.description {
		color: #6b7075;
		font-size: 12.5px;
		line-height: 1.5;
		margin: 2px 0 9px;
	}
	.acf-field .description code {
		background: #f2f3f5;
		border: 1px solid #e3e5e8;
		border-radius: 4px;
		padding: 1px 5px;
		font-size: 12px;
	}
	.acf-field .description strong { color: #1c1a16; }

	/* ── The generated "what this is" message reads as a caption, not a field ─ */
	.acf-field-message {
		background: #f7f8f9;
		border-top: 0 !important;
		padding: 13px 16px !important;
	}
	.acf-field-message .acf-label { display: none; }
	.acf-field-message p { margin: 0 0 6px; color: #4a4f54; font-size: 12.5px; }
	.acf-field-message p:last-child { margin-bottom: 0; }

	/* ── The tab row is NAVIGATION, not more content ─────────────────────── */
	.acf-tab-wrap {
		background: #f7f8f9;
		border-bottom: 1px solid #e3e5e8;
	}
	.acf-tab-wrap .acf-tab-group {
		padding: 10px 14px 0;
		border-bottom: 0;
	}
	.acf-tab-group li a {
		border: 1px solid transparent;
		border-bottom: 0;
		border-radius: 7px 7px 0 0;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 600;
		color: #5b6167;
		background: transparent;
	}
	.acf-tab-group li a:hover { color: #1c1a16; background: #eef0f2; }
	.acf-tab-group li.active a {
		background: #fff;
		border-color: #e3e5e8;
		color: #1c1a16;
		box-shadow: inset 0 3px 0 #19C7C2;
	}
	/* The first field after a tab shouldn't carry the row rule — the tab is the divider. */
	.acf-field-tab + .acf-field { border-top: 0; }

	/* ── Inputs ──────────────────────────────────────────────────────────── */
	.acf-field input[type=text],
	.acf-field textarea {
		border-radius: 6px;
		border-color: #c9ced3;
		padding: 7px 10px;
	}
	.acf-field input[type=text]:focus,
	.acf-field textarea:focus {
		border-color: #19C7C2;
		box-shadow: 0 0 0 1px #19C7C2;
	}
	.acf-field textarea { min-height: 84px; line-height: 1.5; }

	/* Two columns pair a label with its link on one row. The widths come from the
	   generator (wrapper.width), so this only has to stop the seam disappearing. */
	.acf-fields > .acf-field[data-width] { border-left: 1px solid #eceef0; }
	.acf-fields > .acf-field[data-width]:first-of-type,
	.acf-fields > .acf-field[data-width].acf-field--first { border-left: 0; }

	/* Save button — this page is long, and the button is the thing you hunt for. */
	.acf-admin-single-options-page .acf-button,
	#submitdiv .button-primary { font-weight: 600; }

	@media screen and (max-width: 782px) {
		.acf-fields > .acf-field[data-width] { border-left: 0; }
	}
	</style>
	<?php
} );
