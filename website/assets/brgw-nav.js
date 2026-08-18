/* brgw-nav.js — enhances the WP-menu nav (reskin of Ranger's Temper enhancer).
   Reads the hidden <ul class="nav-src"> source + the header's config (layout / left / right /
   sticky), then distributes items into the .bnav-grp-a / .bnav-grp-b slots, injects the
   pen-stroke marker underline, marks the active item, and builds a More drawer (desktop
   overflow) that doubles as the mobile takeover. No GSAP dep — underline draws via CSS. */
(function () {
  /* Sean's own nav stroke, not a hand-drawn stand-in.
     
     What was here was a path written inline: four vertical direction changes, i.e. a
     squiggle — the thing he has now said twice he does not want. Meanwhile he had
     exported five per-page nav strokes months ago and the component referenced none of
     them (`grep -c "line-.*-nav"` returned 0). "No squiggly lines" was never a change
     request; it was a request to use the artwork he already supplied. His call today:
     one stroke for the whole nav rather than one per page — more coherent as chrome.

     This is the CENTRELINE, derived from line-careers-nav.svg, not the file itself.
     His export is an OUTLINE — a closed shape describing the edge of the stroke — and
     this CSS paints with `fill:none; stroke:...`, so feeding it the outline would trace
     the perimeter and draw a lasso rather than a pen. Same defect the lab spent a day on.
     Source sha 7da87cbe5fef; regenerate with
     notes/explorer/studies/derive-centrelines.py if the artwork is re-exported.

     vector-effect keeps the stroke an even weight: preserveAspectRatio="none" stretches
     the box to each menu item's width, which would otherwise thin the line on long items
     and fatten it on short ones. */
  var ULINE = '<svg class="bnav-uline" viewBox="0 0 104 7" preserveAspectRatio="none" aria-hidden="true">'
            + '<path pathLength="1" vector-effect="non-scaling-stroke" d="M0.6 3.4C0.8 3.4 1.3 3.4 1.7 3.3C2.1 3.3 2.3 3.3 2.9 3.3C3.5 3.3 4.2 3.3 5.2 3.2C6.2 3.2 7.5 3.1 8.7 3.1C9.8 3.1 11.0 3.0 12.1 3.0C13.3 3.0 14.4 2.9 15.6 2.9C16.8 2.9 18.1 2.8 19.1 2.8C20.0 2.8 20.4 2.8 21.4 2.8C22.3 2.7 22.7 2.7 24.8 2.7C27.0 2.7 32.0 2.6 34.1 2.6C36.2 2.5 34.9 2.5 37.6 2.5C40.3 2.5 47.6 2.5 50.3 2.5C53.0 2.5 51.0 2.5 53.7 2.5C56.4 2.6 63.7 2.7 66.4 2.7C69.1 2.7 67.8 2.7 69.9 2.8C72.0 2.8 77.0 3.0 79.2 3.0C81.3 3.1 81.5 3.1 82.6 3.1C83.8 3.2 85.1 3.2 86.1 3.2C87.1 3.3 87.4 3.3 88.4 3.4C89.4 3.4 90.7 3.4 91.9 3.5C93.0 3.5 94.2 3.6 95.3 3.6C96.5 3.7 97.8 3.7 98.8 3.8C99.8 3.8 100.5 3.9 101.1 3.9C101.7 4.0 101.9 3.9 102.3 3.9C102.7 4.0 103.2 4.0 103.4 4.0"/></svg>';
  function tidy(u) { try { return (new URL(u, location.href).pathname.replace(/\/+$/, '') || '/'); } catch (e) { return ''; } }

  function enhance(nav) {
    if (nav.dataset.bnavInit) return; nav.dataset.bnavInit = '1';
    var src = nav.querySelector(':scope > .nav-src'); if (!src) return;
    var here = tidy(location.href);

    var SRC = [].slice.call(src.querySelectorAll(':scope > li')).map(function (li) {
      var a = li.querySelector(':scope > a');
      var href = a ? (a.getAttribute('href') || '#') : '#';
      var active = /(^|\s)current-menu-(item|ancestor)/.test(li.className);
      var p = tidy(href); if (!active && p && p !== '/' && p === here) active = true;
      return { label: a ? a.innerHTML : '', href: href, active: active };
    });

    var lay = (nav.className.match(/lay-(left|split|center|compact)/) || [])[1] || 'left';
    var L = Math.max(0, parseInt(nav.dataset.left || '2', 10));
    var R = Math.max(0, parseInt(nav.dataset.right || '2', 10));
    var grpA = nav.querySelector('.bnav-grp-a'), grpB = nav.querySelector('.bnav-grp-b');

    // Drawer + scrim (created once, appended to body for fixed positioning).
    var scrim = document.createElement('div'); scrim.className = 'bnav-scrim';
    var drawer = document.createElement('aside'); drawer.className = 'bnav-drawer'; drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = '<button class="bnav-drawer-close" aria-label="Close">Close &times;</button><div class="bnav-drawer-items"></div>';
    document.body.appendChild(scrim); document.body.appendChild(drawer);
    var dItems = drawer.querySelector('.bnav-drawer-items');
    function setDrawer(o) {
      drawer.classList.toggle('open', o); scrim.classList.toggle('open', o);
      nav.classList.toggle('menu-open', o);          // morphs the hamburger → X
      drawer.setAttribute('aria-hidden', o ? 'false' : 'true');
      document.documentElement.style.overflow = o ? 'hidden' : '';
    }
    function openWith(list) {
      dItems.innerHTML = '';
      list.forEach(function (it, i) {
        var el = mkItem(it);
        el.style.transitionDelay = (0.14 + i * 0.055) + 's';   // staggered rise-in
        dItems.appendChild(el);
      });
      void drawer.offsetWidth;                        // paint the hidden start state so the stagger plays
      setDrawer(true);
    }
    scrim.addEventListener('click', function () { setDrawer(false); });
    drawer.querySelector('.bnav-drawer-close').addEventListener('click', function () { setDrawer(false); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setDrawer(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });

    function mkItem(it) {
      var span = document.createElement('span'); span.className = 'bnav-item' + (it.active ? ' is-active' : '');
      var a = document.createElement('a'); a.className = 'bnav-link'; a.href = it.href; a.innerHTML = it.label;
      span.appendChild(a); span.insertAdjacentHTML('beforeend', ULINE); return span;
    }
    var overflow = [];
    function mkMore() {
      var b = document.createElement('button'); b.className = 'bnav-link bnav-more';
      b.innerHTML = 'More <span class="pl">+</span>';
      b.addEventListener('click', function () { openWith(overflow); }); return b;
    }
    function render() {
      grpA.innerHTML = ''; grpB.innerHTML = ''; overflow = [];
      if (lay === 'left') {
        SRC.forEach(function (it) { grpB.appendChild(mkItem(it)); });
      } else if (lay === 'compact') {
        var show = L + R;
        SRC.slice(0, show).forEach(function (it) { grpB.appendChild(mkItem(it)); });
        overflow = SRC.slice(show); if (overflow.length) grpB.appendChild(mkMore());
      } else { // split / center
        SRC.slice(0, L).forEach(function (it) { grpA.appendChild(mkItem(it)); });
        SRC.slice(L, L + R).forEach(function (it) { grpB.appendChild(mkItem(it)); });
        overflow = SRC.slice(L + R); if (overflow.length) grpB.appendChild(mkMore());
      }
    }
    render();

    // The nav is position:fixed. When its background is opaque (solid), reserve an equal
    // spacer on its wrapper so page content isn't hidden underneath. Transparent / frost
    // navs float over the content on purpose (no spacer).
    var wrap = nav.parentElement;
    function reserve() {
      if (!wrap) return;
      var floats = /\bbg-none\b|\bbg-frost\b/.test(nav.className);
      wrap.style.minHeight = floats ? '' : nav.offsetHeight + 'px';
    }
    reserve();
    window.addEventListener('resize', reserve);

    // Mobile hamburger → full menu in the drawer.
    var ham = nav.querySelector('.bnav-ham');
    if (ham) {
      ham.setAttribute('aria-label', 'Menu');
      ham.addEventListener('click', function () {
        if (drawer.classList.contains('open')) setDrawer(false); else openWith(SRC);
      });
    }

    // sticky="hide" → hide-on-scroll-down / show-on-up.
    if (nav.dataset.sticky === 'hide') {
      var lastY = window.pageYOffset, ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return; ticking = true;
        requestAnimationFrame(function () {
          var y = window.pageYOffset;
          if (y > lastY && y > nav.offsetHeight) nav.classList.add('is-hidden'); else nav.classList.remove('is-hidden');
          lastY = y; ticking = false;
        });
      }, { passive: true });
    }

    // Optional auto-invert (only if sections opt in with data-nav="dark|light").
    if (document.querySelector('[data-nav]')) {
      var flip = function () {
        var el = document.elementFromPoint(Math.round(window.innerWidth / 2), nav.offsetHeight + 4);
        var sec = el && el.closest('[data-nav]');
        nav.classList.toggle('on-dark', !!(sec && sec.getAttribute('data-nav') === 'dark'));
      };
      window.addEventListener('scroll', flip, { passive: true });
      window.addEventListener('resize', flip); flip();
    }
  }

  function boot() { [].slice.call(document.querySelectorAll('.bnav')).forEach(enhance); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
