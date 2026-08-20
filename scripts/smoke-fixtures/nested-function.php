<?php
/**
 * DELIBERATELY BROKEN — a fixture, never deployed.
 *
 * This is v2.9.0's bug, reduced. `php -l` passes: nesting a function is valid
 * PHP and this file parses cleanly. But fixture_chrome() does not exist until
 * fixture_boot() has run, and fixture_render_nav() calls it before then — so a
 * real request fatals with "call to undefined function".
 *
 * plugin-smoke.php MUST reject this file. If it ever passes, the check is dead.
 */

if (!defined('ABSPATH')) return;

function fixture_boot() {
    // THE BUG: declared inside another function's body, so it is not defined
    // at include time — only after fixture_boot() has been called.
    function fixture_chrome() {
        return '<nav>chrome</nav>';
    }
    return true;
}

function fixture_render_nav() {
    // Calls it before fixture_boot() has ever run. Fatal in production.
    return fixture_chrome();
}

add_action('init', 'fixture_render_nav');
