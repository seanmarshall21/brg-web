/* brgw.js — SHARED reveal engine for every BRG page. Edit once → all pages update.
   Injected inline (no iframe) by the vc-clients plugin, after each page fragment.
   Finds every .brgw root on the page and: gates on Blanco (no FOUT), split-line
   reveals .anim-head, fade-ups .anim-up, splash-style .anim-cta buttons — each
   section triggered on scroll-in. Content is hidden from first paint via brgw.css;
   a timeout guarantees reveal even if the font is slow. */
(function () {
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  /* ── Text-attached marks — the asterisk contract ────────────────────────────
     Sean ruled 2026-08-18; spec in notes/explorer/text-attached-underline.md §0.6.

         Come work somewhere *you actually want to be*

     MEASURE, DON'T INJECT. The delimiter names which words to MEASURE; it never
     wraps them in markup. Measurement uses a Range over the existing text nodes, so
     the headline DOM is untouched and the split engine never sees a span. That is
     what keeps the ACF question and the animation question independent — every
     alternative couples them.

     Default with NO delimiter: mark the last line. That is today's behaviour, and it
     is why the five heroes get a correctly-sized stroke with no copy change at all.

     A backslash-escaped asterisk is literal. An unbalanced lone asterisk renders
     literally and marks nothing — it must never swallow the rest of the headline. */

  var MARK_ESC = '\uE000';   // stands in for an escaped asterisk while pairing

  function textNodes(el) {
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }

  /* Rewrite text WITHOUT introducing markup. innerHTML would destroy the <br> that
     several headlines rely on for their line breaks, and assigning .textContent
     would collapse the element to a single text node and do the same. */
  function setText(el, next) {
    var nodes = textNodes(el), i = 0;
    nodes.forEach(function (n) {
      n.nodeValue = next.substr(i, n.nodeValue.length);
      i += n.nodeValue.length;
    });
    if (i < next.length && nodes.length) nodes[nodes.length - 1].nodeValue += next.slice(i);
  }

  function stripMarks(el) {
    if (el.dataset.markParsed) return; el.dataset.markParsed = '1';
    var raw = el.textContent;
    if (raw.indexOf('*') < 0) return;                  // nothing to do; DOM untouched
    var held = raw.split('\\*').join(MARK_ESC);        // protect escaped asterisks first
    var pair = /\*([^*]+)\*/;                          // one balanced pair; a lone * cannot match
    var m = pair.exec(held);
    if (!m) {                                          // unbalanced — render literally, mark nothing
      if (held !== raw) setText(el, held.split(MARK_ESC).join('*'));
      return;
    }
    el.dataset.markText = m[1];                        // the words to measure, post-strip
    setText(el, held.replace(pair, m[1]).split(MARK_ESC).join('*'));
  }

  /* A Range over `needle` inside el, or over ALL of el's text when there is no
     delimiter. Returns null rather than guessing when the text cannot be located. */
  function rangeFor(el, needle) {
    var nodes = textNodes(el); if (!nodes.length) return null;
    var full = nodes.map(function (n) { return n.nodeValue; }).join('');
    var from = 0, to = full.length;
    if (needle) {
      from = full.indexOf(needle);
      if (from < 0) return null;
      to = from + needle.length;
    }
    var r = document.createRange(), seen = 0, started = false;
    for (var k = 0; k < nodes.length; k++) {
      var len = nodes[k].nodeValue.length;
      if (!started && seen + len >= from) { r.setStart(nodes[k], from - seen); started = true; }
      if (seen + len >= to) { if (!started) return null; r.setEnd(nodes[k], to - seen); return r; }
      seen += len;
    }
    return null;
  }

  /* Size and place the stroke against the words it marks. The stroke stays a SIBLING
     in normal flow — width plus a left margin, not absolute positioning — because it
     occupies vertical space between the headline and the sub copy, and taking it out
     of flow would collapse that gap. */
  /* The horizontal extent of a set of rects — one edge to the other. A run that fits
     on one line returns exactly that line, so single-line heroes are unaffected. */
  function span(rects) {
    var l = Infinity, r = -Infinity;
    for (var i = 0; i < rects.length; i++) {
      if (rects[i].width < 1) continue;
      if (rects[i].left < l) l = rects[i].left;
      if (rects[i].right > r) r = rects[i].right;
    }
    return r > l ? { left: l, width: r - l } : null;
  }

  function placeMark(sec) {
    var head = sec.querySelector('.anim-head, h1, h2');
    var stroke = sec.querySelector('.uline');
    if (!head || !stroke) return;

    /* RESET BEFORE MEASURING — this is a feedback loop, not a formality. .head is a
       grid item sized shrink-to-fit, so its width is set by its widest child, and the
       stroke IS a child. Leaving the previous pass's width on it makes .head as wide as
       the old stroke, which changes where the headline wraps and therefore the words
       about to be measured; max-width:100% then clamps the new width to the stale one.
       Measure -> mutate -> the mutation invalidates the next measurement. Clearing first
       means every pass measures the same layout the reader sees. */
    stroke.style.width = '';
    stroke.style.marginLeft = '';
    stroke.style.marginRight = '';
    void stroke.offsetWidth;                 // force reflow so the reset is real

    var box = null;
    if (head.dataset.markText) {
      var r = rangeFor(head, head.dataset.markText);
      if (r) box = span(r.getClientRects());
    } else {
      /* DEFAULT: mark the last LOGICAL line, not the last VISUAL one.
         On mobile a logical line wraps: home-hero's "of making your day great."
         breaks across two rows, and taking the final rect gave the word "great."
         alone — a 107px stub against a 381px headline, which is what Sean saw as
         "a lot too small". The split already models logical lines as .ln elements,
         so the last .ln is the answer, and its own wrapped rows are spanned. */
      var lns = head.querySelectorAll('.ln');
      if (lns.length) {
        /* .ln-i, NOT .ln. .ln is the block LINE BOX and spans the full column width
           (401px on a 430px phone) regardless of how much text is on it; .ln-i is the
           inline-block that hugs the words (267px for "Meet the crew", centred). Sean
           asked for the words, not the line box. .ln-i also solves the wrap case for
           free: when a logical line breaks across two rows its inline-block bounding
           box covers both, so the stroke spans the run instead of its final fragment. */
        var lastLn = lns[lns.length - 1];
        var inner = lastLn.querySelector('.ln-i') || lastLn;
        box = span(inner.getClientRects());
      }
      else {
        var all = rangeFor(head, '');                 // pre-split / reduced motion
        if (all) {
          var rc = all.getClientRects(), grp = [], top = null;
          for (var i = rc.length - 1; i >= 0; i--) {  // walk back over the last visual row
            if (rc[i].width < 1) continue;
            if (top === null) top = rc[i].top;
            if (Math.abs(rc[i].top - top) > 2) break;
            grp.push(rc[i]);
          }
          box = span(grp);
        }
      }
    }
    if (!box) return;
    var base = (stroke.offsetParent || head.parentNode).getBoundingClientRect();
    stroke.style.width = box.width + 'px';
    stroke.style.marginLeft = (box.left - base.left) + 'px';
    stroke.style.marginRight = '0';
  }

  function markAll(root) {
    [].forEach.call(root.querySelectorAll('.anim-head, .brgw-hero h1, .brgw-hero h2'), stripMarks);
  }
  function placeAll(root) {
    [].forEach.call(root.querySelectorAll('.brgw-sec'), placeMark);
  }

  function initRoot(root) {
    if (!root || root.dataset.animInit) return; root.dataset.animInit = '1';

    /* CONTENT FIRST, ABOVE THE MOTION GATE. Stripping the delimiters is a content
       transformation, not a motion one: below the reduced-motion return it would
       show a literal asterisk in every headline to anyone who prefers reduced
       motion. Placing the mark belongs here too — the mark is part of the design,
       it simply does not animate. */
    markAll(root);
    var replace = function () { placeAll(root); };
    replace();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
    addEventListener('resize', debounce(replace, 150));

    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // brgw.css shows everything statically for reduced-motion

    function wrapLines(el, htmlLines) {
      el.innerHTML = htmlLines.map(function (h) { return '<span class="ln"><span class="ln-i">' + h + '</span></span>'; }).join('');
      el.style.opacity = '1'; // was hidden pre-split; masks now own visibility
    }
    function splitByBr(el) {
      if (el.querySelector('.ln')) return; // already split (guards nested roots)
      var parts = el.innerHTML.split(/<br\s*\/?>/i).map(function (s) { return s.trim(); }).filter(Boolean);
      wrapLines(el, parts.length ? parts : [el.innerHTML]);
    }
    function splitByWords(el) {
      if (el.querySelector('.ln')) return; // already split (guards nested roots)
      var words = el.textContent.replace(/\s+/g, ' ').trim().split(' ');
      el.innerHTML = words.map(function (w) { return '<span class="w" style="display:inline-block">' + w + '</span>'; }).join(' ');
      var ws = [].slice.call(el.querySelectorAll('.w')), lines = [], cur = [], top = null;
      ws.forEach(function (s) {
        var t = s.offsetTop;
        if (top === null) top = t;
        if (Math.abs(t - top) > 4) { lines.push(cur); cur = []; top = t; }
        cur.push(s.textContent);
      });
      if (cur.length) lines.push(cur);
      wrapLines(el, lines.map(function (a) { return a.join(' '); }));
    }

    root.querySelectorAll('.anim-head').forEach(function (el) {
      if (el.dataset.head === 'words') splitByWords(el); else splitByBr(el);
    });
    /* RE-PLACE AFTER THE SPLIT. The split rewrites each headline into .ln/.ln-i
       spans, discarding the text nodes the first measurement ranged over. It did
       work without this — document.fonts.ready resolves as a promise, so its
       callback always lands after this synchronous block — but that is an accident
       of scheduling, not a guarantee anyone reading this could rely on. Measuring
       only width and left is also what makes it safe to measure BEFORE reveal:
       .ln-i starts translated vertically, and translateY changes neither. */
    placeAll(root);
    root.querySelectorAll('.reveal').forEach(function (sec) {
      /* Stagger. Sean: the reveals "fire too early, stagger too tight, and move too fast"
         (f062300124). Loosened 85->120ms between headline lines and 115->165ms between
         block elements.

         STAG_MAX is the part that is not just a bigger number. A linear stagger is O(n) in
         the item count: fine at four items, but team-members has NINE cards, which at 165ms
         would leave the last one starting 1.3s after the first and still animating long
         after the reader has scrolled past it. Clamping the accumulated delay keeps the
         loose feel for a normal 3-6 item section without letting a big grid trail. */
      var STAG_LN = 120, STAG_EL = 165, STAG_MAX = 780;
      var items = [].slice.call(sec.querySelectorAll('.ln-i, .anim-up, .anim-cta')), d = 0;
      items.forEach(function (el) {
        var delay = d < STAG_MAX ? d : STAG_MAX;
        el.style.transitionDelay = delay + 'ms';
        if (el.classList.contains('anim-cta')) el.style.animationDelay = delay + 'ms';
        d += el.classList.contains('ln-i') ? STAG_LN : STAG_EL;
      });
    });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, {
      /* THRESHOLD IS DELIBERATELY UNCHANGED. It is a fraction of the ELEMENT, so raising it
         to delay the reveal is unsafe here: a section taller than the viewport can never
         reach a high threshold, and a section that never intersects never gets .is-in — its
         content would sit at opacity:0 permanently. The heroes are 88vh and some stacked
         sections exceed the viewport, so that is a live risk, not a theoretical one.
         rootMargin shrinks the VIEWPORT instead and behaves the same at any section height,
         which makes it the correct knob for "fire later": -8% -> -18% of viewport height. */
      threshold: 0.16, rootMargin: '0px 0px -18% 0px' });
    root.querySelectorAll('.reveal').forEach(function (s) { io.observe(s); });

    /* BOTTOM-OF-DOCUMENT GUARD — without this the FOOTER never appears.
       rootMargin's -18% puts a dead band across the bottom of the viewport. That is
       safe for anything the reader can scroll PAST, and fatal for anything at the end
       of the document: the page runs out of scroll, so the last element never rises
       above the band, never intersects, never gets .is-in — and .anim-up holds it at
       opacity:0 for ever. The chrome footer is exactly that element
       (<footer class="brgw__footer reveal"> with an .anim-up lockup), roughly 170px
       against ~160px of dead band on a 900px viewport.

       This is the same failure I avoided by refusing to raise `threshold`, then
       reintroduced through rootMargin. So the fix is not a smaller number — a number
       only moves where the cliff is. Once the document cannot scroll further, anything
       still unrevealed is revealed: the trigger cannot be reached, so waiting for it
       is waiting for nothing. */
    var atEnd = function () {
      if (innerHeight + Math.ceil(scrollY) < document.documentElement.scrollHeight - 2) return;
      root.querySelectorAll('.reveal:not(.is-in)').forEach(function (s) {
        var top = s.getBoundingClientRect().top;
        if (top < innerHeight) { s.classList.add('is-in'); io.unobserve(s); }
      });
    };
    addEventListener('scroll', atEnd, { passive: true });
    addEventListener('resize', atEnd);
    atEnd();   // a page too short to scroll is already at its end
  }

  var started = false;
  function startAll() {
    if (started) return; started = true;
    // Init only TOP-LEVEL .brgw roots (the plugin wraps the page section in an outer
    // .brgw shell for header/footer — one root scans everything, no double-processing).
    [].slice.call(document.querySelectorAll('.brgw')).filter(function (r) {
      return !(r.parentElement && r.parentElement.closest('.brgw'));
    }).forEach(initRoot);
  }

  function startRevealGate() {
    // Gate on Blanco so split measures correct line breaks + no fallback-font flash.
    var fontP = (document.fonts && document.fonts.load) ? document.fonts.load("1em 'Blanco Cavelary'") : Promise.resolve();
    Promise.race([fontP.catch(function () {}), new Promise(function (r) { setTimeout(r, 1800); })]).then(startAll);
    setTimeout(startAll, 3500); // hard fallback — nothing stays hidden
  }

  // Reusable slider: <div class="brgw-slider" data-autoplay="5500"> with a
  // .brgw-slider__track of slides and an (optional) empty .brgw-slider__dots.
  function initSliders() {
    document.querySelectorAll('.brgw-slider').forEach(function (sl) {
      if (sl.dataset.sliderInit) return; sl.dataset.sliderInit = '1';
      var track = sl.querySelector('.brgw-slider__track');
      if (!track) return;
      var slides = [].slice.call(track.children), n = slides.length;
      if (n < 2) return;
      var dotsWrap = sl.querySelector('.brgw-slider__dots');
      var auto = parseInt(sl.dataset.autoplay || '0', 10), i = 0, timer = null, dots = [];
      function draw() { dots.forEach(function (b, k) { b.classList.toggle('is-on', k === i); }); }
      function go(k) { i = (k + n) % n; track.style.transform = 'translateX(' + (-i * 100) + '%)'; draw(); }
      function restart() { if (!auto) return; clearInterval(timer); timer = setInterval(function () { go(i + 1); }, auto); }
      if (dotsWrap) {
        for (var d = 0; d < n; d++) (function (d) {
          var b = document.createElement('button'); b.className = 'brgw-dot';
          b.setAttribute('aria-label', 'Go to slide ' + (d + 1));
          b.addEventListener('click', function () { go(d); restart(); });
          dotsWrap.appendChild(b); dots.push(b);
        })(d);
      }
      var x0 = null;
      sl.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      sl.addEventListener('touchend', function (e) {
        if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); restart(); } x0 = null;
      });
      sl.addEventListener('mouseenter', function () { clearInterval(timer); });
      sl.addEventListener('mouseleave', restart);
      go(0); restart();
    });
  }

  /* ── SCROLL MOTION (GSAP + ScrollTrigger) ───────────────────────────────────
     A LAYER on top of the CSS reveal engine, never a replacement. The CSS engine
     stays the baseline: it is font-gated, needs no JS beyond this file, and already
     handles split-line text, fade-ups and the CTA wipe. This layer adds only what
     CSS genuinely can't do — scroll-SCRUBBED motion.

     GSAP is self-hosted (assets/vendor/) and loaded LAZILY: only when a page
     actually contains a motion hook, and never under reduced-motion. A page with no
     hooks pays nothing; a reduced-motion visitor downloads nothing.

     Hooks (all opt-in, all degrade to "the element just looks normal"):
       [data-brgw-img]       image reveal — mask grows from the bottom edge while the
                             image counter-scales 2 → 1.2, so the picture never moves.
                             The residual 1.2 is deliberate headroom for the parallax.
       [data-brgw-parallax]  scrub-linked drift. Value = strength (default 1).
       [data-brgw-pin]       pin the element for its own height (or data-brgw-pin-end).
     ─────────────────────────────────────────────────────────────────────────── */
  var VENDOR = 'https://blacktoprg.netlify.app/assets/vendor/';
  var MOTION_SEL = '[data-brgw-img],[data-brgw-parallax],[data-brgw-pin]';

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.async = false;            // order matters: gsap before ScrollTrigger
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function initMotion() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST) return;
    gsap.registerPlugin(ST);

    /* Image reveal. clip-path rather than an animated height: same picture — a
       zero-height window pinned to the bottom edge opening to full — but it never
       triggers layout, and the image's position is untouched by definition, which is
       the property this effect depends on. */
    document.querySelectorAll('[data-brgw-img]').forEach(function (box) {
      var img = box.querySelector('img');
      if (!img) return;
      gsap.set(box, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(img, { scale: 2, transformOrigin: '50% 50%' });
      gsap.timeline({ scrollTrigger: { trigger: box, start: 'top 82%', once: true } })
        .to(box, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'power3.inOut' }, 0)
        .to(img, { scale: 1.2, duration: 1.6, ease: 'power3.out' }, 0);
    });

    /* Parallax. Runs on the 1.2 headroom the reveal leaves, so nothing ever exposes an
       edge. Distance scales with the element's own height, not a fixed pixel value, so
       a tall hero and a small card drift proportionally. */
    document.querySelectorAll('[data-brgw-parallax]').forEach(function (el) {
      var k = parseFloat(el.dataset.brgwParallax) || 1;
      gsap.fromTo(el, { yPercent: -6 * k }, {
        yPercent: 6 * k, ease: 'none',
        scrollTrigger: { trigger: el.closest('.brgw-sec') || el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    document.querySelectorAll('[data-brgw-pin]').forEach(function (el) {
      ST.create({
        trigger: el, start: 'top top',
        end: el.dataset.brgwPinEnd || '+=' + el.offsetHeight,
        pin: true, pinSpacing: true,
      });
    });

    // Fonts and the reveal engine both change layout after first paint.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
    window.addEventListener('load', function () { ST.refresh(); });
  }

  /* Prefer the GSAP the HOST PAGE already has. blacktoprestaurantgroup.com loads the full
     3.13 suite globally (gsap, ScrollTrigger, ScrollSmoother, SplitText, …) from its own
     bundle, so shipping ours too would be ~116KB of duplicate download AND two copies of
     gsap fighting over window.gsap — the second load wins, which would break any of the
     site's own tweens that captured the first reference. Ours is the FALLBACK, for a host
     that has none. Decided after window load so the host's scripts have actually landed. */
  function ensureGsap() {
    if (window.gsap && window.ScrollTrigger) return Promise.resolve('host');
    if (window.gsap) return loadScript(VENDOR + 'ScrollTrigger.min.js').then(function () { return 'host+ours'; });
    return loadScript(VENDOR + 'gsap.min.js')
      .then(function () { return loadScript(VENDOR + 'ScrollTrigger.min.js'); })
      .then(function () { return 'ours'; });
  }

  function startMotion() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // stays static
    if (!document.querySelector(MOTION_SEL)) return;                    // nothing to drive
    if (window.__brgwMotion) return; window.__brgwMotion = 1;
    var go = function () {
      ensureGsap().then(initMotion).catch(function () { /* no GSAP → CSS baseline stands */ });
    };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go);
  }

  function boot() { startRevealGate(); initSliders(); startMotion(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
