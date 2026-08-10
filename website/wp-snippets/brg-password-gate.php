<?php
/**
 * BRG — Branded Password Gate (Oxygen-safe) + [brg_password] shortcode
 * -----------------------------------------------------------------------------
 * Oxygen renders its own template and BYPASSES WordPress's native page password
 * (and hides the visibility toggle). This intercepts front-end singular views:
 * if a page has a password set and is still locked, it renders a branded BRG
 * unlock screen and exits BEFORE Oxygen renders. Unlocking uses WordPress's own
 * postpass handler + cookie, so it's 100% native (no custom auth).
 *
 * ALSO registers [brg_password] — the same branded unlock form as a block you
 * can drop into any page/section (e.g. to build a custom locked landing page).
 *
 * INDEPENDENT of the vc-clients embed plugin. This is WordPress-side only.
 *
 * INSTALL: paste into a WPCode PHP snippet, "Run Everywhere", Active.
 *          (Or drop into /wp-content/mu-plugins/ as its own .php file.)
 *
 * TOGGLE ON  (per page): Pages list → hover the page → Quick Edit → set a
 *            "Password" → Update.  (Quick Edit's Password field is always
 *            available, even when the page is built with Oxygen.)
 * TOGGLE OFF: clear that Password field → Update.
 *
 * CONFIG (optional): define any of these ABOVE this snippet to override —
 *   BRG_PW_TITLE, BRG_PW_SUB, BRG_PW_REMEMBER_DAYS, BRG_PW_BG.
 */
if ( ! defined( 'ABSPATH' ) ) exit;

if ( ! defined( 'BRG_PW_TITLE' ) )         define( 'BRG_PW_TITLE', 'Members Only' );
if ( ! defined( 'BRG_PW_SUB' ) )           define( 'BRG_PW_SUB', 'Enter the password to continue.' );
if ( ! defined( 'BRG_PW_REMEMBER_DAYS' ) ) define( 'BRG_PW_REMEMBER_DAYS', 30 ); // how long the unlock is remembered
// Backdrop image (grayscale, vignetted). Same skater shot as the Home hero. Set '' for a plain dark bg.
if ( ! defined( 'BRG_PW_BG' ) )            define( 'BRG_PW_BG', 'https://blacktoprestaurantgroup.com/wp-content/uploads/2026/06/skater.webp' );

/* Remember the unlock longer. WP's native postpass cookie defaults to 10 days;
   this extends it to BRG_PW_REMEMBER_DAYS for everyone. */
add_filter( 'post_password_expires', function () {
	return time() + ( (int) BRG_PW_REMEMBER_DAYS ) * DAY_IN_SECONDS;
} );

/* Auto-gate: show the branded screen before Oxygen renders a locked page. */
add_action( 'template_redirect', function () {
	if ( is_admin() || ! is_singular() ) return;
	$post = get_queried_object();
	if ( ! $post || empty( $post->post_password ) ) return; // no password on this page
	if ( ! post_password_required( $post ) ) return;         // already unlocked this session

	// If the postpass cookie exists but the page is still locked, the last try was wrong.
	$wrong = ! empty( $_COOKIE[ 'wp-postpass_' . COOKIEHASH ] );
	nocache_headers();
	if ( ! headers_sent() ) { status_header( 200 ); header( 'Content-Type: text/html; charset=' . get_bloginfo( 'charset' ) ); }
	echo '<!DOCTYPE html><html ' . get_language_attributes() . '><head>'
	   . '<meta charset="' . esc_attr( get_bloginfo( 'charset' ) ) . '">'
	   . '<meta name="viewport" content="width=device-width, initial-scale=1">'
	   . '<meta name="robots" content="noindex,nofollow">'
	   . '<title>' . esc_html( get_bloginfo( 'name' ) ) . ' — Locked</title></head><body style="margin:0">';
	echo brg_pw_block( array( 'title' => BRG_PW_TITLE, 'sub' => BRG_PW_SUB, 'bg' => 'on', 'fullscreen' => 'on', 'wrong' => $wrong ) );
	echo '</body></html>';
	exit;
}, 1 );

/* [brg_password]  — branded unlock form as a droppable block.
   Attrs: title, sub, bg="on|off" (photo backdrop), fullscreen="on|off". */
add_shortcode( 'brg_password', function ( $atts ) {
	$a = shortcode_atts( array(
		'title'      => BRG_PW_TITLE,
		'sub'        => BRG_PW_SUB,
		'bg'         => 'on',
		'fullscreen' => 'off',
	), $atts, 'brg_password' );
	$a['wrong'] = ! empty( $_COOKIE[ 'wp-postpass_' . COOKIEHASH ] ) && is_singular() && post_password_required();
	return brg_pw_block( $a );
} );

/* Shared branded block (CSS emitted once) — used by both the gate and the shortcode. */
if ( ! function_exists( 'brg_pw_block' ) ) :
function brg_pw_block( $a ) {
	static $css_done = false;
	$action = esc_url( home_url( '/wp-login.php?action=postpass' ) );
	$title  = esc_html( $a['title'] );
	$sub    = esc_html( $a['sub'] );
	$bg     = ( $a['bg'] !== 'off' ) && BRG_PW_BG !== '';
	$bgurl  = esc_url( BRG_PW_BG );
	$full   = ( isset( $a['fullscreen'] ) && $a['fullscreen'] !== 'off' );
	$err    = ! empty( $a['wrong'] ) ? '<p class="bpw-err">Incorrect password — try again.</p>' : '';

	$css = '';
	if ( ! $css_done ) {
		$css_done = true;
		$css = '<style>
		@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap");
		@font-face{font-family:"Blanco Cavelary";src:url("https://blacktoprestaurantgroup.com/wp-content/uploads/2026/06/BlancoCavelary.woff2") format("woff2");font-display:swap;font-weight:400;}
		.bpw{position:relative;width:100%;display:grid;place-items:center;padding:12vh 6vw;box-sizing:border-box;
		  --yellow:#FCE200;--teal:#19C7C2;--ink:#231F20;
		  font-family:"Montserrat",system-ui,Arial,sans-serif;color:#fff;text-align:center;background:#131210;}
		.bpw.bpw-full{min-height:100svh;}
		.bpw *{box-sizing:border-box;}
		.bpw-bg{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
		.bpw-bg::before{content:"";position:absolute;inset:0;transform:scale(1.06);filter:grayscale(1) contrast(1.05);opacity:.28;
		  background:#131210 url("' . $bgurl . '") center/cover no-repeat;}
		.bpw-bg::after{content:"";position:absolute;inset:0;
		  background:radial-gradient(120% 100% at 50% 38%,transparent 46%,rgba(19,18,16,.72) 82%,rgba(19,18,16,.94) 100%);}
		.bpw-top{position:absolute;top:0;left:0;right:0;height:5px;z-index:2;background:var(--yellow);}
		.bpw-wrap{position:relative;z-index:2;width:100%;max-width:460px;}
		.bpw-logo{display:inline-flex;align-items:baseline;gap:9px;line-height:1;margin:0 auto 30px;}
		.bpw-logo b{background:var(--yellow);color:var(--ink);font-weight:800;font-size:clamp(20px,4vw,28px);
		  letter-spacing:.01em;padding:.08em .32em;}
		.bpw-logo span{opacity:.72;font-size:clamp(9px,1.4vw,11px);text-transform:uppercase;letter-spacing:.18em;}
		.bpw-h{font-family:"Blanco Cavelary","Montserrat",cursive;font-weight:400;
		  font-size:clamp(30px,7vw,52px);text-transform:uppercase;letter-spacing:.01em;line-height:.92;margin:0;}
		.bpw-sub{margin:12px 0 0;font-size:clamp(13px,2vw,16px);letter-spacing:.02em;color:rgba(255,255,255,.72);}
		.bpw-err{margin:14px 0 0;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#ff5a5a;}
		.bpw-form{margin-top:28px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}
		.bpw-form input{flex:1 1 220px;min-width:0;background:rgba(8,8,7,.55);color:#fff;border:1px solid rgba(255,255,255,.28);
		  border-radius:2px;padding:16px;font-size:16px;letter-spacing:.02em;outline:none;font-family:inherit;
		  transition:border-color .15s,box-shadow .15s;}
		.bpw-form input::placeholder{color:rgba(255,255,255,.42);text-transform:uppercase;letter-spacing:.16em;font-size:12px;}
		.bpw-form input:focus{border-color:var(--teal);box-shadow:0 0 0 3px rgba(25,199,194,.20),0 0 22px rgba(25,199,194,.22);}
		.bpw-form button{flex:0 0 auto;background:var(--yellow);color:var(--ink);border:0;border-radius:2px;padding:16px 32px;
		  font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;font-family:inherit;
		  transition:transform .16s ease,box-shadow .2s ease,filter .15s;}
		.bpw-form button:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(0,0,0,.28);filter:brightness(1.04);}
		.bpw-form button:active{transform:translateY(0);}
		</style>';
	}

	$out  = $css;
	$out .= '<div class="bpw' . ( $full ? ' bpw-full' : '' ) . '">';
	if ( $bg ) $out .= '<div class="bpw-bg"></div>';
	$out .= '<span class="bpw-top" aria-hidden="true"></span>';
	$out .= '<div class="bpw-wrap">'
	      . '<span class="bpw-logo"><b>BLACKTOP</b><span>Restaurant Group</span></span>'
	      . '<h1 class="bpw-h">' . $title . '</h1>'
	      . '<p class="bpw-sub">' . $sub . '</p>'
	      . $err
	      . '<form class="bpw-form" action="' . $action . '" method="post">'
	      . '<input type="password" name="post_password" placeholder="Password" autocomplete="current-password" required>'
	      . '<button type="submit">Enter</button>'
	      . '</form>'
	      . '</div></div>';
	return $out;
}
endif;
