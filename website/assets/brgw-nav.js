/* brgw-nav.js — enhances the WP-menu nav (reskin of Ranger's Temper enhancer).
   Reads the hidden <ul class="nav-src"> source + the header's config (layout / left / right /
   sticky), then distributes items into the .bnav-grp-a / .bnav-grp-b slots, injects the
   pen-stroke marker underline, marks the active item, and builds a More drawer (desktop
   overflow) that doubles as the mobile takeover. No GSAP dep — underline draws via CSS. */
(function () {
  var ULINE = '<svg class="bnav-uline" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">'
            + '<path pathLength="1" d="M4,7 C34,3 58,10 88,5 C102,3 114,7 117,6"/></svg>';
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
      drawer.setAttribute('aria-hidden', o ? 'false' : 'true');
      document.documentElement.style.overflow = o ? 'hidden' : '';
    }
    function openWith(list) { dItems.innerHTML = ''; list.forEach(function (it) { dItems.appendChild(mkItem(it)); }); setDrawer(true); }
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

    // Mobile hamburger → full menu in the drawer.
    var ham = nav.querySelector('.bnav-ham');
    if (ham) { ham.setAttribute('aria-label', 'Menu'); ham.addEventListener('click', function () { openWith(SRC); }); }

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
