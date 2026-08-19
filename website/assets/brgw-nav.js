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

     WHY team AND NOT A MID-RANGE ONE. The box is pinned to the item's width and a fixed
     height, with preserveAspectRatio="none", so the drawing is stretched independently in
     x and y. Measured against the real menu (48px for Team, 106px for Community — a 2.2x
     spread), the SPREAD is 2.2x whatever source you choose: it comes from the menu, not
     the artwork. What the source changes is how exaggerated the curve is on average.
     The widest source is the worst: line-restaurants (188 units) renders 2.4-5.4x more
     curved than drawn. line-careers (104) was 1.5-3.4x. line-team (68) is 1.0-2.2x —
     the NARROWEST source is the most faithful, because a short wide box needs a short
     wide drawing. With the height at 8px rather than 11 it averages 1.14x, i.e. very
     close to as-drawn.

     This is the CENTRELINE, derived from line-team-nav.svg, not the file itself.
     His export is an OUTLINE — a closed shape describing the edge of the stroke — and
     this CSS paints with `fill:none; stroke:...`, so feeding it the outline would trace
     the perimeter and draw a lasso rather than a pen. Same defect the lab spent a day on.
     Source sha 118e42fb7e63; regenerate with
     notes/explorer/studies/derive-centrelines.py if the artwork is re-exported.

     NO vector-effect="non-scaling-stroke" here, and that is deliberate rather than an
     omission. It looks like the right tool — it holds the stroke weight even while the box
     stretches to each item's width — but it moves DASH lengths into screen space, which
     defeats pathLength="1". The reveal is a dash animation: pathLength normalises the path
     to 1 so `stroke-dasharray:1` is one dash covering the whole line. In screen space that
     becomes a 1-PIXEL dash with 1-pixel gaps, and the underline renders as fragments that
     shift by a pixel instead of drawing. Sean saw it immediately: "it goes off the path,
     and then restarts". Weight consistency is not worth losing the animation the mark
     exists for. */
  var ULINE = '<svg class="bnav-uline" viewBox="0 0 68 7" preserveAspectRatio="none" aria-hidden="true">'
            + '<path pathLength="1" d="M0.4 3.7C0.5 3.7 0.9 3.7 1.1 3.7C1.4 3.7 1.6 3.7 1.9 3.7C2.1 3.7 2.1 3.7 2.6 3.6C3.1 3.6 4.0 3.5 4.9 3.5C5.8 3.4 7.1 3.3 7.9 3.3C8.8 3.2 9.3 3.2 10.2 3.1C11.1 3.1 12.3 3.1 13.2 3.0C14.1 3.0 14.6 2.9 15.5 2.9C16.4 2.9 17.6 2.8 18.5 2.8C19.4 2.8 20.0 2.7 20.8 2.7C21.5 2.7 22.2 2.7 23.0 2.6C23.9 2.6 25.2 2.6 26.1 2.6C26.9 2.6 27.5 2.5 28.3 2.5C29.2 2.5 30.5 2.5 31.4 2.5C32.2 2.5 32.7 2.5 33.6 2.5C34.5 2.5 35.8 2.5 36.6 2.5C37.5 2.5 38.0 2.5 38.9 2.5C39.8 2.5 41.1 2.5 41.9 2.6C42.8 2.6 43.3 2.6 44.2 2.6C45.1 2.6 46.3 2.6 47.2 2.7C48.1 2.7 48.7 2.7 49.5 2.7C50.2 2.8 50.9 2.8 51.8 2.8C52.6 2.9 53.9 2.9 54.8 3.0C55.7 3.0 56.2 3.0 57.0 3.1C57.9 3.1 59.2 3.2 60.1 3.2C60.9 3.3 61.5 3.3 62.3 3.4C63.2 3.4 64.7 3.5 65.4 3.6C66.0 3.6 65.9 3.6 66.1 3.6C66.4 3.6 66.6 3.6 66.9 3.6C67.1 3.6 67.5 3.5 67.6 3.5"/></svg>';
  /* Platform marks, keyed by the menu label lower-cased with non-letters stripped, so
     "Instagram", "instagram" and "Instagram " all match. Inline rather than fetched:
     these render inside a drawer that opens instantly, and a network round trip for a
     16px glyph is a visible pop. currentColor so the existing link colour drives them. */
  var SOCIAL_ICONS = {
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.07-1.1.05-1.7.24-2.1.4-.5.2-.9.44-1.3.84-.4.4-.64.8-.84 1.3-.16.4-.35 1-.4 2.1C2.6 8.5 2.6 8.9 2.6 12s0 3.5.06 4.7c.05 1.1.24 1.7.4 2.1.2.5.44.9.84 1.3.4.4.8.64 1.3.84.4.16 1 .35 2.1.4 1.2.06 1.6.06 4.7.06s3.5 0 4.7-.06c1.1-.05 1.7-.24 2.1-.4.5-.2.9-.44 1.3-.84.4-.4.64-.8.84-1.3.16-.4.35-1 .4-2.1.06-1.2.06-1.6.06-4.7s0-3.5-.06-4.7c-.05-1.1-.24-1.7-.4-2.1-.2-.5-.44-.9-.84-1.3-.4-.4-.8-.64-1.3-.84-.4-.16-1-.35-2.1-.4C15.5 4 15.1 4 12 4zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zm5.1-.3a1.15 1.15 0 1 1 0-2.3 1.15 1.15 0 0 1 0 2.3z"/></svg>',
    facebook:  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/></svg>',
    linkedin:  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.75-1.95 4 0 4.4 2.4 4.4 5.6V21h-4v-5.2c0-1.25 0-2.85-1.75-2.85s-2 1.35-2 2.75V21H9z"/></svg>',
    tiktok:    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.6 5.8a4.6 4.6 0 0 1-1.1-3h-3v12.2a2.7 2.7 0 1 1-2-2.6V9.3a5.8 5.8 0 1 0 5 5.7V9.4a7.6 7.6 0 0 0 4.4 1.4V7.8a4.6 4.6 0 0 1-3.3-2z"/></svg>',
    youtube:   '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.8C19.3 5 12 5 12 5s-7.3 0-8.9.5A2.5 2.5 0 0 0 1.4 7.3 26 26 0 0 0 1 12a26 26 0 0 0 .4 4.7 2.5 2.5 0 0 0 1.7 1.8c1.6.5 8.9.5 8.9.5s7.3 0 8.9-.5a2.5 2.5 0 0 0 1.7-1.8C23 15.2 23 12 23 12zM9.8 15.1V8.9l6 3.1z"/></svg>',
    x:         '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1-5.8 6.1H1.5l7.5-8.6L1.2 3h6.6l4.5 5.6zm-1.1 16h1.8L7.7 4.8H5.8z"/></svg>'
  };
  SOCIAL_ICONS.instagramcom = SOCIAL_ICONS.instagram;   // tolerate a pasted domain as the label
  SOCIAL_ICONS.twitter = SOCIAL_ICONS.x;

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

    /* Social items. Optional by construction: no assigned menu means an empty list and
       no social row, rather than an empty heading sitting in the drawer. */
    var ssrc = nav.querySelector(':scope > .nav-social-src');
    var SOCIAL = ssrc ? [].slice.call(ssrc.querySelectorAll(':scope > li')).map(function (li) {
      var a = li.querySelector(':scope > a');
      return { label: a ? a.innerHTML : '', href: a ? (a.getAttribute('href') || '#') : '#' };
    }) : [];

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
      /* ONE counter across every group, not one per group. Restarting it for the social
         row makes two things animate at once and reads as two menus; continuing it reads
         as a single cascade, and a section added later joins the sequence for free.
         (fc-brands' takeover uses the same single-counter rule.) */
      var i = 0;
      list.forEach(function (it) {
        var el = mkItem(it);
        el.style.transitionDelay = (0.14 + i++ * 0.055) + 's';
        dItems.appendChild(el);
      });
      if (SOCIAL.length) {
        var eyebrow = document.createElement('span');
        eyebrow.className = 'bnav-drawer-eyebrow';
        eyebrow.textContent = 'Follow';
        eyebrow.style.transitionDelay = (0.14 + i++ * 0.055) + 's';
        dItems.appendChild(eyebrow);

        var row = document.createElement('span');
        row.className = 'bnav-social';
        row.style.transitionDelay = (0.14 + i++ * 0.055) + 's';
        SOCIAL.forEach(function (it) {
          var a = document.createElement('a');
          /* Sean: "any platform — I would write Instagram, and it would recognize that
             it's Instagram." So the menu item's LABEL identifies the platform; nothing
             extra to configure, no class to remember, no field to fill in. Falls back to
             the plain label for anything unrecognised, so a new platform still renders
             as a working link rather than disappearing. */
          var key = (it.label || '').replace(/<[^>]*>/g, '').trim().toLowerCase().replace(/[^a-z]/g, '');
          a.className = 'bnav-social-link' + (SOCIAL_ICONS[key] ? ' has-icon is-' + key : '');
          a.href = it.href;
          a.innerHTML = (SOCIAL_ICONS[key] || '') + '<span class="lbl">' + it.label + '</span>';
          a.setAttribute('rel', 'noopener');
          a.setAttribute('target', '_blank');
          if (SOCIAL_ICONS[key]) a.setAttribute('aria-label', it.label);
          row.appendChild(a);
        });
        dItems.appendChild(row);
      }
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
