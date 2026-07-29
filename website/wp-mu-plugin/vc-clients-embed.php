<?php
/**
 * Plugin Name: VC-Clients Embed
 * Description: Vivo Creative client sites, built as code-driven HTML fragments on Netlify and rendered natively via shortcodes (no iframe). Versioned variants + a main alias per component. Fully namespaced so it coexists with FC-Brands Embed. Install once; content updates via git push → Netlify.
 * Version: 1.0.0
 * Author: Vivo Creative
 *
 * INSTALL (once per WordPress site):
 *   Upload to  /wp-content/mu-plugins/vc-clients-embed.php   (mu-plugins auto-activate).
 *   Safe to run alongside fc-brands-embed.php — different names throughout.
 *
 * HOW IT WORKS — the $VCC_EMBEDS registry below defines, per component:
 *   • every version  ([name_v1], [name_v2], … — always available for testing)
 *   • one "active" version that the plain [name] alias serves (your live pick)
 *   Switch which version is live = change that component's 'active' value and
 *   re-upload this file. Alternates keep working under their _vN names.
 *
 * USE (Oxygen Code Block, Gutenberg shortcode block, etc.):
 *   [brg_home]              → ACTIVE version of the BRG home page
 *   [brg_home ttl="0"]      → no caching (use on TEST pages for instant updates)
 *   [brg_brands] [brg_team] [brg_community] [brg_careers] [brg_press]
 *   [vc_embed url="https://xxx.netlify.app/embed.html"]  → generic one-off
 *
 * Add a new Vivo client: give them a Netlify site and add a registry block below.
 * Cache: fragments are cached server-side (default 120s). ttl="0" = always fresh.
 */

if (!defined('ABSPATH')) exit;

/* ============================================================================
 * REGISTRY — one block per client component. 'versions' url = a Netlify
 * fragment (embed.html). 'active' = which version the plain [name] alias serves.
 * ==========================================================================*/
$BRG = 'https://brg-web.netlify.app';   // ← Blacktop Restaurant Group Netlify site

$GLOBALS['VCC_EMBEDS'] = array(

  // ---- Blacktop Restaurant Group ----
  'brg_home'      => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/home/embed.html')),
  'brg_brands'    => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/brands/embed.html')),
  'brg_team'      => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/team/embed.html')),
  'brg_community' => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/community/embed.html')),
  'brg_careers'   => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/careers/embed.html')),
  'brg_press'     => array('active'=>'v1','versions'=>array('v1'=>$BRG.'/press/embed.html')),

  // ---- Next Vivo client (example) ----
  // 'acme_home' => array('active'=>'v1','versions'=>array(
  //   'v1' => 'https://acme-web.netlify.app/home/embed.html',
  // )),

);

/**
 * Core: fetch a Netlify fragment (server-side), cache it, output it natively.
 * Only *.netlify.app hosts allowed.
 */
function vcc_embed_render($url, $atts = array()) {
    $a = shortcode_atts(array('ttl' => '120'), $atts);

    $host = wp_parse_url($url, PHP_URL_HOST);
    if (!$host || !preg_match('/\.netlify\.app$/', $host)) {
        return '<!-- vc_embed: host not allowed -->';
    }

    $ttl = max(0, intval($a['ttl']));
    $key = 'vcc_embed_' . md5($url);

    $html = $ttl ? get_transient($key) : false;
    if ($html === false) {
        $res = wp_remote_get($url, array('timeout' => 6));
        if (is_wp_error($res) || wp_remote_retrieve_response_code($res) !== 200) {
            $cached = get_transient($key . '_last');       // fall back to last good copy
            return $cached !== false ? $cached : '<!-- vc_embed: fetch failed -->';
        }
        $html = wp_remote_retrieve_body($res);
        if ($ttl) set_transient($key, $html, $ttl);
        set_transient($key . '_last', $html, WEEK_IN_SECONDS);
    }
    return $html;
}

/* Generic one-off: [vc_embed site="brg-web"] or [vc_embed url="..."] */
add_shortcode('vc_embed', function ($atts) {
    $a = shortcode_atts(array('site' => '', 'url' => '', 'ttl' => '120'), $atts, 'vc_embed');
    $url = $a['url'];
    if (!$url && $a['site']) {
        $site = preg_replace('/[^a-z0-9-]/', '', strtolower($a['site']));
        $url  = 'https://' . $site . '.netlify.app/embed.html';
    }
    if (!$url) return '<!-- vc_embed: no site/url given -->';
    return vcc_embed_render($url, array('ttl' => $a['ttl']));
});

/* Register [name] (active) + [name_vN] (each version) from the registry. */
foreach ($GLOBALS['VCC_EMBEDS'] as $base => $cfg) {
    $versions = $cfg['versions'];
    $active   = isset($versions[$cfg['active']]) ? $cfg['active'] : array_key_first($versions);

    add_shortcode($base, function ($atts) use ($versions, $active) {
        return vcc_embed_render($versions[$active], is_array($atts) ? $atts : array());
    });

    foreach ($versions as $v => $vurl) {
        add_shortcode($base . '_' . $v, function ($atts) use ($vurl) {
            return vcc_embed_render($vurl, is_array($atts) ? $atts : array());
        });
    }
}
