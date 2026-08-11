/* brgw-nav.js — enhances the WP-menu nav (reskin of Ranger's Temper enhancer).
   The plugin emits wp_nav_menu() as <ul class="nav-src"> inside <header class="bnav">.
   This: (1) tags each link .bnav-link + injects the pen-stroke marker underline SVG,
   (2) marks the active item (WP's .current-menu-item, plus a URL-match fallback for
   the embed pages), (3) builds the mobile takeover from the same menu. No GSAP needed —
   the underline draws via a CSS stroke-dashoffset transition on hover / active. */
(function () {
  var ULINE = '<svg class="bnav-uline" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">'
            + '<path pathLength="1" d="M4,7 C34,3 58,10 88,5 C102,3 114,7 117,6"/></svg>';

  function tidyPath(u) { try { return (new URL(u, location.href).pathname.replace(/\/+$/, '') || '/'); } catch (e) { return ''; } }

  function decorate(menu) {
    var here = tidyPath(location.href);
    [].slice.call(menu.children).forEach(function (li) {
      var a = li.querySelector(':scope > a');
      if (a) {
        a.classList.add('bnav-link');
        var p = tidyPath(a.href);              // URL-match fallback (embed pages: /brg-home/ etc.)
        if (p && p !== '/' && p === here) li.classList.add('is-active');
      }
      if (!li.querySelector(':scope > .bnav-uline')) li.insertAdjacentHTML('beforeend', ULINE);
    });
  }

  function enhance(nav) {
    if (nav.dataset.bnavInit) return; nav.dataset.bnavInit = '1';
    var menu = nav.querySelector(':scope > .nav-src');
    if (!menu) return;
    decorate(menu);

    // Mobile takeover: clone the (now-decorated) menu into a full-screen drawer.
    var ham = nav.querySelector('.bnav-ham');
    if (ham) {
      var drawer = document.createElement('div');
      drawer.className = 'bnav-drawer';
      drawer.appendChild(menu.cloneNode(true));
      nav.appendChild(drawer);
      var setOpen = function (o) {
        drawer.classList.toggle('open', o);
        ham.setAttribute('aria-expanded', o ? 'true' : 'false');
        document.documentElement.style.overflow = o ? 'hidden' : '';
      };
      ham.setAttribute('aria-expanded', 'false');
      ham.addEventListener('click', function () { setOpen(!drawer.classList.contains('open')); });
      drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    }

    // Optional auto-invert: only engages if sections opt in with data-nav="dark|light".
    if (document.querySelector('[data-nav]')) {
      var flip = function () {
        var el = document.elementFromPoint(Math.round(window.innerWidth / 2), nav.offsetHeight + 4);
        var sec = el && el.closest('[data-nav]');
        nav.classList.toggle('on-dark', !!(sec && sec.getAttribute('data-nav') === 'dark'));
      };
      window.addEventListener('scroll', flip, { passive: true });
      window.addEventListener('resize', flip);
      flip();
    }
  }

  function boot() { [].slice.call(document.querySelectorAll('.bnav')).forEach(enhance); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
