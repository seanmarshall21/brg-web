<?php
/**
 * POSITIVE CONTROL — this file is SUPPOSED to be rejected. Never deployed.
 *
 * Reproduces the 2026-10-03 outage: a second function given a name that is already
 * taken, both wrapped in the house's if(!function_exists()) guard.
 *
 * Why nothing else catches it:
 *   - it is valid PHP, so `php -l` passes;
 *   - the name IS defined, by the first block, so function_exists() returns true and the
 *     "declared but NOT defined after load" assertion is satisfied by the wrong function;
 *   - it only misbehaves when CALLED, so loading the plugin looks clean.
 *
 * On the live site the shadowed reader's calls landed in the builder, which calls the
 * same name again — infinite recursion, stack exhausted, 500 on every freshly rendered
 * page. The cached homepage still answered 200, so the outage read as partial.
 */

if ( ! function_exists( 'fixture_shadowed' ) ) {
    /* The REAL one. Takes a config and a slug, returns a pair. */
    function fixture_shadowed( $cfg, $slug ) {
        /* In the live file this line read vcc_chrome('footer','logo') — a call meant for
           the reader below, which resolves to THIS function instead. */
        $logo = fixture_shadowed( 'footer', 'logo' );
        return array( $logo, $slug );
    }
}

if ( ! function_exists( 'fixture_shadowed' ) ) {
    /* DEAD. The guard above is already false, so this body never loads. */
    function fixture_shadowed( $which, $key, $atts = null ) {
        return $which . '_' . $key;
    }
}
