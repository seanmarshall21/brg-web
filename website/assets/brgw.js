/* brgw.js — SHARED reveal engine for every BRG page. Edit once → all pages update.
   Injected inline (no iframe) by the vc-clients plugin, after each page fragment.
   Finds every .brgw root on the page and: gates on Blanco (no FOUT), split-line
   reveals .anim-head, fade-ups .anim-up, splash-style .anim-cta buttons — each
   section triggered on scroll-in. Content is hidden from first paint via brgw.css;
   a timeout guarantees reveal even if the font is slow. */
(function () {
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  /* LOAD, VANISH, ANIMATE — no. Sean, 7 Oct: the images "load first, then they disappear,
     and then they animate in." The image reveal is a GSAP layer that loads lazily AFTER the
     page has loaded, and its first act was to clip every photo to nothing — so every photo
     showed, vanished, and then opened. This class goes on <html> the moment this script
     runs, and brgw.css hides [data-brgw-img] under it from the first frame, so GSAP's clip
     is a no-op by the time it lands. Not under reduced motion (nothing will animate, so
     nothing may hide), and REMOVED if GSAP never arrives — see startMotion — so a photo can
     never be hidden by a layer that is not there to show it. */
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    document.documentElement.classList.add('brgw-motion');
  }
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
      var STAG_LN = 120, STAG_EL = 165, STAG_MAX = 1500;

      /* .brgw-pop IS IN THE LIST NOW — the doodles, the placed marks and the seam badge.
         Sean, 3 Oct: "those should also animate in. They're all a part of the sequence."
         They already had an entrance, but no delay, so every mark in a section popped at
         once while the words around them arrived one at a time. */
      var items = [].slice.call(sec.querySelectorAll('.ln-i, .anim-up, .anim-cta, .brgw-pop'));

      /* THE CLAMP IS A SCALE, NOT A CEILING, and that is the fix for "images should
         animate in sequentially". The old version held the delay at STAG_MAX once the
         total passed it, so on the nine-card crew grid the first six cards arrived one by
         one and the last four landed together — the clamp stopped being a stagger exactly
         where the grid got interesting. Scaling the STEP instead keeps every item distinct
         however many there are, and still bounds the whole run: nine cards at 165ms would
         run 1320ms and fit, twenty would compress to fit 1500ms rather than pile up. */
      var total = 0;
      items.forEach(function (el, i) {
        if (i) total += el.classList.contains('ln-i') ? STAG_LN : STAG_EL;
      });
      var scale = total > STAG_MAX ? STAG_MAX / total : 1;

      var d = 0;
      items.forEach(function (el, i) {
        if (i) d += (el.classList.contains('ln-i') ? STAG_LN : STAG_EL) * scale;
        var delay = Math.round(d);
        el.style.transitionDelay = delay + 'ms';
        /* The same number as a custom property, so a child can schedule itself AFTER its
           own row without the engine knowing what the child is. transition-delay is not
           inherited and a nested element cannot read its parent's, which is why the crew
           card's name bar had no way to arrive after the card it belongs to. */
        el.style.setProperty('--brgw-delay', delay + 'ms');
        if (el.classList.contains('brgw-pop')) {
          /* TWO animations on a mark — the pop, then the endless jitter that starts after
             it. animation-delay takes a LIST, and a single value is applied to every
             animation in it, which would start the jitter at the same moment as the pop
             and leave the mark twitching while it is still scaling up. Both are named. */
          el.style.animationDelay = delay + 'ms, ' + (delay + 600) + 'ms';
        } else if (el.classList.contains('anim-cta')) {
          el.style.animationDelay = delay + 'ms';
        }
      });
    });
    /* HOW EARLY A SECTION REVEALS: WHEN ITS FIRST ANIMATED ELEMENT IS HALF ON SCREEN.

       The observed thing used to be the SECTION, with two knobs — a ratio of the section
       and a dead band across the foot of the viewport — and every value of those knobs was
       wrong for some section. Sean, 3 Oct: "if it's on the screen, it should load." Sean,
       7 Oct, morning: reveals "fire before I scroll to them" — the band was 36px and the
       words began rising below the screen edge. Sean, 7 Oct, evening, phone screenshot: the
       crew banner "doesn't trigger until you start scrolling. It's on screen here so it
       should trigger after load" — by then the band was 110px, sized to the sections' top
       padding, and team-members' banner hangs ABOVE the section's top edge, so the banner
       was fully on screen while the section had not cleared band-plus-ratio.

       No band sized to the section can be right for both, because what the reader sees is
       not the section's box; it is the first thing in it that moves. So that is what is
       observed now: the section's first animated element (its first split line, fade-up or
       button — a doodle is skipped, since marks can sit anywhere), and the section reveals
       when HALF of that element is inside the viewport. A banner on screen after load fires
       on load. A headline below the fold fires when its first line is half up, which is the
       earliest moment its rise is visible. No band, no padding arithmetic, and the same
       rule on a phone and a desktop.

       The threshold is now a fraction of a LINE, not of a section, so the "a tall section
       can never reach it" cliff below is all but gone — but the guard stays, because a
       fade-up block can be a whole card grid. */
    var REVEAL_RATIO  = 0.5;
    var REVEAL_MARGIN = '0px';
    /* The crew-card observer keeps its early trigger. Sean, 3 Oct: the cards should go
       "as long as they're more than 3% or 5% on screen". */
    var EACH_MARGIN   = '0px 0px -4% 0px';

    /* The element whose arrival on screen reveals the section. Queried after the split, so
       a headline's first line is a candidate — as its MASK (.ln), never the inner .ln-i:
       the inner line starts translated 160% below the mask, the mask is overflow:hidden,
       and IntersectionObserver clips a target by its ancestors, so the inner line would
       never intersect anything and the section would never reveal. A section with
       nothing animated is observed as itself, which is the old behavior for it. */
    var leadOf = new Map();
    function lead(sec) {
      /* THE FIRST ONE WITH A BOX. Sean, 7 Oct, evening: the Community teal banner was gone.
         That section's first animated element is its intro paragraph, which he had cleared;
         an empty block is 0x0, a 0x0 element never intersects anything, and the section
         never revealed. Any element with no size is skipped. */
      var els = sec.querySelectorAll('.ln, .anim-up, .anim-cta'), el = sec;
      for (var q = 0; q < els.length; q++) {
        var r = els[q].getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el = els[q]; break; }
      }
      leadOf.set(sec, el);
      return el;
    }
    function secOf(el) {
      var s = el.closest('.reveal');
      return s || el;
    }

    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        /* A THRESHOLD AN ELEMENT CAN NEVER REACH IS A SECTION THAT NEVER APPEARS. The
           threshold is a fraction of the observed element, and an element can never show
           more of itself than the viewport holds. A single line or a banner is far shorter
           than any screen, so this is rare now — but a .anim-up can wrap a whole grid, and
           "rare" is not "cannot", so the guard stays. */
        var rootH = e.rootBounds ? e.rootBounds.height : innerHeight;
        var unreachable = e.boundingClientRect.height * REVEAL_RATIO > rootH * 0.95;
        if (e.intersectionRatio >= REVEAL_RATIO || unreachable) {
          secOf(e.target).classList.add('is-in'); io.unobserve(e.target);
        }
      });
    }, { threshold: [0, REVEAL_RATIO], rootMargin: REVEAL_MARGIN });
    root.querySelectorAll('.reveal').forEach(function (s) { io.observe(lead(s)); });

    /* ---- PER-CHILD REVEAL, for a grid taller than the screen -------------------------
       Sean, 3 Oct: "when I go down to the next sections, they all load in at the same
       time, and they need to be sequential."

       A section reveals ONCE. Its stagger is handed out at that moment, so on the
       nine-card crew grid the rows below the fold spend their delay while nobody is
       looking and are simply there when you reach them. Marking the container
       data-brgw-each hands each child its own observer instead.

       THE STAGGER IS PER BURST, NOT PER INDEX. Four cards coming into view together
       should arrive one after another; four more a scroll later should start again at
       zero rather than continuing to a delay measured from the top of the grid. So the
       counter resets whenever there is a gap with nothing new entering. */
    var EACH_STEP = 110, EACH_GAP = 420;
    [].forEach.call(root.querySelectorAll('[data-brgw-each]'), function (box) {
        var burst = 0, last = 0;
        var kids = [].slice.call(box.children);
        kids.forEach(function (k) { k.classList.add('each-pending'); });
        var eio = new IntersectionObserver(function (ents) {
          ents.forEach(function (e) {
            if (!e.isIntersecting) return;
            var now = performance.now();
            if (now - last > EACH_GAP) burst = 0;
            last = now;
            var el = e.target;
            var ms = burst++ * EACH_STEP;
            el.style.transitionDelay = ms + 'ms';
            el.style.setProperty('--brgw-delay', ms + 'ms');
            el.classList.remove('each-pending');
            el.classList.add('each-in');
            eio.unobserve(el);
          });
        }, { threshold: [0, 0.08], rootMargin: EACH_MARGIN });
        kids.forEach(function (k) { eio.observe(k); });
    });

    /* BOTTOM-OF-DOCUMENT GUARD — without this the FOOTER never appears.
       rootMargin's negative bottom puts a dead band across the foot of the viewport. That is
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
        if (top < innerHeight) { s.classList.add('is-in'); io.unobserve(leadOf.get(s) || s); }
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
    /* WAIT FOR THE PAGE, NOT JUST THE FONT. Sean, 6 Oct: "all animations should happen
       after the page loads… right now they're visible, so they turn off and then animate in."

       This gated on Blanco alone, which usually resolves from cache in a few milliseconds —
       so the reveal fired while the photographs were still downloading, and on anything
       slower than a fast connection the entrance was over before the section had anything
       in it to look at. The font still matters (the headline splitter measures line breaks
       against it), so both are waited on, not one instead of the other.

       THE TIMEOUTS ARE THE POINT, not decoration. `load` waits for every image on the page,
       which on a hero full of photography can be seconds, so 2500ms caps it — past that the
       reveal starts regardless and late images simply arrive behind a section already shown.
       The 3500ms hard stop below is the last line: whatever happens, nothing stays hidden. */
    var fontP = (document.fonts && document.fonts.load) ? document.fonts.load("1em 'Blanco Cavelary'") : Promise.resolve();
    var loadP = (document.readyState === 'complete')
      ? Promise.resolve()
      : new Promise(function (r) { window.addEventListener('load', r, { once: true }); });
    Promise.race([
      Promise.all([fontP.catch(function () {}), loadP]),
      new Promise(function (r) { setTimeout(r, 2500); })
    ]).then(startAll);
    setTimeout(startAll, 3500); // hard fallback — nothing stays hidden
  }

  // Reusable slider: <div class="brgw-slider" data-autoplay="5500"> with a
  // .brgw-slider__track of slides and an (optional) empty .brgw-slider__dots.
  function initSliders() {
    document.querySelectorAll('.brgw-slider').forEach(function (sl) {
      if (sl.dataset.sliderInit) return; sl.dataset.sliderInit = '1';
      var track = sl.querySelector('.brgw-slider__track');
      if (!track) return;
      /* STACKED: every slide is shown one under another, so there is nothing to slide. Each slide gets
         .is-on and the same brgw:slide announcement the slider sends, once, as it scrolls into view;
         the panel animation (CSS) and the photo reveal (the image layer below) both key on those. The
         two-column mode is switched off here because its rules would otherwise stack the halves. */
      if (sl.closest('[data-stack="stacked"]')) {
        sl.removeAttribute('data-split');
        var stacked = [].slice.call(track.children);
        var show = function (s, k) {
          if (s.classList.contains('is-on')) return;
          s.classList.add('is-on');
          try { document.dispatchEvent(new CustomEvent('brgw:slide', { detail: { slider: sl, slide: s, index: k } })); } catch (err) { /* scroll reveal still opens the photo */ }
        };
        if (!('IntersectionObserver' in window)) { stacked.forEach(show); return; }
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { show(e.target, stacked.indexOf(e.target)); io.unobserve(e.target); } });
        }, { threshold: 0.2 });
        stacked.forEach(function (s) { io.observe(s); });
        return;
      }
      var slides = [].slice.call(track.children), n = slides.length;
      if (n < 2) return;
      var dotsWrap = sl.querySelector('.brgw-slider__dots');
      var auto = parseInt(sl.dataset.autoplay || '0', 10), i = 0, timer = null, dots = [];
      function draw() { dots.forEach(function (b, k) { b.classList.toggle('is-on', k === i); }); }
      /* TWO COLUMNS, SYNCED. Sean, 7 Oct: "two sliders next to each other that are synced
         together, so their bounding box doesn't move at all, and they slide within their
         bounding box." With data-split="1" on a wide screen the track is a two-column grid
         (brgw.css) and this hands out the positions: the outgoing slide's halves rise out
         of the top, the incoming halves come up from below — or the reverse on a step
         back. `dir` is the travel direction, passed by the caller so the wrap from the
         last slide to the first still reads as "next" rather than running backwards.

         A half is PARKED on the entry side first, with transitions off for one frame
         (no-trans + a forced reflow), then released; without that it would animate from
         wherever it last was. On a phone, or with the option off, the track is the strip
         it always was. The mode is re-read on every move, so a window resized across
         820px switches cleanly: go(i, 0) re-places the current slide in the new mode. */
      function cols() { return sl.dataset.split === '1' && window.matchMedia('(min-width:820px)').matches; }
      function park(s, cls) {
        s.classList.add('no-trans');
        s.classList.remove('is-on', 'is-above', 'is-below');
        s.classList.add(cls);
        void s.offsetWidth;                                   // commit without animating
        s.classList.remove('no-trans');
      }
      function go(k, dir) {
        var from = i;
        i = (k + n) % n;
        if (dir === undefined) dir = (i === from) ? 0 : (i > from ? 1 : -1);
        if (cols()) {
          track.style.transform = 'none';
          slides.forEach(function (s, q) {
            if (q === i || (q === from && dir !== 0)) return;
            park(s, 'is-below');                              // out of sight, no motion
          });
          if (dir !== 0 && from !== i) {
            park(slides[i], dir < 0 ? 'is-above' : 'is-below');
            slides[from].classList.remove('is-on');
            slides[from].classList.add(dir < 0 ? 'is-below' : 'is-above');
          } else if (dir === 0) {
            park(slides[i], 'is-on');
          }
          slides[i].classList.remove('is-above', 'is-below');
          slides[i].classList.add('is-on');
        } else {
          track.style.transform = 'translateX(' + (-i * 100) + '%)';
          slides.forEach(function (s, q) { s.classList.toggle('is-on', q === i); });
        }
        /* WHICH SLIDE IS SHOWING, for anything that is not the slider. data-on-parity lets a
           section color its dots by what sits under them (the second slide's panel is yellow,
           and yellow dots on a yellow panel are no dots). The event lets the image layer open
           a photo the moment its slide arrives. */
        sl.setAttribute('data-on', String(i + 1));
        sl.setAttribute('data-on-parity', (i % 2 === 0) ? 'odd' : 'even');
        try {
          document.dispatchEvent(new CustomEvent('brgw:slide', { detail: { slider: sl, slide: slides[i], index: i } }));
        } catch (err) { /* an old browser without CustomEvent keeps the scroll reveal only */ }
        draw();
      }
      function restart() { if (!auto) return; clearInterval(timer); timer = setInterval(function () { go(i + 1, 1); }, auto); }
      if (dotsWrap) {
        for (var d = 0; d < n; d++) (function (d) {
          var b = document.createElement('button'); b.className = 'brgw-dot';
          b.setAttribute('aria-label', 'Go to slide ' + (d + 1));
          b.addEventListener('click', function () { go(d); restart(); });
          dotsWrap.appendChild(b); dots.push(b);
        })(d);
      }
      /* EQUAL TILES. The flex track already makes every SLIDE the same height — measured
         725px on all three — but the split inside is content-driven, so the words took 403px
         on one slide and 485px on another and the photo absorbed the difference. The photo's
         top edge therefore jumped on every move, which is what reads as "the tiles are
         different sizes". No CSS fixes this: the panels are in separate flex items and cannot
         size to each other's content.

         So measure once and pin the tallest. Reset before measuring, or each pass would
         measure the floor the last one set and the panels would only ever grow. Re-run on
         resize and after the fonts land, because both change how many lines the words take. */
      var eqSel = sl.getAttribute('data-eq');
      function equalize() {
        if (!eqSel) return;
        var parts = [];
        for (var q = 0; q < slides.length; q++) {
          var el = slides[q].querySelector(eqSel);
          if (!el) return;                       // one missing and the set is not comparable
          parts.push(el);
        }
        parts.forEach(function (el) { el.style.removeProperty('min-height'); });
        var tallest = 0;
        parts.forEach(function (el) { tallest = Math.max(tallest, el.getBoundingClientRect().height); });
        if (tallest > 0) parts.forEach(function (el) { el.style.minHeight = tallest + 'px'; });
      }
      equalize();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalize).catch(function () {});
      var eqTimer = null;
      window.addEventListener('resize', function () {
        clearTimeout(eqTimer); eqTimer = setTimeout(function () { equalize(); go(i, 0); }, 180);
      });

      var x0 = null;
      sl.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      sl.addEventListener('touchend', function (e) {
        if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); restart(); } x0 = null;
      });
      sl.addEventListener('mouseenter', function () { clearInterval(timer); });
      sl.addEventListener('mouseleave', restart);
      go(0, 0); restart();
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
    function revealImg(box) {
      if (box.dataset.brgwShown) return;
      box.dataset.brgwShown = '1';
      var img = box.querySelector('img');
      gsap.timeline()
        .to(box, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'power3.inOut' }, 0)
        .to(img, { scale: 1, duration: 1.6, ease: 'power3.out' }, 0);
    }
    document.querySelectorAll('[data-brgw-img]').forEach(function (box) {
      var img = box.querySelector('img');
      if (!img) return;
      gsap.set(box, { clipPath: 'inset(100% 0% 0% 0%)' });
      gsap.set(img, { scale: 2, transformOrigin: '50% 50%' });
      /* A PHOTO IN A SLIDER OPENS WHEN ITS SLIDE IS SHOWN, NOT WHEN IT SCROLLS INTO VIEW.
         Sean, 7 Oct: "the second and third slide photos aren't loading." A scroll trigger
         is a position on the page, measured once; a slide that is parked out of sight (the
         two-column mode moves it a full box down, the strip moves it a screen sideways) is
         measured there, and when the slider brings it in nothing re-measures, so its photo
         stays clipped to nothing. The slider engine announces every change on the document
         (brgw:slide) and the photo opens then. The slide already showing when this layer
         lands opens now, because its announcement came before anyone was listening. */
      var slide = box.closest('.brgw-slider__track > *');
      if (slide) {
        if (slide.classList.contains('is-on')) revealImg(box);
        return;
      }
      ST.create({ trigger: box, start: 'top 82%', once: true, onEnter: function () { revealImg(box); } });
    });
    document.addEventListener('brgw:slide', function (e) {
      [].forEach.call(e.detail.slide.querySelectorAll('[data-brgw-img]'), revealImg);
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
    var html = document.documentElement;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // stays static
    if (!document.querySelector(MOTION_SEL)) { html.classList.remove('brgw-motion'); return; } // nothing to drive
    if (window.__brgwMotion) return; window.__brgwMotion = 1;
    var go = function () {
      ensureGsap().then(initMotion).catch(function () {
        html.classList.remove('brgw-motion');   // no GSAP → the CSS pre-hide must not stand
      });
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
          items.push({ box: frame, target: img, amt: amt, dir: pxDir, tau: 3 * 0.06, cur: null, pad: pad });
        }
        /* A LAYER PAINTED AS A CSS BACKGROUND has no <img> to slide inside a frame, so the
           layer itself is what moves. The note above has always said the attributes may sit
           on "the layer itself for a hero background painted as a CSS background" — but the
           branch above requires an <img>, so that half was a promise the code never kept.
           The splash plates are the first thing to use it.

           `translate` is written, never `transform`, so this composes with the entrance and
           drift animations these plates already run rather than overwriting them.

           A FULL-BLEED PLATE WOULD SHOW ITS EDGE when moved, so one that says so is grown
           by exactly the travel plus the usual reserve — and only when parallax is actually
           switched on, which is why it is done here and not in the stylesheet. A plate that
           covers only part of the hero needs none of that; moving it IS the effect. */
        if (!img && amt > 0) {
          if (frame.hasAttribute('data-px-bleed')) {
            var g = amt + EDGE;
            frame.style.top = frame.style.left = (-g) + '%';
            frame.style.right = frame.style.bottom = 'auto';
            frame.style.width = frame.style.height = (100 + 2 * g) + '%';
          }
          items.push({ box: frame, target: frame, amt: amt, dir: pxDir,
                       tau: 3 * 0.06, cur: null, selfMove: true });
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
        if ((it.float || it.selfMove) && it.cur !== null) top -= it.cur;  // it moves ITSELF: measure where it sits without that
        if (top + h < -200 || top > vh + 200) { it.cur = null; continue; }
        var p = ((vh / 2) - (top + h / 2)) / (vh / 2 + h / 2); // -1 entering at the bottom, +1 leaving the top
        p = Math.max(-1, Math.min(1, p));
        var goal = it.dir * p * it.amt * h / 100;
        if (it.cur === null || !it.tau) it.cur = goal;
        else it.cur += (goal - it.cur) * (1 - Math.exp(-dt / it.tau));
        /* A PHOTO MUST NEVER LEAVE ITS FRAME (Sean, 1 Nov: "the image moving out of the frame,
           which should never happen"). The slack that lets it travel is the extra height given to
           the <img> above, so each frame: (1) put that extra height back if anything wiped it, and
           (2) hold the travel inside what is ACTUALLY left over, measured from the laid-out boxes,
           not from the number the setting asked for. With no slack the photo simply stays still. */
        if (it.pad !== undefined) {
          var tg = it.target, st = tg.style, wantTop = (-it.pad) + '%', wantH = (100 + 2 * it.pad) + '%';
          if (st.top !== wantTop || st.height !== wantH) {
            st.position = 'absolute'; st.left = '0'; st.right = 'auto'; st.width = '100%';
            st.top = wantTop; st.bottom = 'auto'; st.height = wantH; st.maxWidth = 'none'; st.maxHeight = 'none';
          }
          var lo = it.box.clientHeight - (tg.offsetTop + tg.offsetHeight), hi = -tg.offsetTop;
          if (lo > 0) lo = 0;
          if (hi < 0) hi = 0;
          if (it.cur < lo) it.cur = lo;
          if (it.cur > hi) it.cur = hi;
        }
        /* GSAP'S REVEAL BAKES OUR MOVEMENT INTO ITS OWN TRANSFORM (Sean, 2 Nov: photos still leaving their
           frames). When the scale-in reveal starts, GSAP reads this photo's current `translate`, copies it into
           `transform: translate(0, -28px)` and leaves it there for good. We then write `translate` again every
           frame, so the photo carried the move twice (up to a full travel too high or low) and the clamp above
           could not see the second copy. Measured on the live page: the image ended 20px short of its frame.
           Once GSAP has let go, zero out its copy so only ours counts. */
        if (window.gsap && it.target.style.transform) {
          var mt = /translate\(\s*(-?[\d.]+)px(?:\s*,\s*(-?[\d.]+)px)?/.exec(it.target.style.transform);
          if (mt && (Math.abs(+mt[1]) > 0.01 || Math.abs(+(mt[2] || 0)) > 0.01)) window.gsap.set(it.target, { x: 0, y: 0 });
        }
        it.target.style.translate = '0 ' + it.cur.toFixed(1) + 'px';
      }
      requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  /* ---- WHICH HOVER A BUTTON ACTUALLY GETS ------------------------------------------
     Three levels, nearest wins: the page shell carries the site-wide choice, the button
     row carries its section's, and a button may carry its own. A blank means "follow
     whatever is nearer out".

     RESOLVED HERE RATHER THAN IN CSS, deliberately. Each effect is a whole rule body —
     a transform, a shadow, and for the underline a pseudo-element — so a three-level
     cascade in CSS would need a selector variant per level per effect: twenty-one groups
     to hand-maintain and keep in specificity order. Two of today's bugs came from exactly
     that, on the color system, at only two levels. Copying the resolved value onto the
     button instead leaves the seven rules that already exist doing all the work.

     Without JS a button keeps whatever the markup gave it and the stylesheet's own
     default applies, which is the lift every button has always had. */
  function brgwBtnFx(root) {
    /* FOUR ATTRIBUTES, one rule: a button that left something blank takes it from the
       nearest thing outwards that filled it in — its row (the section's choice), then the
       page shell (the site-wide choice). Color and fill ALSO resolve in CSS at the row
       level, which is deliberate belt and braces: that half keeps working with no JS at
       all, and this pass only ever writes the same value the cascade would have produced,
       plus the site-wide level that CSS alone cannot reach. */
    var ATTRS = ['data-btn-fx', 'data-btn-size', 'data-btn-style', 'data-btn-color', 'data-btn-hover'];
    [].forEach.call(root.querySelectorAll('.btn'), function (b) {
      for (var i = 0; i < ATTRS.length; i++) {
        var a = ATTRS[i];
        if (b.getAttribute(a)) continue;                 // it chose for itself
        var src = b.parentElement && b.parentElement.closest('[' + a + ']');
        var v   = src && src.getAttribute(a);
        /* "keep" is the section saying "leave this as the design made it", which is not a
           value to copy down — a button below it should go on looking for one. */
        if (v && v !== 'keep') b.setAttribute(a, v);
      }
    });
  }

  /* ---- THE COPYRIGHT YEAR ---------------------------------------------------------
     PHP already wrote the year the page was built. A cached page can outlive a New Year,
     so this corrects it on load; it touches nothing if the two already agree, and if this
     script never runs the server's value is still shown. */
  /* ---- CORE VALUES WHEEL ([data-wheel], in home-about) ------------------------------
     Names round a ring, the description of the one pointed at in the middle. The ring's
     maths is CSS (cos/sin on --i and --n); this sets those two numbers and moves the
     "on" state. A mouse switches on hover, a keyboard on focus, a finger on tap (a phone
     has no hover). One is always on, so the middle is never empty. */
  function brgwWheel(root) {
    [].forEach.call((root || document).querySelectorAll('[data-wheel]'), function (w) {
      if (w.getAttribute('data-wheel-init')) return; w.setAttribute('data-wheel-init', '1');
      var names = [].slice.call(w.querySelectorAll('.vl'));
      var defs = [].slice.call(w.querySelectorAll('.def'));
      if (!names.length) return;
      w.style.setProperty('--n', String(names.length));
      function on(i) {
        names.forEach(function (n, k) {
          n.classList.toggle('is-on', k === i);
          n.setAttribute('aria-pressed', k === i ? 'true' : 'false');
        });
        defs.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
      }
      names.forEach(function (n, i) {
        n.style.setProperty('--i', String(i));
        n.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') on(i); });
        n.addEventListener('focus', function () { on(i); });
        n.addEventListener('click', function () { on(i); });
      });
      on(0);
    });
  }

  /* ---- CORE VALUES, COLUMNS and LIST ([data-vset], in home-about) ------------------------
     One item is open at a time. A mouse opens one by pointing at it, a keyboard by focus, a
     finger by tap. It can step through by itself: it pauses while the pointer is on it or
     the page is out of view, stops when someone picks one (the Pause button resumes it),
     and never starts for a visitor who has asked for less motion. */
  function brgwVset(root) {
    [].forEach.call((root || document).querySelectorAll('[data-vset]'), function (v) {
      if (v.getAttribute('data-vset-init')) return; v.setAttribute('data-vset-init', '1');
      var items = [].slice.call(v.querySelectorAll('.vi'));
      if (!items.length) return;
      v.style.setProperty('--n', String(items.length));
      var cur = -1, hover = false, focused = false, inView = true, timer = null, setTimer = null;
      var secs = (parseInt(v.getAttribute('data-secs'), 10) || 5) * 1000;
      var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var auto = v.getAttribute('data-autoplay') === 'on' && !calm && items.length > 1;
      /* Split text: every word of a description goes in its own clip box so it can rise in on its
         own. It is set on the open item only AFTER the column has finished widening, because the
         description's width is the open column's final width and the words must not move while
         the column is still growing. */
      items.forEach(function (it) {
        var p = it.querySelector('.vp');
        if (!p || p.getAttribute('data-split')) return;
        var words = (p.textContent || '').split(/\s+/).filter(Boolean);
        p.textContent = '';
        words.forEach(function (w, k) {
          var o = document.createElement('span'); o.className = 'w';
          var i = document.createElement('span'); i.className = 'wi'; i.style.setProperty('--i', String(k)); i.textContent = w;
          o.appendChild(i); p.appendChild(o);
          if (k < words.length - 1) p.appendChild(document.createTextNode(' '));
        });
        p.setAttribute('data-split', '1');
      });
      function on(i) {
        if (i === cur) return;
        cur = i;
        clearTimeout(setTimer);
        var wide = window.getComputedStyle(v).display === 'flex';
        items.forEach(function (it, k) {
          it.classList.toggle('is-on', k === i);
          if (k !== i) it.classList.remove('is-set');
          var b = it.querySelector('.vn'); if (b) b.setAttribute('aria-expanded', k === i ? 'true' : 'false');
        });
        setTimer = setTimeout(function () { items[i].classList.add('is-set'); }, calm ? 0 : (wide ? 620 : 260));
      }
      function arm() {
        clearInterval(timer);
        if (!auto) return;
        timer = setInterval(function () {
          if (hover || focused || !inView || v.offsetParent === null) return;
          on((cur + 1) % items.length);
        }, secs);
      }
      items.forEach(function (it, i) {
        /* Switching on hover needs a REAL mouse move. When the open row changes, the rows below slide
           under a mouse that is standing still, and the browser reports that as the mouse entering
           whatever now sits there, which opens that one, and so on down the list. */
        it.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
        // A short pause before switching (about 80ms) so a mouse sweeping across the list does not flick through every value.
        var hoverT = null;
        it.addEventListener('pointermove', function (e) {
          if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) { hover = true; if (i === cur) { clearTimeout(hoverT); return; } clearTimeout(hoverT); hoverT = setTimeout(function () { on(i); }, calm ? 0 : 80); }
        });
        it.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { clearTimeout(hoverT); hover = false; arm(); } });
        var b = it.querySelector('.vn');
        if (!b) return;
        b.setAttribute('data-no', (i < 9 ? '0' : '') + (i + 1));
        b.addEventListener('focus', function () { focused = true; on(i); });
        b.addEventListener('blur', function () { focused = false; arm(); });
        b.addEventListener('click', function () { on(i); arm(); });
      });
      on(0);
      /* THE LIST WITH WORDS UNDER THE NAMES KEEPS ONE HEIGHT (Sean, 1 Nov: "the actual section height should
         never vary"). Opening one value closes another, so the height only changes when the two have a
         different number of lines. The tallest the list ever gets is measured once with each value open in
         turn, and the list is held at that height, so the section never grows and shrinks as it changes. */
      var sec = v.closest('[data-vlayout]'), lastW = 0;
      function lock() {
        v.style.minHeight = '';
        if (!sec || sec.getAttribute('data-vlayout') !== 'list' || sec.getAttribute('data-vtext') === 'photo') return;
        if (v.offsetParent === null || window.getComputedStyle(v).display !== 'grid') return;
        var was = items.map(function (it) { return it.classList.contains('is-on'); }), max = 0;
        v.classList.add('is-measuring');
        items.forEach(function (_, k) {
          items.forEach(function (it, j) { it.classList.toggle('is-on', j === k); });
          max = Math.max(max, v.getBoundingClientRect().height);
          var vp = items[k].querySelector('.vp');                             // its exact open height (box included), so the one closing and the one opening always add up to the same height
          if (vp) vp.style.setProperty('--vph', Math.ceil(vp.scrollHeight) + 'px');
        });
        items.forEach(function (it, j) { it.classList.toggle('is-on', was[j]); });
        v.classList.remove('is-measuring');
        v.style.minHeight = Math.ceil(max) + 'px';
      }
      lock();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(lock);
      window.addEventListener('load', lock);
      if (window.ResizeObserver) {
        new ResizeObserver(function () { if (v.clientWidth !== lastW) { lastW = v.clientWidth; lock(); } }).observe(v);
      }
      if (!auto) return;
      /* Sean, 3 Nov: "stays on Leadership until you have the screen fully in view or at least 60% in view
         and then it starts to play". The section counts as seen at 60% of ITSELF showing, or when it fills
         60% of the screen (a tall section on a phone can never show 60% of itself). Entering the view re-arms
         the timer, so the first value always gets a whole pause before the next opens. */
      if ('IntersectionObserver' in window) {
        var seen = sec || v, th = [];
        for (var q = 0; q <= 20; q++) th.push(q / 20);
        inView = false;
        new IntersectionObserver(function (es) {
          var e = es[es.length - 1], r = e.rootBounds, vh = r ? r.height : window.innerHeight;
          var now = e.isIntersecting && (e.intersectionRatio >= 0.6 || e.intersectionRect.height >= vh * 0.6);
          if (now === inView) return;
          inView = now;
          if (now) arm();
        }, { threshold: th }).observe(seen);
      }
      arm();
    });
  }

  function brgwYear() {
    var y = String(new Date().getFullYear());
    [].forEach.call(document.querySelectorAll('[data-brgw-year]'), function (el) {
      if (el.textContent !== y) el.textContent = y;
    });
  }

  /* ---- MODAL, for the Google Forms ------------------------------------------------
     Sean, 3 Oct: "can I just take them and put them into a modal pop-up that just fits it
     and matches the background color?"

     Any link marked data-brgw-modal opens its href in a panel instead of navigating. The
     iframe src is set ON OPEN and cleared on close, deliberately: a Google Form is a heavy
     third-party document, and four of them embedded up-front would be loaded on every view
     of the page by people who never open one. Clearing on close also resets a part-filled
     form rather than leaving it half-complete behind a closed panel.

     ONE PANEL, REUSED. It is created on first use and moved to <body>, so it is never
     trapped inside a section's stacking context or clipped by overflow:hidden — which
     every .brgw-sec has.

     The link keeps its real href, so middle-click and "open in new tab" still work and it
     is still a link if this script never runs. */
  function brgwModal(root) {
    var panel = null, frame = null, scrim = null, host = null, lastFocus = null;

    function build() {
      host = document.createElement('div');
      host.className = 'brgw brgw-modal';
      host.setAttribute('role', 'dialog');
      host.setAttribute('aria-modal', 'true');
      scrim = document.createElement('div'); scrim.className = 'brgw-modal__scrim';
      panel = document.createElement('div'); panel.className = 'brgw-modal__panel';
      var close = document.createElement('button');
      close.type = 'button'; close.className = 'brgw-modal__close';
      close.setAttribute('aria-label', 'Close'); close.innerHTML = '&times;';
      frame = document.createElement('iframe');
      frame.className = 'brgw-modal__frame';
      frame.setAttribute('title', 'Form');
      frame.setAttribute('loading', 'lazy');
      panel.appendChild(close); panel.appendChild(frame);
      host.appendChild(scrim); host.appendChild(panel);
      document.body.appendChild(host);
      close.addEventListener('click', hide);
      scrim.addEventListener('click', hide);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && host.hasAttribute('data-open')) hide();
      });
    }

    /* A Google Form link must carry ?embedded=true or it renders its full standalone
       chrome inside the panel. Sean's links arrive with ?usp=dialog, so the query is
       rewritten rather than appended — adding a second query string would break it. */
    function embedUrl(u) {
      if (!u) return '';
      if (u.indexOf('docs.google.com/forms') === -1) return u;
      return u.split('?')[0].replace(/\/viewform.*$/, '/viewform') + '?embedded=true';
    }

    function show(url, bg, title) {
      if (!panel) build();
      panel.setAttribute('data-bg', bg || 'white');
      frame.setAttribute('title', title || 'Form');
      frame.src = embedUrl(url);
      host.setAttribute('data-open', '');
      lastFocus = document.activeElement;
      document.documentElement.style.overflow = 'hidden';
      var c = panel.querySelector('.brgw-modal__close'); if (c) c.focus();
    }
    function hide() {
      if (!host) return;
      host.removeAttribute('data-open');
      frame.src = 'about:blank';
      document.documentElement.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    root.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-brgw-modal]') : null;
      if (!a) return;
      var flag = a.getAttribute('data-brgw-modal');

      /* EMPTY MEANS NO POP-UP. This read `if (!url || ...) url = href`, so an EMPTY
         attribute fell through to the href and opened the panel — and empty is the
         default for "Open in a pop-up". Every button on the site was opening a modal and
         the "Open the link" setting had never once done anything. Sean, 4 Oct: a mailto:
         button "opens up the mailto link, but it also opens up a modal".
         The attribute is present on every button because the markup always writes it, so
         its VALUE is the only thing that may decide this — never its presence. */
      if (!flag || flag === '0' || flag === 'false') return;

      var url = (flag === '1' || flag === 'true') ? a.getAttribute('href') : flag;
      if (!url || url === '#') return;

      /* A scheme that hands off to another app cannot be framed, and trying leaves an
         empty white panel sitting over the page after the mail window opens. */
      if (/^\s*(mailto:|tel:|sms:)/i.test(url)) return;

      e.preventDefault();
      show(url, a.getAttribute('data-brgw-modal-bg'), a.textContent.trim());
    });
  }

  /* ── Build stamp — which version of this code is the page running? ──────────────
     brgw.css carries `brgw build YYYY.MM.DD.N` on its first line (scripts/stamp.py
     writes it; pre-push refuses a deploy whose stamp did not move). The plugin inlines
     that stylesheet into every page, so the stamp is already in the page source. This
     only makes it reachable without view-source:
       <html data-brgw-build="…">      and   console: "brgw build …"
       ?build on any page URL          a small badge, bottom left: build + plugin version
     The plugin version is read from the <!-- vc_embed … vX.Y.Z --> comment the PHP
     emits, so the badge shows both numbers: the PHP moves rarely, the build moves on
     every push. Sean, 7 Oct: "I can know what version we're on on the site."
     A page that LINKS the stylesheet instead of inlining it (the kit previews) has no
     inline tag to read, and the function does nothing there on purpose. */
  function brgwBuild() {
    var tag = document.getElementById('vcc-brg-css'), m = tag && /brgw build (\S+)/.exec(tag.textContent || '');
    if (!m) return;
    var build = m[1];
    document.documentElement.setAttribute('data-brgw-build', build);
    try { console.info('brgw build ' + build); } catch (e) {}
    if (!/[?&#]build(?:[=&#]|$)/.test(location.search + location.hash)) return;
    var plugin = '', w = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null);
    while (w.nextNode()) {
      var c = /vc_embed \S+ v(\S+)/.exec(w.currentNode.nodeValue || '');
      if (c) { plugin = c[1]; break; }
    }
    var b = document.createElement('div');
    b.setAttribute('data-brgw-badge', '');
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;background:#231f20;color:#fff;'
      + 'font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;padding:8px 10px;border-radius:4px;opacity:.92;pointer-events:none;';
    b.textContent = 'build ' + build + (plugin ? ' · plugin v' + plugin : '');
    document.body.appendChild(b);
  }

  // Section color: the CSS paints the named choices by itself. This handles what CSS cannot, a
  // picked custom color, and keeps the nav's light/dark switch in step with the new background.
  // The nav reads data-nav off the section live as you scroll, so it only needs the attribute
  // updated. Words flip to whichever of ink or white has the higher contrast against the color
  // (the WCAG ratio). Sections left on "As designed" are skipped and keep their own data-nav.
  function brgwSecColor(root) {
    var lin = function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var secs = root.querySelectorAll('.brgw-sec[data-sec-color], .brgw-sub[data-sec-color], .vh[data-sec-color]');
    Array.prototype.forEach.call(secs, function (sec) {
      var key = sec.getAttribute('data-sec-color');
      if ((!key || key === 'keep') && sec.classList.contains('brgw-sec') && sec.hasAttribute('data-sec-sync')) {
        sec.setAttribute('data-nav', sec.getAttribute('data-vtone') === 'dark' ? 'dark' : 'light');   // a whole section whose own light/dark setting is its tone
      }
      if (!key || key === 'keep') return;
      if (key === 'custom') {
        var hex = (sec.getAttribute('data-sec-custom') || '').trim();
        if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return;
        sec.style.setProperty('--sec-c', hex);
        sec.setAttribute('data-sec-set', '');
      }
      // A section whose color is thinned (data-sec-op) paints a color-mix() value, which reads back as
      // color(srgb 0.9 0.8 0 / .5), not rgb(). Read the solid color instead and judge the words as if the
      // thinned color sat on white (the page behind most sections), so words stay readable on a pale mix.
      var pct = parseFloat(sec.getAttribute('data-sec-op') || '100') || 100, solid = pct < 100 && sec.classList.contains('brgw-sec');
      if (solid) { var keepBg = sec.style.background; sec.style.setProperty('background', 'var(--sec-c)', 'important'); }
      var m = (getComputedStyle(sec).backgroundColor || '').match(/[\d.]+/g);
      if (solid) { sec.style.background = keepBg; if (m && m.length >= 3) { var al = pct / 100; m = [255 - (255 - m[0]) * al, 255 - (255 - m[1]) * al, 255 - (255 - m[2]) * al]; } }
      if (!m || m.length < 3 || (m.length > 3 && +m[3] === 0)) return;
      var L = 0.2126 * lin(+m[0]) + 0.7152 * lin(+m[1]) + 0.0722 * lin(+m[2]);
      var inkWins = (L + 0.05) / (0.0144 + 0.05) > 1.05 / (L + 0.05);
      if (key === 'custom') sec.style.setProperty('--sec-t', inkWins ? 'var(--ink)' : 'var(--white)');
      if (sec.classList.contains('vh')) return;     // a heading's marker block: only its own color and words, nothing around it
      if (sec.classList.contains('brgw-sub')) {
        // A coloured part of a section (the core values): keep that part's own light/dark setting in step
        // with the colour, so its photo looks and item colours match. The page's nav is not touched.
        if (sec.hasAttribute('data-sec-sync')) { var host = sec.closest('.brgw-sec'); if (host) host.setAttribute('data-vtone', inkWins ? 'light' : 'dark'); }
        return;
      }
      if (sec.hasAttribute('data-sec-sync')) sec.setAttribute('data-vtone', inkWins ? 'light' : 'dark');   // a whole section that follows its own color
      sec.setAttribute('data-nav', inkWins ? 'light' : 'dark');
    });
  }

  // Section background: how the picture mixes with the section color, which of the two is on top, and
  // whether one picture runs on from the section above (Sean, 1 Nov). Pure CSS cannot know the section
  // above, so a run of sections that continue one picture is worked out here: the picture is drawn once
  // at the height of the whole run and each section shows its own slice of it. Heroes are left alone.
  function brgwSecBg(root) {
    var all = [].slice.call(root.querySelectorAll('.brgw-sec'));
    function bgOf(s) { return s.classList.contains('brgw-hero') ? null : s.querySelector(':scope > .sec-bg'); }
    function pageTop(el) { var y = 0; while (el) { y += el.offsetTop; el = el.offsetParent; } return y; }
    function urlOf(sec) {
      var srcs = bgOf(sec).querySelectorAll('source');
      for (var i = 0; i < srcs.length; i++) {
        var med = srcs[i].getAttribute('media'), set = (srcs[i].getAttribute('srcset') || '').trim();
        if (set && (!med || (window.matchMedia && matchMedia(med).matches))) return set.split(',')[0].trim().split(/\s+/)[0];
      }
      var im = bgOf(sec).querySelector('img');
      return im ? (im.getAttribute('src') || '') : '';
    }
    var runs = [];
    all.forEach(function (s, i) {
      var bg = bgOf(s), prev = all[i - 1], pbg = prev && bgOf(prev);
      if (!bg || !pbg || bg.getAttribute('data-join') !== 'yes') return;
      if (!pbg._brgwRun && !pbg.getAttribute('data-bg')) return;          // nothing above to continue
      var run = pbg._brgwRun;
      if (!run) { run = pbg._brgwRun = { origin: prev, members: [prev] }; runs.push(run); }
      run.members.push(s); bg._brgwRun = run;
    });
    runs.forEach(function (run) {
      var obg = bgOf(run.origin);
      run.members.forEach(function (m, k) {
        var bg = bgOf(m), im = bg.querySelector('img');
        if (im) im.removeAttribute('data-px');                              // movement is off while a picture continues
        if (k === 0) return;
        bg.setAttribute('data-bg', 'joined');
        bg.setAttribute('data-blend', obg.getAttribute('data-blend') || 'normal');
        bg.setAttribute('data-layer', obg.getAttribute('data-layer') || 'under');
        bg.style.setProperty('--sec-bg-o', obg.style.getPropertyValue('--sec-bg-o'));
        bg.style.setProperty('--sec-bg-bl', obg.style.getPropertyValue('--sec-bg-bl'));
        if (im) im.setAttribute('src', urlOf(run.origin));
      });
    });
    function layout() {
      runs.forEach(function (run) {
        var top0 = pageTop(run.origin), lastM = run.members[run.members.length - 1];
        var total = pageTop(lastM) + lastM.offsetHeight - top0;
        run.members.forEach(function (m) {
          var im = bgOf(m).querySelector('img'); if (!im) return;
          var st = im.style;
          st.position = 'absolute'; st.left = '0'; st.right = 'auto'; st.width = '100%'; st.maxWidth = 'none'; st.maxHeight = 'none';
          st.top = (-(pageTop(m) - top0)) + 'px'; st.bottom = 'auto'; st.height = total + 'px'; st.objectFit = 'cover';
        });
      });
    }
    if (runs.length) {
      layout();
      var queued = false;
      var again = function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; layout(); }); };
      window.addEventListener('resize', again);
      window.addEventListener('load', again);
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(again);
        runs.forEach(function (run) { run.members.forEach(function (m) { ro.observe(m); }); });
      }
    }
    // Mixing and order, for every section that has a picture of its own or a continued one.
    all.forEach(function (s) {
      var bg = bgOf(s);
      if (!bg || !bg.getAttribute('data-bg')) return;
      var blend = bg.getAttribute('data-blend') || 'normal', over = bg.getAttribute('data-layer') === 'over';
      if (!over && blend === 'normal') return;
      if (!over) { s.setAttribute('data-bgfx', '1'); return; }              // CSS makes the section its own mixing group
      var o = parseFloat(bg.style.getPropertyValue('--sec-bg-o'));
      if (isNaN(o)) o = 0.18;
      s.style.setProperty('--sec-over-c', getComputedStyle(s).backgroundColor);  // read BEFORE CSS hides the section's own color
      s.style.setProperty('--sec-over-o', String(Math.max(0, Math.min(1, 1 - o))));
      s.style.setProperty('--sec-over-bl', blend);
      s.setAttribute('data-bg-layer', 'over');
    });
  }

  /* ---- WHAT WE'RE ABOUT, SLIDER ([brg_home-about-slider]) ---------------------------------------
     Sean, 3 Nov: full screen, one slide at a time, moved on by scrolling or the arrows, then the page
     carries on. The section is a tall runway with a sticky full-screen stage inside it: while the runway
     scrolls past, the stage stays put and the scroll position picks the slide. The slide is a switch, not
     a scrub, so each change plays its own timed animation (CSS, in the fragment) whatever the scroll speed.
     This script: splits the words, works out the runway height, maps scroll to slide, runs the arrows.
     Without it the fragment shows the words stacked with no photo (data-ready is never set). */
  function brgwSlides(root) {
    [].forEach.call((root || document).querySelectorAll('.brgw-sec--home-about-slider'), function (sec) {
      if (sec.getAttribute('data-ready')) return;
      var run = sec.querySelector('.as-run'), stage = sec.querySelector('.as-stage'), panel = sec.querySelector('.as-img');
      var panes = [].slice.call(sec.querySelectorAll('.as-tx')), phs = [].slice.call(sec.querySelectorAll('.as-ph'));
      var N = panes.length;
      if (!run || !stage || !N) return;
      var reveal = sec.getAttribute('data-style') === 'reveal';
      var first = sec.getAttribute('data-pside') === 'left' ? 'l' : 'r';
      var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      var mult = { short: 0.7, medium: 1, long: 1.5 }[sec.getAttribute('data-step')] || 1;

      // each word in its own clip box so it can rise in and leave by itself (the numbering runs on across title and words)
      panes.forEach(function (p) {
        var n = 0;
        ['.as-h', '.as-p'].forEach(function (sel) {
          var el = p.querySelector(sel); if (!el) return;
          var words = (el.textContent || '').split(/\s+/).filter(Boolean);
          el.textContent = '';
          words.forEach(function (w, k) {
            var o = document.createElement('span'); o.className = 'as-w';
            var i = document.createElement('span'); i.className = 'as-wi'; i.style.setProperty('--i', String(n++)); i.textContent = w;
            o.appendChild(i); el.appendChild(o);
            if (k < words.length - 1) el.appendChild(document.createTextNode(' '));
          });
        });
      });

      // which side the photo is on for slide i: it crosses over on every slide, or stays put in the other style
      function photoSide(i) { return reveal || i % 2 === 0 ? first : (first === 'r' ? 'l' : 'r'); }
      panes.forEach(function (p, i) { p.setAttribute('data-side', photoSide(i) === 'r' ? 'l' : 'r'); });

      // put a finished (or half-finished) element back to its waiting place without animating there
      function reset(el) { el.classList.add('no-t'); el.classList.remove('is-out', 'is-under'); void el.offsetWidth; el.classList.remove('no-t'); }
      var timers = [];
      function leave(el, k) {
        el.classList.remove('is-on'); el.classList.add('is-out');
        clearTimeout(timers[k]);
        timers[k] = setTimeout(function () { if (!el.classList.contains('is-on')) reset(el); }, 1300);   // when it has gone, put it back below, unseen
      }
      function enter(el, k, d) {
        clearTimeout(timers[k]);
        if (el.classList.contains('is-out')) reset(el);
        el.style.setProperty('--d', d + 'ms');
        el.classList.add('is-on');
      }
      var cur = -1, ptimers = [];
      function show(i) {
        if (i === cur) return;
        var prev = cur; cur = i;
        // words first, then the photo (the first time in there is nothing to wait for, so it is quicker)
        var dText = calm ? 0 : (prev < 0 ? 0 : (reveal ? 520 : 400)), dPhoto = calm ? 0 : (prev < 0 ? 450 : (reveal ? 860 : 700));
        if (prev >= 0) {
          leave(panes[prev], prev);
          if (phs[prev]) {
            phs[prev].classList.remove('is-on');
            phs[prev].classList.add(reveal ? 'is-out' : 'is-under');       // wiped out upward, or left under the next one until it has covered it
            clearTimeout(ptimers[prev]);
            ptimers[prev] = setTimeout(function () { if (!phs[prev].classList.contains('is-on')) reset(phs[prev]); }, dPhoto + 1900);
          }
        }
        if (panel) panel.setAttribute('data-side', photoSide(i));
        enter(panes[i], i, dText);
        if (phs[i]) {
          clearTimeout(ptimers[i]);
          if (phs[i].classList.contains('is-out') || phs[i].classList.contains('is-under')) reset(phs[i]);
          // the reveal starts only once the photo is in memory and decoded (Sean, 3 Nov: the second photo popped in); it is
          // normally ready already, so the wait is nothing, and it is capped so a photo that never loads cannot hold the slide
          var t0 = Date.now();
          whenReady(imgs[i]).then(function () {
            if (cur !== i) return;
            phs[i].style.setProperty('--d', Math.max(0, dPhoto - (Date.now() - t0)) + 'ms'); phs[i].classList.add('is-on');
          });
        }
        panes.forEach(function (p, k) {
          p.inert = k !== i; p.setAttribute('aria-hidden', k === i ? 'false' : 'true');
          var pv = p.querySelector('[data-dir="prev"]'), nx = p.querySelector('[data-dir="next"]');
          if (pv) pv.disabled = i === 0; if (nx) nx.disabled = i === N - 1;
        });
      }
      // LOAD THE PHOTOS EARLY: they are lazy in the markup (a page with this section far down should not pay for them), but
      // once the section is within three screens they are all fetched and decoded, so each is ready before its reveal.
      var imgs = phs.map(function (p) { return p.querySelector('img'); });
      function warm() { imgs.forEach(function (im) { if (!im) return; im.loading = 'eager'; if (im.decode) im.decode().catch(function () {}); }); }
      if ('IntersectionObserver' in window) {
        var warmIO = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { warm(); warmIO.disconnect(); } }, { rootMargin: '300% 0px 300% 0px' });
        warmIO.observe(sec);
      } else warm();
      function whenReady(im) {
        return new Promise(function (res) {
          if (!im) return res();
          var done = false; function fin() { if (!done) { done = true; res(); } }
          setTimeout(fin, 2500);
          function dec() { if (im.decode) im.decode().then(fin, fin); else fin(); }
          if (im.complete && im.naturalWidth) return dec();
          im.loading = 'eager';
          im.addEventListener('load', dec, { once: true }); im.addEventListener('error', fin, { once: true });
        });
      }
      // the panel starts on the first slide's side without sliding there
      if (panel) { panel.setAttribute('data-side', photoSide(0)); }

      // the runway (Sean, 3 Nov: "lock into it ... pause for a second"): the stage's own height, a longer first hold, one hold
      // per later slide, and a rest at the end before the page carries on. In screen heights, for Medium: 0.6 (plus the 0.35 of approach), 0.95 each, 0.95.
      var L = 0, S = 0, T = 0;
      function measure() {
        var vh = stage.offsetHeight || window.innerHeight;
        S = Math.round(vh * 0.95 * mult); T = S;
        // The first slide is on screen for the last stretch of the approach (from ENTER of the screen height) as well as its hold,
        // so its hold is shorter by that stretch: the first slide and every other one then take the same scroll (Sean, 3 Nov).
        L = Math.max(Math.round(vh * 0.25), S - Math.round(vh * ENTER));
        run.style.height = Math.round(vh + L + Math.max(0, N - 2) * S + T) + 'px';
      }
      var ENTER = 0.35, entered = false, queued = false, lastChange = 0, wait = null;
      function bandStart(k) { return k <= 0 ? 0 : L + (k - 1) * S; }
      function idxNow() {
        var y = -run.getBoundingClientRect().top;
        return y < L ? 0 : Math.min(N - 1, 1 + Math.floor((y - L) / S));
      }
      function tick() {
        queued = false;
        var top = run.getBoundingClientRect().top;
        if (!entered && top < window.innerHeight * ENTER) entered = true;
        if (!entered) return;
        var want = idxNow();
        if (cur < 0) { show(want); lastChange = Date.now(); return; }
        if (want === cur) return;
        // one slide at a time and never faster than about once a second, however hard it is scrolled
        var left = 900 - (Date.now() - lastChange);
        if (left > 0) { clearTimeout(wait); wait = setTimeout(ask, left + 20); return; }
        show(cur + (want > cur ? 1 : -1)); lastChange = Date.now();
        if (want !== cur) { clearTimeout(wait); wait = setTimeout(ask, 920); }
      }
      function ask() { if (queued) return; queued = true; requestAnimationFrame(tick); }
      function go(k) {
        var base = window.pageYOffset + run.getBoundingClientRect().top;
        window.scrollTo({ top: Math.round(base + bandStart(k) + S * 0.12), behavior: calm ? 'auto' : 'smooth' });
      }
      sec.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.as-btn'); if (!b || b.disabled) return;
        go(Math.max(0, Math.min(N - 1, cur + (b.getAttribute('data-dir') === 'prev' ? -1 : 1))));
      });
      measure();
      var setup = phs.concat(panes); setup.forEach(function (el) { el.classList.add('no-t'); });
      sec.setAttribute('data-ready', '1');
      void sec.offsetWidth; setup.forEach(function (el) { el.classList.remove('no-t'); });
      if (panel) { panel.classList.add('no-t'); void panel.offsetWidth; panel.classList.remove('no-t'); }
      // PHOTO MOVEMENT (parallax). The stage is pinned, so the usual "how far through the screen is it" has nothing to measure;
      // the drift follows how far through the whole runway the page is instead, easing toward it. translate is used (not
      // transform), so it never meets the zoom the reveal plays on the same picture.
      var pxAmt = Math.max(0, Math.min(40, parseFloat(sec.getAttribute('data-px')) || 0)), pxDir = sec.getAttribute('data-px-dir') === 'up' ? -1 : 1;
      var pxCur = null, pxRun = false;
      if (pxAmt > 0 && !calm) stage.style.setProperty('--pad', (pxAmt + 0.5) + '%');
      function pxGoal() {
        var r = run.getBoundingClientRect(), total = Math.max(1, r.height - stage.offsetHeight);
        var p = Math.max(0, Math.min(1, -r.top / total));
        return pxDir * (p * 2 - 1) * pxAmt / 100 * (panel ? panel.offsetHeight : stage.offsetHeight);
      }
      function pxStep() {
        var g = pxGoal(); pxCur = pxCur === null ? g : pxCur + (g - pxCur) * 0.14;
        imgs.forEach(function (im) { if (im) im.style.translate = '0 ' + pxCur.toFixed(1) + 'px'; });
        if (Math.abs(g - pxCur) > 0.3) requestAnimationFrame(pxStep); else pxRun = false;
      }
      function pxAsk() { if (pxAmt <= 0 || calm || pxRun) return; pxRun = true; requestAnimationFrame(pxStep); }
      if (pxAmt > 0 && !calm) window.addEventListener('scroll', pxAsk, { passive: true });
      window.addEventListener('scroll', ask, { passive: true });
      window.addEventListener('resize', function () { measure(); ask(); });
      window.addEventListener('load', function () { measure(); ask(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); ask(); });
      ask();
    });
  }

  /* ---- FULL SCREEN SECTIONS (data-full, set in wp-admin) ---------------------------------------------
     Sean, 3 Nov: a toggle that makes a section full screen, holds it there for a set amount of scrolling, and scrolls you
     into place, subtly. The height is CSS (brgw.css). This does the other two: the section is made sticky inside a wrapper
     of its own, followed by an empty spacer as tall as the hold, so it stays put while the spacer scrolls past and then
     carries on up with the page. A section taller than the screen pins by its bottom edge instead, so it is never cut off
     at the foot. (Snapping the page into place when scrolling stopped was dropped on 3 Nov: Sean found it jumpy. Smooth
     scrolling, brgwSmooth below, replaces it.) */
  function brgwFull(root) {
    [].forEach.call((root || document).querySelectorAll('.brgw-sec[data-full]'), function (sec) {
      var mode = sec.getAttribute('data-full');
      if ((mode !== 'full' && mode !== 'ninety') || sec.getAttribute('data-full-init')) return;
      sec.setAttribute('data-full-init', '1');
      var pinS = { none: 0, short: 0.5, medium: 1, long: 1.6 }[sec.getAttribute('data-full-pin')];
      if (pinS === undefined) pinS = 1;
      var wrap = null, spacer = null, pinTop = 0;
      function apply() {
        var vh = window.innerHeight, h = sec.offsetHeight;
        pinTop = h <= vh ? (mode === 'ninety' ? Math.round((vh - h) / 2) : 0) : vh - h;
        if (pinS <= 0) return;
        if (!wrap) {
          wrap = document.createElement('div'); wrap.className = 'brgw-fs';
          sec.parentNode.insertBefore(wrap, sec); wrap.appendChild(sec);
          spacer = document.createElement('div'); spacer.setAttribute('aria-hidden', 'true'); wrap.appendChild(spacer);
        }
        sec.style.position = 'sticky'; sec.style.top = pinTop + 'px';
        var bg = window.getComputedStyle(sec).backgroundColor;           // the gaps above and below a 90% section take its color
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') wrap.style.backgroundColor = bg;
        spacer.style.height = Math.round(pinS * vh) + 'px';
      }
      apply();
      window.addEventListener('resize', apply);
      window.addEventListener('load', apply);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
      if (window.ResizeObserver) { var lastH = sec.offsetHeight; new ResizeObserver(function () { if (Math.abs(sec.offsetHeight - lastH) > 2) { lastH = sec.offsetHeight; apply(); } }).observe(sec); }
    });
  }

  /* ---- SMOOTH SCROLL (Sean, 3 Nov: "the snap to section ... is making it super jumpy ... a delayed scroll. As you
     scroll, it takes 50 ms, and then it eases into the scroll ... ease-in, ease-out ... let's not do the snap") ----
     The mouse wheel / trackpad no longer jumps the page: each wheel turn adds to a TARGET position, 50 ms after the
     first turn the page starts moving toward it, and it moves like a critically damped spring, so it starts gently,
     speeds up and settles gently (ease-in, ease-out). It never overshoots. A new turn mid-way just moves the target.
     Only on a page that has a full-screen section with "Smooth scrolling" on, or the About slider. Left alone:
     touch screens, the keyboard, the scrollbar, pinch-zoom, reduced motion, an open pop-up, and anything inside a box
     that scrolls on its own. Anything else that moves the page (keys, scrollbar, a link) stops it and takes over. */
  function brgwSmooth() {
    if (window.__brgwSmooth) return;
    if (!document.querySelector('.brgw-sec[data-full="full"][data-full-snap="on"], .brgw-sec[data-full="ninety"][data-full-snap="on"], .brgw-sec--home-about-slider')) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.__brgwSmooth = 1;
    var DELAY = 50, W = 10;                                   // ms before it starts; spring speed (higher = quicker settle, about 0.6s at 10)
    var pos = window.pageYOffset, target = pos, vel = 0, anim = false, startT = null, last = 0;
    function max() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
    function stop() { anim = false; clearTimeout(startT); startT = null; vel = 0; pos = target = window.pageYOffset; }
    function inner(el) {                                      // a box that scrolls by itself keeps its own wheel
      for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        var cs = window.getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
      }
      return false;
    }
    function frame(t) {
      if (!anim) return;
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      var x = pos - target;
      var acc = -W * W * x - 2 * W * vel;                     // critically damped spring toward the target
      vel += acc * dt; pos += vel * dt;
      if (Math.abs(pos - target) < 0.4 && Math.abs(vel) < 4) { pos = target; anim = false; window.scrollTo(0, Math.round(pos)); return; }
      window.scrollTo(0, Math.round(pos));
      requestAnimationFrame(frame);
    }
    function begin() { startT = null; anim = true; last = performance.now(); requestAnimationFrame(frame); }
    window.addEventListener('wheel', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (window.getComputedStyle(document.documentElement).overflow === 'hidden') return;      // a pop-up is open
      if (inner(e.target)) return;
      e.preventDefault();
      var d = e.deltaMode === 1 ? e.deltaY * 40 : (e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY);
      if (!anim && startT === null) { pos = target = window.pageYOffset; vel = 0; }
      target = Math.max(0, Math.min(max(), target + d));
      if (!anim && startT === null) startT = setTimeout(begin, DELAY);
    }, { passive: false });
    window.addEventListener('keydown', function (e) { if (anim || startT !== null) stop(); }, true);
    window.addEventListener('pointerdown', function () { if (anim || startT !== null) stop(); }, true);
    window.addEventListener('scroll', function () {            // moved by something else (scrollbar, a link, an arrow): follow it
      if (!anim && startT === null && Math.abs(window.pageYOffset - pos) > 1) { pos = target = window.pageYOffset; vel = 0; }
    }, { passive: true });
  }

  /* COUNT-UP. Sean, 3 Nov: "make the numbers on the community page do count ups to their
     numbers." A section opts in with data-countup="on" on any wrapper; every .fig inside it
     counts from 0 to its own written figure.

     THE FIGURE IS PARSED, NEVER REWRITTEN. "1,000+" splits into prefix "", number 1,000, suffix
     "+", so the commas, "$", "K" and "+" the editor typed all survive, and the last frame writes
     the original text back exactly. Anything without a digit (the XX placeholders) is left alone.

     IT WAITS FOR THE SECTION'S OWN REVEAL. The figure sits inside an .anim-up cell that is
     invisible until the reveal gate opens (after the page has loaded), so counting from the
     moment it scrolled into view would burn the animation while nothing can be seen. Screen
     readers get the final figure from aria-label, never "0". Reduced motion: no count at all. */
  function brgwCount(root) {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-countup="on"] .fig').forEach(function (el) {
      if (el.__cu) return;
      var txt = el.textContent.trim();
      var m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(txt);
      if (!m) return;
      var raw = m[2], end = parseFloat(raw.replace(/,/g, ''));
      if (!isFinite(end) || end <= 0) return;
      el.__cu = 1;
      var dec = (raw.split('.')[1] || '').length, commas = raw.indexOf(',') > -1, started = false;
      function fmt(v) {
        var s = v.toFixed(dec);
        if (commas) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
        return m[1] + s + m[3];
      }
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', txt);
      el.textContent = fmt(0);
      function go() {
        if (started) return; started = true;
        var t0 = null, dur = 1800;
        (function step(t) {
          if (t0 === null) t0 = t;
          var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);   // ease-out: fast start, gentle landing
          if (k < 1) { el.textContent = fmt(end * e); requestAnimationFrame(step); }
          else el.textContent = txt;
        })(performance.now());
      }
      var sec = el.closest('.reveal');
      function whenShown() {
        if (!sec || sec.classList.contains('is-in')) { setTimeout(go, 200); return; }
        var mo = new MutationObserver(function () {
          if (sec.classList.contains('is-in')) { mo.disconnect(); setTimeout(go, 300); }
        });
        mo.observe(sec, { attributes: true, attributeFilter: ['class'] });
        setTimeout(function () { mo.disconnect(); go(); }, 5000);          // never leave it on 0
      }
      new IntersectionObserver(function (es, io) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); whenShown(); }
      }, { threshold: 0.5 }).observe(el);
    });
  }

  /* PAGE EFFECTS. Sean, 3 Nov: every page change should fade the page out and lift it a
     little, then animate the next page in; and a loading screen (the smiley) for when things
     lag. Three pieces share one flag so they hand over to each other without a blank gap:

       LEAVE   a plain click on an internal link fades + lifts the page content (not the nav,
               which stays put like any site header), then the loading screen covers it, then the
               browser navigates. The old page stays visible until the new one answers, so the
               screen is what tells the visitor something is happening.
       ARRIVE  the content is held invisible (a class on <html>, set before the content below
               the nav has even been parsed, so there is no flash) until the page is ready, then
               rises in. "Ready" is the same test as the reveal gate: fonts + load, capped.
       LOADER  shown only if the page is not ready within 350ms (or at once when we arrived by
               our own link, so the old page's screen simply carries on). Kept up at least
               550ms once shown, so it never flickers.

     EVERY WAY OUT IS CLOSED OFF. The hold is lifted by a hard timer whatever else happens, and
     the whole thing is inside try/catch at the call site, because this file is inlined in every
     page: a failure here must cost the effect, never the page. Off in the Oxygen builder's
     frame, with reduced motion, and by ?brgw_nofx. The back button restores a page from the
     browser's cache already faded out, so pageshow undoes the fade. Settings arrive as
     window.BRGW_FX from the plugin (Site-wide > Page effects); absent means defaults. */
  function brgwPageFx() {
    var D = document.documentElement, S = window.BRGW_FX || {};
    if (D.__brgwFx) return; D.__brgwFx = 1;
    var framed = true; try { framed = window.self !== window.top; } catch (e) {}
    if (framed || /[?&](ct_builder|oxygen_iframe|brgw_nofx)\b/.test(location.search)) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var trans = S.page !== 'off';
    var mode = (S.loader === 'off' || S.loader === 'always') ? S.loader : 'slow';
    if (!trans && mode === 'off') return;
    var STYLES = ['hop', 'spin', 'charge', 'flip', 'trio'];
    var ICON = 'https://blacktoprg.netlify.app/assets/media/icons/';
    var BGS = ['black', 'teal', 'pink', 'white'];
    var came = false, pick = null;
    try {
      var cv = sessionStorage.getItem('brgwFx'); sessionStorage.removeItem('brgwFx');
      came = !!cv;
      var cp = (cv || '').split('|');
      if (STYLES.indexOf(cp[0]) > -1) pick = { v: cp[0], bg: BGS.indexOf(cp[1]) > -1 ? cp[1] : 'black' };
    } catch (e) {}
    var loader = null, shownAt = 0, ready = false, leaving = false, inTimer = 0;
    // ONE ANIMATION AND ONE COLOR PER WAIT, DIFFERENT EVERY TIME. Chosen at random but never the one
    // used last (localStorage) and never the one on screen now, and handed to the next page through
    // sessionStorage so the screen that covers the old page and the one that opens the new page are
    // the same, not two. A new pick is made each time you leave a page: before, the pick that arrived
    // with the page was also the one it left with, so it stuck for the whole visit.
    function fresh() {
      var cur = pick || {}, lastV = '', lastB = '';
      try { lastV = localStorage.getItem('brgwLd') || ''; lastB = localStorage.getItem('brgwLb') || ''; } catch (e) {}
      function one(list, a, b) {
        var pool = list.filter(function (x) { return x !== a && x !== b; });
        if (!pool.length) pool = list;
        return pool[Math.floor(Math.random() * pool.length)];
      }
      var v = S.art ? 'hop' : (STYLES.indexOf(S.style) > -1 ? S.style : one(STYLES, lastV, cur.v));
      var bg = BGS.indexOf(S.bg) > -1 ? S.bg : one(BGS, lastB, cur.bg);
      try { localStorage.setItem('brgwLd', v); localStorage.setItem('brgwLb', bg); } catch (e) {}
      return { v: v, bg: bg };
    }
    function chosen() { return pick || (pick = fresh()); }
    // The colors by name (same as brgw.css #brgw-loader[data-bg]).
    var BGHEX = { black: '#131210', teal: '#19C7C2', pink: '#EC0F8D', white: '#FFFFFF' };
    // NO FLASH OF WHITE: the page body is white behind the black page, so a page fading out (or in)
    // showed white for a moment, between the old page and the loading screen. While the effect runs
    // the body takes the loading screen's color (or, with the loader off, the first screen's), so the
    // page dips into that color and never into white.
    function tint(hex) {
      var c = hex;
      if (!c) {
        c = '#131210';
        try {
          var sec = document.querySelector('.ct-inner-content .brgw-sec') || document.querySelector('.ct-inner-content');
          var bc = sec ? getComputedStyle(sec).backgroundColor : '';
          if (bc && !/^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$|^transparent$/.test(bc)) c = bc;
        } catch (e) {}
      }
      D.style.setProperty('--brgw-pg', c);
      D.classList.add('brgw-pgbg');
    }
    function untint() { D.classList.remove('brgw-pgbg'); }
    function icon(file, cls, ink) {
      var im = document.createElement('img');
      im.alt = ''; im.src = ICON + file; if (cls) im.className = cls; if (ink) im.setAttribute('data-ink', ink);
      return im;
    }
    function buildArt(v) {
      var box = document.createElement('div'); box.className = 'brgw-ld'; box.setAttribute('data-v', v);
      if (v === 'hop') {
        var h = icon('icn-misc-smile-yel.svg');
        if (/^https?:\/\//.test(S.art || '')) h.src = S.art;
        var sh = document.createElement('span'); sh.className = 'brgw-ld-sh';
        box.appendChild(h); box.appendChild(sh);
      } else if (v === 'spin') {
        box.appendChild(icon('icn-misc-ast-circle-wht.svg', '', 'white'));
      } else if (v === 'charge') {
        box.appendChild(icon('icn-misc-bolt-line-yel.svg', 'b1'));
        box.appendChild(icon('icn-misc-bolt-fill-yel.svg', 'b2'));
      } else if (v === 'flip') {
        box.appendChild(icon('icn-misc-smile-yel.svg', 'f'));
        box.appendChild(icon('icn-misc-bolt-fill-yel.svg', 'f'));
        box.appendChild(icon('icn-misc-ast-circle-wht.svg', 'f', 'white'));
      } else {
        box.appendChild(icon('icn-misc-smile-yel.svg', 't'));
        box.appendChild(icon('icn-misc-bolt-fill-yel.svg', 't'));
        box.appendChild(icon('icn-misc-ast-circle-wht.svg', 't', 'white'));
      }
      return box;
    }

    function showLoader(instant) {
      if (loader || !document.body) return;
      var l = document.createElement('div');
      l.id = 'brgw-loader';
      l.setAttribute('role', 'status');
      l.setAttribute('aria-label', 'Loading');
      var pk = chosen();
      l.setAttribute('data-bg', pk.bg);
      l.appendChild(buildArt(pk.v));
      if (instant) l.classList.add('is-instant');
      document.body.appendChild(l);
      void l.offsetWidth;
      l.classList.add('is-on');
      if (instant) requestAnimationFrame(function () { l.classList.remove('is-instant'); });
      loader = l; shownAt = Date.now();
    }
    function hideLoader() {
      if (!loader) return;
      var l = loader; loader = null;
      l.classList.remove('is-on');
      setTimeout(function () { if (l.parentNode) l.parentNode.removeChild(l); }, 700);
    }
    function arrive() {
      if (ready) return; ready = true;
      var wait = loader ? Math.max(0, 550 - (Date.now() - shownAt)) : 0;
      setTimeout(function () {
        if (trans) tint(loader && pick ? BGHEX[pick.bg] : '');    // the page is parsed now: its first screen's color is known
        D.classList.remove('brgw-hold');
        if (trans) { D.classList.add('brgw-in'); inTimer = setTimeout(function () { D.classList.remove('brgw-in'); untint(); }, 1300); }
        hideLoader();
      }, wait);
    }

    if (trans) { D.classList.add('brgw-hold'); if (pick) tint(BGHEX[pick.bg]); else tint(''); }
    if (mode === 'always' || (came && mode !== 'off')) showLoader(came);
    else if (mode === 'slow') setTimeout(function () { if (!ready) showLoader(false); }, 350);

    var fontP = (document.fonts && document.fonts.load) ? document.fonts.load("1em 'Blanco Cavelary'") : Promise.resolve();
    var loadP = (document.readyState === 'complete') ? Promise.resolve()
      : new Promise(function (r) { window.addEventListener('load', r, { once: true }); });
    Promise.race([Promise.all([fontP.catch(function () {}), loadP]), new Promise(function (r) { setTimeout(r, 2500); })]).then(arrive);
    setTimeout(arrive, 3600);                                  // hard stop: nothing stays hidden

    if (!trans) return;
    function leave(href) {
      if (leaving) return; leaving = true;
      clearTimeout(inTimer); D.classList.remove('brgw-in');     // a quick click: stop the arrival animation, keep the tint
      if (!loader) pick = fresh();                              // a new animation and color for this change of page
      tint(mode !== 'off' ? BGHEX[pick.bg] : '');
      D.classList.add('brgw-out');
      try { sessionStorage.setItem('brgwFx', pick.v + '|' + pick.bg); } catch (e) {}
      setTimeout(function () { if (mode !== 'off') showLoader(false); location.href = href; }, 340);
      setTimeout(reset, 20000);                                // navigation cancelled: give the page back
    }
    function reset() {
      leaving = false; D.classList.remove('brgw-out'); untint(); hideLoader();
    }
    // window, not document: every handler on the page runs first, so a link some other script
    // already took over (a popup button, a menu toggle) arrives here with defaultPrevented set.
    window.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var tg = a.getAttribute('target');
      if ((tg && tg !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-brgw-nofx')) return;
      if (a.getAttribute('data-brgw-modal')) return;
      var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
      if (u.origin !== location.origin) return;
      if (u.pathname === location.pathname && u.search === location.search) return;
      if (/\/wp-(admin|login|json)|\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|mov|docx?|xlsx?|csv)$/i.test(u.pathname)) return;
      if (/[?&](ct_builder|oxygen_iframe)\b/.test(u.search)) return;
      e.preventDefault();
      leave(u.href);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) reset(); });
  }

  try { brgwPageFx(); } catch (e) { document.documentElement.classList.remove('brgw-hold', 'brgw-out'); }

  function boot() { startRevealGate(); initSliders(); startMotion(); brgwVideo(document); brgwSecColor(document); brgwSecBg(document); brgwMotion(document); brgwModal(document); brgwYear(); brgwBtnFx(document); brgwWheel(document); brgwVset(document); brgwSlides(document); brgwFull(document); brgwSmooth(); brgwCount(document); brgwBuild(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
