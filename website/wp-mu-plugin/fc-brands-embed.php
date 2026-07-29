<?php
/**
 * Plugin Name: FC-Brands Embed
 * Description: Registry of code-driven components hosted on Netlify, exposed as shortcodes that render natively in the page (no iframe). Versioned variants + a main alias that serves the active one. Install once; content updates via git push → Netlify.
 * Version: 1.2.0
 * Author: Vivo Creative
 *
 * INSTALL (once per WordPress site):
 *   Upload to  /wp-content/mu-plugins/fc-brands-embed.php   (mu-plugins auto-activate).
 *
 * HOW IT WORKS — the $FCB_EMBEDS registry below defines, per component:
 *   • every version  ([name_v1], [name_v2], … — always available for testing)
 *   • one "active" version that the plain [name] alias serves (your live pick)
 *   Switch which version is live = change that component's 'active' value and
 *   re-upload this file. Alternates keep working under their _vN names.
 *
 * USE (Oxygen Code Block, Gutenberg shortcode block, etc.):
 *   [brg_home]              → the ACTIVE version of the BRG home page
 *   [brg_home ttl="0"]      → no caching (use on TEST pages for instant updates while iterating)
 *   [brg_brands] [brg_team] [brg_community] [brg_careers] [brg_press]
 *   [temper_splash]         → Temper (unchanged)
 *   [fc_embed url="https://xxx.netlify.app/embed.html"]  → generic one-off
 *
 * Cache: fragments are cached server-side (default 120s). ttl="0" = always fresh.
 */

if (!defined('ABSPATH')) exit;

/* ============================================================================
 * REGISTRY — add components/sites here. Each 'versions' url is a Netlify
 * fragment (embed.html). 'active' = which version the plain [name] alias serves.
 *
 * ⚠️  BRG: replace `brg-web` below with your real Netlify subdomain once the
 *     repo (github.com/seanmarshall21/brg-web) is connected to Netlify.
 * ==========================================================================*/
$BRG = 'https://brg-web.netlify.app';   // ← set to your BRG Netlify site URL

$GLOBALS['FCB_EMBEDS'] = array(

  'temper_splash' => array(
    'active'   => 'v1',
    'versions' => array(
      'v1' => 'https://temperfest.netlify.app/embed.html',
      'v2' => 'https://temperfest.netlify.app/v2/embed.html',
    ),
  ),

  // ---- Blacktop Restaurant Group website pages ----
  'brg_home'      => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/home/embed.html')),
  'brg_brands'    => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/brands/embed.html')),
  'brg_team'      => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/team/embed.html')),
  'brg_community' => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/community/embed.html')),
  'brg_careers'   => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/careers/embed.html')),
  'brg_press'     => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/press/embed.html')),

);

/**
 * Core: fetch a Netlify fragment (server-side), cache it, output it natively.
 * Only *.netlify.app hosts allowed.
 */
function fcb_embed_render($url, $atts = array()) {
    $a = shortcode_atts(array('ttl' => '120'), $atts);

    $host = wp_parse_url($url, PHP_URL_HOST);
    if (!$host || !preg_match('/\.netlify\.app$/', $host)) {
        return '<!-- fc_embed: host not allowed -->';
    }

    $ttl = max(0, intval($a['ttl']));
    $key = 'fcb_embed_' . md5($url);

    $html = $ttl ? get_transient($key) : false;
    if ($html === false) {
        $res = wp_remote_get($url, array('timeout' => 6));
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
            $cached = get_transient($key . '_last');       // fall back to last good copy
            return $cached !== false ? $cached : '<!-- fc_embed: fetch failed -->';
        }
        $html = wp_remote_retrieve_body($res);
        if ($ttl) set_transient($key, $html, $ttl);
        set_transient($key . '_last', $html, WEEK_IN_SECONDS);
    }
    return $html;
}

/* Generic one-off: [fc_embed site="temperfest"] or [fc_embed url="..."] */
add_shortcode('fc_embed', function ($atts) {
    $a = shortcode_atts(array('site' => '', 'url' => '', 'ttl' => '120'), $atts, 'fc_embed');
    $url = $a['url'];
    if (!$url && $a['site']) {
        $site = preg_replace('/[^a-z0-9-]/', '', strtolower($a['site']));
        $url  = 'https://' . $site . '.netlify.app/embed.html';
    }
    if (!$url) return '<!-- fc_embed: no site/url given -->';
    return fcb_embed_render($url, array('ttl' => $a['ttl']));
});

/* Register [name] (active) + [name_vN] (each version) from the registry. */
foreach ($GLOBALS['FCB_EMBEDS'] as $base => $cfg) {
    $versions = $cfg['versions'];
    $active   = isset($versions[$cfg['active']]) ? $cfg['active'] : array_key_first($versions);

    // main alias → active version
    add_shortcode($base, function ($atts) use ($versions, $active) {
        return fcb_embed_render($versions[$active], is_array($atts) ? $atts : array());
    });

    // per-version shortcodes
    foreach ($versions as $v => $vurl) {
        add_shortcode($base . '_' . $v, function ($atts) use ($vurl) {
            return fcb_embed_render($vurl, is_array($atts) ? $atts : array());
        });
    }
}
