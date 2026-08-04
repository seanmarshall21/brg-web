/* brgw.js — SHARED reveal engine for every BRG page. Edit once → all pages update.
   Injected inline (no iframe) by the vc-clients plugin, after each page fragment.
   Finds every .brgw root on the page and: gates on Blanco (no FOUT), split-line
   reveals .anim-head, fade-ups .anim-up, splash-style .anim-cta buttons — each
   section triggered on scroll-in. Content is hidden from first paint via brgw.css;
   a timeout guarantees reveal even if the font is slow. */
(function () {
  function initRoot(root) {
    if (!root || root.dataset.animInit) return; root.dataset.animInit = '1';
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
    root.querySelectorAll('.reveal').forEach(function (sec) {
      var items = [].slice.call(sec.querySelectorAll('.ln-i, .anim-up, .anim-cta')), d = 0;
      items.forEach(function (el) {
        el.style.transitionDelay = d + 'ms';
        if (el.classList.contains('anim-cta')) el.style.animationDelay = d + 'ms';
        d += el.classList.contains('ln-i') ? 85 : 115;
      });
    });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    root.querySelectorAll('.reveal').forEach(function (s) { io.observe(s); });
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

  function boot() { startRevealGate(); initSliders(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
