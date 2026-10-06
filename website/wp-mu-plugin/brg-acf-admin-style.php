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

	/* ── Group headings have to be unmistakably headings ────────────────────
	   Sean, 5 Oct: "we need thicker separators between all of the sections… it's very
	   hard to tell where one starts and the other one ends", naming Hero darkness
	   against Hero background and the splash group against it.

	   He is describing a real structural trap, not a taste. ACF accordions are FLAT
	   MARKERS, not containers: the heading is a sibling of the fields that follow it,
	   nested in nothing, so by default a group boundary carries exactly the same
	   hairline as the border between two ordinary fields. There is no box to see.
	   Everything below is therefore drawn on the heading itself. */
	.acf-field-accordion > .acf-label,
	.acf-field.acf-accordion > .acf-label { margin: 0; }
	.acf-field-accordion,
	.acf-field.acf-accordion {
		border-top: 6px solid #d7dce1 !important;   /* the separator he asked for */
		margin-top: 26px;
		background: #f1f3f5;
	}
	/* The first group on a page needs no gap above it — the page note is already there. */
	.acf-fields > .acf-field-accordion:first-child,
	.acf-fields > .acf-field.acf-accordion:first-child { margin-top: 0; }
	/* An accordion that CLOSES a group carries no title; it must not draw a second bar. */
	.acf-field-accordion.-endpoint,
	.acf-field.acf-accordion.-endpoint {
		border-top: 0 !important; margin-top: 0; background: none;
	}
	.acf-accordion-title {
		font-size: 14px !important;
		font-weight: 800 !important;
		letter-spacing: .02em;
		color: #14181c !important;
		padding: 13px 14px !important;
		text-transform: none;
	}
	.acf-accordion-title label { font-weight: 800 !important; }
	/* Open and closed should be tellable at a glance, not only by the chevron. */
	.acf-field-accordion.-open > .acf-label .acf-accordion-title,
	.acf-field.acf-accordion.-open > .acf-label .acf-accordion-title {
		background: #e7ebef; box-shadow: inset 4px 0 0 #1c1a16;
	}
	.acf-accordion-title:hover { background: #e4e8ec; }
	/* The fields belonging to an open group sit on white so the grey bar reads as its lid. */
	.acf-field-accordion .acf-accordion-content { background: #fff; }

	/* ── Repeater rows read as separate records, not one long form ────────── */
	/* Sean: "they blend together too easily." With a headshot, name, title and quote
	   per person and nothing between them, row two looks like more of row one. ACF
	   renders rows as table rows, so the separator has to be a border on the cells —
	   a radius on a <tr> does nothing. */
	.acf-repeater .acf-row > td { background: #fff; padding-top: 14px; padding-bottom: 16px; }
	.acf-repeater .acf-row + .acf-row > td { border-top: 3px solid #e6e9ec; }
	.acf-repeater .acf-row > .acf-row-handle {
		background: #f4f5f7;
		border-right: 1px solid #e3e5e8;
		color: #6b7075;
		font-weight: 700;
	}
	/* The collapsed row is the point of the collapse: it must read as a line, not a bar. */
	.acf-repeater .acf-row.-collapsed > td { background: #fbfcfd; }
	.acf-repeater .acf-row.-collapsed .acf-row-handle { background: #eef0f2; }
	.acf-repeater .acf-row .acf-fields > .acf-field { border-top-color: #f0f2f4; }
	.acf-repeater > .acf-actions .acf-button { font-weight: 600; }
	/* An image sub-field renders a large preview; cap it so one row is not a screenful. */
	.acf-repeater .acf-image-uploader .image-wrap { max-width: 190px; }

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
	
	/* ── Instructions become tooltips ────────────────────────────────────────
	   Sean, 1 Oct: "can those be tooltips so they don't take up so much space, so you
	   don't see them unless you hover over it?" The help text is good and worth keeping;
	   it just should not cost a paragraph of vertical space per field on a screen where
	   nine people are being edited.

	   The text stays in the DOM and keeps its markup, so nothing is lost to anyone
	   reading the page with a screen reader — it is moved out of flow, not removed.
	   focus-within is in the selector for the same reason: a keyboard user tabbing to the
	   field gets the help a mouse user gets by hovering.

	   The marker only appears where there IS help, via :has(). Where :has() is not
	   supported the marker is simply absent and the tooltip still works on hover — the
	   failure is a missing hint, not a missing field. */
	.acf-field > .acf-label { position: relative; }
	.acf-field > .acf-label .description,
	.acf-field > .acf-label p.description {
		position: absolute;
		left: 0;
		top: calc(100% + 2px);
		z-index: 40;
		width: max(260px, 100%);
		max-width: 420px;
		margin: 0;
		background: #1c1a16;
		color: #f3f4f5;
		padding: 9px 11px;
		border-radius: 6px;
		font-size: 12.5px;
		line-height: 1.5;
		box-shadow: 0 6px 18px rgba(0,0,0,.22);
		opacity: 0;
		visibility: hidden;
		transform: translateY(-3px);
		transition: opacity .12s ease, transform .12s ease;
		pointer-events: none;
	}
	.acf-field > .acf-label:hover .description,
	.acf-field > .acf-label:focus-within .description {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}
	/* Readable against the dark tooltip; the light-background rules above are for text
	   still rendered in flow elsewhere in wp-admin. */
	.acf-field > .acf-label .description code {
		background: rgba(255,255,255,.12);
		border-color: rgba(255,255,255,.18);
		color: #fff;
	}
	.acf-field > .acf-label .description strong { color: #fff; }
	.acf-field > .acf-label:has(.description) label::after {
		content: "?";
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		margin-left: 6px;
		border-radius: 50%;
		background: #d7dade;
		color: #4a4f54;
		font-size: 10px;
		font-weight: 700;
		vertical-align: 1px;
		cursor: help;
	}
	.acf-field > .acf-label:hover:has(.description) label::after { background: #19C7C2; color: #10312f; }

	/* ── A crew row: headshot left, then two rows of three ───────────────────
	   Sean, 1 Oct: "you have the headshot, and then you have a group of two rows, three
	   columns each: name, title, quote / background color, crop, let the photo hang
	   outside the box."

	   Widths alone cannot say this. ACF fields flow in a line, so a field spanning two
	   rows needs the container to be a grid — and the photo needs to be addressable,
	   which is what the generated brg-f-* classes are for. nth-child would work until a
	   slot is reordered, and then it would be wrong silently.

	   Falls back to the ordinary flow below 1100px, where four columns inside the admin
	   content area would be narrower than the inputs they hold. */
	@media (min-width: 1100px) {
		/* TWELVE CONTENT COLUMNS, not four, because the two rows do not divide the same
		   way: Sean's sketch puts FOUR fields on the top row and THREE underneath, and no
		   single column count expresses both. Twelve is the smallest number both 4 and 3
		   divide into, so the top row spans 3 each and the bottom spans 4 each, and the
		   two rows line up at the outer edges while breaking differently inside. */
		.brg-f-members .acf-row > .acf-fields {
			display: grid;
			grid-template-columns: 20% repeat(12, 1fr);
			align-items: start;
		}
		.brg-f-members .acf-row > .acf-fields > .acf-field {
			width: auto !important;
			float: none !important;
			border-top: 0;
			padding: 12px 14px;
			min-width: 0;            /* grid items default to min-content: without this a long
			                            select label refuses to shrink and pushes the row wide */
		}
		/* The headshot is the left column against BOTH rows. Explicit placement, because
		   auto-placement would drop it into the flow and the rest would shuffle up. */
		.brg-f-members .acf-row > .acf-fields > .brg-f-photo {
			grid-row: 1 / span 2;
			grid-column: 1;
		}
		/* Row 1 — the things you read: four across. */
		.brg-f-members .acf-row > .acf-fields > .brg-f-name,
		.brg-f-members .acf-row > .acf-fields > .brg-f-title,
		.brg-f-members .acf-row > .acf-fields > .brg-f-quote,
		.brg-f-members .acf-row > .acf-fields > .brg-f-bg_color { grid-column: span 3; }
		/* Row 2 — the things you set: three across, wider because their labels are sentences. */
		.brg-f-members .acf-row > .acf-fields > .brg-f-crop,
		.brg-f-members .acf-row > .acf-fields > .brg-f-overflow,
		.brg-f-members .acf-row > .acf-fields > .brg-f-hovercrop { grid-column: span 4; }
	}
</style>
	<?php
} );
