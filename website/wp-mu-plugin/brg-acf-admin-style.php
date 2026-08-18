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
