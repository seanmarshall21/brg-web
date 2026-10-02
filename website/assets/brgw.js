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

     Default with NO delimiter: mark the last line. That is today's behavior, and it
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

  /* THE MARKED RUN, MEASURED OFF THE WORDS THEMSELVES.
     stripMarks captures the needle from the headline BEFORE the split engine runs, so it
     still carries the spaces the author typed. The split then wraps each word in its own
     element and drops the space at every LINE BOUNDARY — "somewhere you actually" comes
     back out of the DOM as "somewhere youactually". A plain indexOf for the needle
     therefore misses on every data-head="words" headline (seven of them, including three
     heroes), rangeFor returned null, placeMark returned early, and the pre-JS CSS width
     showed instead. The asterisk contract looked implemented and had in fact never once
     run — it failed silently, which is why it survived review.

     Matching on whitespace-STRIPPED text makes the needle independent of where the lines
     happen to break, which is the whole point: the author names words, not a layout.

     Measured off the .ln-i word elements rather than a Range, because Range.getClientRects
     across block .ln lines also returns the LINE BOXES — full column width — and a span of
     those is the whole headline, which is indistinguishable from the bug being unfixed. */
  function markedBox(head, needle) {
    var want = String(needle || '').replace(/\s+/g, '');
    if (!want) return null;

    var words = head.querySelectorAll('.ln-i');
    if (!words.length) {                      // pre-split, or reduced motion: no words to walk
      var r = rangeFor(head, needle);
      return r ? span(r.getClientRects()) : null;
    }

    var compact = '', owner = [];             // owner[i] = index of the word owning char i
    for (var i = 0; i < words.length; i++) {
      var t = words[i].textContent.replace(/\s+/g, '');
      for (var j = 0; j < t.length; j++) { compact += t[j]; owner.push(i); }
    }
    var at = compact.indexOf(want);
    if (at < 0) return null;                  // unmatched: fall through to the CSS width

    /* THE LAST ROW OF THE RUN, not its full extent. A marked phrase that wraps spans
       several rows, and one stroke cannot underline all of them — spanning them returns a
       box as wide as the headline, which is the 850px bar under the word "be" that Sean
       photographed. Taking the last row keeps the asterisk path agreeing with the no-
       delimiter default, which also marks the last line. A phrase that fits on one line
       has one row, so the common case is unaffected. */
    var rects = [], top = -Infinity;
    for (var k = owner[at]; k <= owner[at + want.length - 1]; k++) {
      var b = words[k].getBoundingClientRect();
      if (b.width < 1) continue;
      rects.push(b);
      if (b.top > top) top = b.top;
    }
    var lastRow = [];
    for (var m = 0; m < rects.length; m++) {
      if (Math.abs(rects[m].top - top) <= 2) lastRow.push(rects[m]);
    }
    return span(lastRow);
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
    stroke.style.maxWidth = '';              // see the max-width note where it is re-applied
    void stroke.offsetWidth;                 // force reflow so the reset is real

    var box = null;
    if (head.dataset.markText) {
      box = markedBox(head, head.dataset.markText);
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
           inline-block that hugs the words (267px for "Meet the crew", centered). Sean
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

    /* MEASURE AGAINST THE BOX THE MARGIN ACTUALLY RESOLVES AGAINST — its PARENT's content
       edge, not offsetParent.
       margin-left on a block in normal flow is measured from the containing block's CONTENT
       edge, and the containing block is the parent. offsetParent is the nearest POSITIONED
       ancestor, which here is usually the section. Where the stroke sits inside a centered
       .head (max-width:min(94%,1180px); margin-inline:auto) those are different boxes, so
       every mark was offset by however far .head sits from the section edge — measured
       correctly against the words, then placed against the wrong origin. That is why it was
       "slightly to the left" at one width and further out at another.

       getBoundingClientRect gives the BORDER box, so padding and border are added back to
       reach the content edge. Both are zero on today's heroes; relying on that silently is
       how this breaks again the first time a hero gains padding. */
    var host = stroke.parentNode;
    var hostRect = host.getBoundingClientRect();
    var hs = getComputedStyle(host);
    var contentLeft = hostRect.left
      + (parseFloat(hs.paddingLeft) || 0)
      + (parseFloat(hs.borderLeftWidth) || 0);

    /* max-width:none while an explicit width is set. team-hero's stroke is a direct grid
       child rather than living inside .head, so its max-width:100% resolved against a
       SHRINK-TO-FIT track whose width comes from its own content — it clamped the stroke to
       490px when the words measured 568.766px. The clamp is only there as a pre-JS guard;
       once a measured width exists it has nothing left to protect. Cleared in the reset
       above so the measurement itself is never taken through the clamp. */
    stroke.style.maxWidth = 'none';
    stroke.style.width = box.width + 'px';
    stroke.style.marginLeft = (box.left - contentLeft) + 'px';
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
      /* AN EXPLICIT <br> IS A LINE THE EDITOR CHOSE, and it has to survive this split.
         This measured visual lines from el.textContent — and a <br> contributes NO text, so
         "Two brands.<br>One standard." read back as "Two brands.One standard.": the break was
         dropped AND the words were welded together with no space. That is exactly what Sean
         saw the day hero headlines became editable ("it's actually just removing a space").
         Keeping the <br> between the word spans lets the existing offsetTop grouping below do
         the work unchanged — words after a break simply sit on a new row, so an authored break
         and a natural wrap are measured the same way and both end up as their own .ln. */
      var segments = el.innerHTML.split(/<br\s*\/?>/i);
      if (segments.length > 1) {
        el.innerHTML = segments.map(function (seg) {
          var t = seg.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
          if (!t) return '';
          return t.split(' ').map(function (w) {
            return '<span class="w" style="display:inline-block">' + w + '</span>';
          }).join(' ');
        }).filter(Boolean).join('<br>');
      } else {
      var words = el.textContent.replace(/\s+/g, ' ').trim().split(' ');
      el.innerHTML = words.map(function (w) { return '<span class="w" style="display:inline-block">' + w + '</span>'; }).join(' ');
      }
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
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        /* A THRESHOLD A TALL SECTION CAN NEVER REACH IS A SECTION THAT NEVER APPEARS.
           `threshold: 0.16` asks for 16% OF THE SECTION to be visible, but a section can
           never show more than the viewport, so the most it can ever reach is
           viewportHeight / sectionHeight. Past about 5 viewports tall that maximum falls
           under 0.16 and the callback simply never fires — .anim-up then holds the whole
           section at opacity:0 for ever, and the bottom-of-document guard below only
           rescues it once the reader reaches the very end of the page.
           It is viewport-dependent, which is why it shows up as "some sections reveal and
           some don't": team-members is 2976px, so it clears 0.16 on a 900px window
           (max 0.248) and fails on a 600px one (max 0.165 → under once rootMargin is
           applied). The comment above already argued against raising `threshold` for this
           exact reason; the number stayed anyway.
           So: keep 0.16 as the FEEL for sections that can reach it, and for one that
           cannot, fall back to the rootMargin line — which is height-independent and is
           what that comment calls the correct knob. */
        var rootH = e.rootBounds ? e.rootBounds.height : innerHeight * 0.82;
        var unreachable = e.boundingClientRect.height * 0.16 > rootH * 0.95;
        if (e.intersectionRatio >= 0.16 || unreachable) {
          e.target.classList.add('is-in'); io.unobserve(e.target);
        }
      });
    }, {
      /* THRESHOLD IS DELIBERATELY UNCHANGED. It is a fraction of the ELEMENT, so raising it
         to delay the reveal is unsafe here: a section taller than the viewport can never
         reach a high threshold, and a section that never intersects never gets .is-in — its
         content would sit at opacity:0 permanently. The heroes are 88vh and some stacked
         sections exceed the viewport, so that is a live risk, not a theoretical one.
         rootMargin shrinks the VIEWPORT instead and behaves the same at any section height,
         which makes it the correct knob for "fire later": -8% -> -18% of viewport height. */
      threshold: [0, 0.16], rootMargin: '0px 0px -18% 0px' });
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
        .to(img, { scale: 1, duration: 1.6, ease: 'power3.out' }, 0);
    });

    /* The yPercent parallax that used to live here is GONE, replaced by brgwMotion()
       below. It drifted the photo on the 1.2 ZOOM the reveal left behind — and zoom is the
       approach Sean rejected on Oak + Elm: a photo should be taller than its frame, not
       scaled up inside it. The reveal above now ends at scale 1 for the same reason.
       It also wrote `transform`, the same property the reveal tween owns, which is why the
       two had to share a budget at all. */

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


  /* ── Background video (SPEC-013) ───────────────────────────────────────────
     The <iframe> is NOT in the fragment. display:none does not stop a browser
     requesting it, so six sections with a background video would pull six
     third-party frames on a page showing none of them. It is injected here, only
     when there is actually an ID, and only when motion is welcome.

     Accepts a full share URL or a bare ID, because asking whoever inherits this
     site to extract an ID from a YouTube link is the exact "built for us, not for
     them" problem this whole editing pass exists to fix. */
  function brgwVideo(root) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    [].forEach.call(root.querySelectorAll('.vid[data-vid]'), function (box) {
      var raw = (box.getAttribute('data-vid') || '').trim();
      if (!raw || box.querySelector('iframe')) return;
      var src = (box.getAttribute('data-src') || 'youtube').trim().toLowerCase();
      var id = raw, m;
      if (src === 'vimeo') {
        m = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/); if (m) id = m[1];
        if (!/^\d+$/.test(id)) return;                     // not a Vimeo id — show the poster
      } else {
        m = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
        if (m) id = m[1];
        if (!/^[A-Za-z0-9_-]{6,}$/.test(id)) return;
      }
      var url = src === 'vimeo'
        ? 'https://player.vimeo.com/video/' + id + '?background=1&autoplay=1&loop=1&muted=1'
        /* playlist=<ID> is REQUIRED for loop=1 on YouTube — it loops a playlist, and a lone
           video without it plays once and stops. mute is load-bearing too: every current
           browser blocks autoplay with sound, so without it nothing plays at all. */
        : 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&mute=1&loop=1&playlist='
          + id + '&controls=0&playsinline=1&modestbranding=1&rel=0';
      var f = document.createElement('iframe');
      f.src = url; f.setAttribute('allow', 'autoplay; encrypted-media');
      f.setAttribute('loading', 'lazy'); f.setAttribute('title', '');
      f.setAttribute('tabindex', '-1'); f.setAttribute('aria-hidden', 'true');
      box.appendChild(f);
    });
  }

  /* ── PHOTO PARALLAX + FRAME DRIFT ───────────────────────────────────────────
     Ported from Oak + Elm (site/assets/oe.js @ 54cfbe7) at Sean's instruction, so the two
     sites move the same way rather than each inventing it.

     TWO LAYERS. The PHOTO slides inside its frame: it is laid out taller than the frame by
     `amt`% above and below, and the frame's overflow hides the extra, so more of the picture
     shows as you scroll and an edge can never appear. The FRAME itself can drift across the
     section. Neither zooms — a scaled-up photo is softer than the one that was uploaded, and
     Sean rejected that approach on Oak + Elm.

     IT WRITES `translate`, NOT `transform`, AND THAT IS THE WHOLE TRICK. GSAP owns `transform`
     on these same elements for the reveal (clip-path on the frame, scale on the photo). An
     inline transform written every frame silently beats a CSS animation on the same property —
     the trap our own SPEC-014 is built around solving by nesting elements. `translate` is a
     separate CSS property that COMPOSES with `transform`, so both effects survive with no
     wrapper, no nesting, and no ordering rules. Oak + Elm proved it on a live site first.

     RE-APPLIED EVERY FRAME on purpose: GSAP's clearProps wipes individual properties when a
     tween finishes, which silently erased this on Oak + Elm until they stopped setting it once.

     OFF UNLESS ASKED. Every section starts at 0, so this ships inert and nothing moves until
     a section is switched on in wp-admin. */
  function brgwMotion(root) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var items = [];
    function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
    var EDGE = 1.5;   // % of frame height kept in reserve beyond the travel — see below

    [].forEach.call(root.querySelectorAll('.brgw-sec'), function (sec) {
      var frames = sec.querySelectorAll('[data-brgw-img], [data-brgw-frame]');

      [].forEach.call(frames, function (frame) {
        /* SETTINGS COME FROM THE PHOTO, NOT THE SECTION. Sean, 2 Oct: "the parallax
           direction and amount should be per photo, not per group." A section-wide number
           cannot express the thing that actually reads as depth — a large photo drifting
           down while a small one drifts up — because that needs two photos in one section
           disagreeing. The attributes sit on whichever tag carries the photo: the <img>
           for a content photo, the layer itself for a hero background painted as a CSS
           background. Reading the frame first and then its image covers both without the
           markup having to be uniform. */
        var img = frame.querySelector(':scope > img, :scope > picture img');
        var src = (frame.hasAttribute('data-px') || !img) ? frame : img;
        var amt   = Math.max(0, Math.min(40, num(src.getAttribute('data-px'), 0)));
        var drift = Math.max(0, Math.min(40, num(src.getAttribute('data-float'), 0)));
        var pxDir = src.getAttribute('data-px-dir') === 'up' ? -1 : 1;
        var flDir = src.getAttribute('data-float-dir') === 'up' ? -1 : 1;

        if (img && amt > 0) {
          if (getComputedStyle(frame).position === 'static') frame.style.position = 'relative';
          frame.style.overflow = 'hidden';
          var pad = amt + EDGE;
          var st = img.style;
          st.position = 'absolute'; st.left = '0'; st.right = 'auto'; st.width = '100%';
          st.top = (-pad) + '%'; st.bottom = 'auto'; st.height = (100 + 2 * pad) + '%';
          st.maxWidth = 'none'; st.maxHeight = 'none'; st.objectFit = 'cover';
          items.push({ box: frame, target: img, amt: amt, dir: pxDir, tau: 3 * 0.06, cur: null });
        }
        /* NEVER FLOAT A FULL-BLEED FRAME: it fills its section, so moving it only reveals
           the background behind. The hero backdrop is marked data-brgw-frame for exactly
           this reason and is excluded here. */
        if (drift > 0 && frame.hasAttribute('data-brgw-img')) {
          items.push({ box: frame, target: frame, amt: drift, dir: flDir,
                       tau: 4 * 0.06, cur: null, float: true });
        }
      });
    });

    if (!items.length) return;
    var last = performance.now();
    function update(now) {
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      var vh = window.innerHeight;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var r = it.box.getBoundingClientRect();
        if (!r.height) continue;                               // hidden: no height, nothing to do
        /* STAND BACK WHILE GSAP IS ANIMATING THIS ELEMENT. Measured on the live page: GSAP
           writes `translate: none; rotate: none; scale: none;` next to its own
           `transform: scale(2,2)` — it deliberately neutralizes the individual transform
           properties so its transform is the only one that counts. SPEC-014 captured that
           exact inline string back in August without naming the cause.
           So `translate` composing with `transform` is true of CSS but NOT of an element
           GSAP currently owns: for the ~1.6s of the reveal the two would overwrite each
           other every frame, which reads as a flicker rather than a clean failure. Waiting
           for the tween costs nothing — the photo is mid-entrance and not yet still — and
           our per-frame re-apply takes over on the first frame after GSAP lets go. */
        if (window.gsap && window.gsap.isTweening && window.gsap.isTweening(it.target)) continue;
        var h = r.height, top = r.top;
        if (it.float && it.cur !== null) top -= it.cur;        // measure where it sits WITHOUT its own drift
        if (top + h < -200 || top > vh + 200) { it.cur = null; continue; }
        var p = ((vh / 2) - (top + h / 2)) / (vh / 2 + h / 2); // -1 entering at the bottom, +1 leaving the top
        p = Math.max(-1, Math.min(1, p));
        var goal = it.dir * p * it.amt * h / 100;
        if (it.cur === null || !it.tau) it.cur = goal;
        else it.cur += (goal - it.cur) * (1 - Math.exp(-dt / it.tau));
        it.target.style.translate = '0 ' + it.cur.toFixed(1) + 'px';
      }
      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function boot() { startRevealGate(); initSliders(); startMotion(); brgwVideo(document); brgwMotion(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
