/* Sean's line artwork + the SVG builder. Shared by lab.html and lab-full.html. */
const L = {"line-careers-lg": {"vb": "0 0 1122 31", "d": "M1113.98 6.83936C1037.94 4.51136 961.881 2.75438 885.811 1.60938C812.621 0.508377 739.423 -0.0306549 666.225 0.00134513C594.649 0.0333451 523.074 0.610339 451.507 1.72034C381.556 2.80634 311.614 4.40038 241.685 6.47138C172.15 8.53138 102.629 11.0623 33.1268 14.0143C24.4948 14.3813 15.8618 14.7544 7.23076 15.1334C-2.38424 15.5554 -2.43624 30.5574 7.23076 30.1334C76.6858 27.0834 146.159 24.4393 215.647 22.2643C285.452 20.0793 355.272 18.3644 425.1 17.1534C496.467 15.9164 567.843 15.2053 639.221 15.0383C712.144 14.8673 785.069 15.2614 857.986 16.2164C933.704 17.2084 1009.41 18.8044 1085.11 20.9794C1094.73 21.2564 1104.36 21.5423 1113.98 21.8373C1123.61 22.1323 1123.63 7.13234 1113.98 6.83734L1113.98 6.83936Z"}, "line-home-lg": {"vb": "0 0 845 28", "d": "M7.24511 24.0247C115.3 18.9347 223.466 15.9748 331.641 15.2048C439.806 14.4348 547.992 15.8248 656.097 19.3848C716.643 21.3748 777.159 24.0547 837.645 27.4047C847.315 27.9347 847.285 12.9347 837.645 12.4047C729.64 6.4347 621.515 2.59474 513.36 0.944743C405.204 -0.705257 297.009 -0.195218 188.874 2.48478C128.307 3.98478 67.7612 6.1747 7.24511 9.0247C-2.38495 9.4747 -2.44508 24.4847 7.24511 24.0247Z"}, "line-team-lg": {"vb": "0 0 647 25", "d": "M7.2299 21.8885C89.3729 18.0125 171.591 15.7555 253.824 15.1615C336.049 14.5675 418.285 15.6185 500.468 18.3195C546.863 19.8445 593.239 21.9005 639.587 24.4665C649.232 25.0005 649.202 9.99854 639.587 9.46654C557.484 4.92054 475.294 1.99353 393.075 0.728534C310.856 -0.535466 228.612 -0.155462 146.408 1.87454C99.9979 3.02054 53.6019 4.69854 7.22889 6.88654C-2.38211 7.34054 -2.43711 22.3425 7.22889 21.8865L7.2299 21.8885Z"}, "line-community-lg": {"vb": "0 0 841 28", "d": "M7.21045 24.0257C114.749 18.9355 222.396 15.9754 330.054 15.2054C437.702 14.4353 545.37 15.8254 652.958 19.3855C713.215 21.3756 773.441 24.0557 833.638 27.4059C843.262 27.9359 843.232 12.9353 833.638 12.4053C726.15 6.43504 618.542 2.59487 510.904 0.9448C403.266 -0.705264 295.588 -0.195267 187.97 2.48484C127.694 3.9849 67.437 6.17502 7.21045 9.02514C-2.37354 9.47515 -2.43338 24.4857 7.21045 24.0257Z"}, "line-careers-nav": {"vb": "0 0 104 7", "d": "M2.41125 5.82631C28.1543 4.83831 53.9282 4.73531 79.6782 5.53131C86.9882 5.75731 94.2952 6.05732 101.599 6.42632C104.815 6.58832 104.806 1.58832 101.599 1.42632C75.8692 0.126318 50.0962 -0.288685 24.3372 0.196315C17.0272 0.334315 9.71825 0.545312 2.41125 0.826312C-0.795746 0.949312 -0.811746 5.95031 2.41125 5.82631Z"}};
const sv = (k) => {const l=L[k];return '<svg viewBox="'+l.vb+'" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path pathLength="1" d="'+l.d+'"/></svg>';};

/* The variants themselves. Shared so lab.html and lab-full.html can never show a
   different set — the page exists to compare them, so two copies would defeat it. */
const CARDS=[
 {g:'gA',id:'A1',t:'Wipe — your artwork, untouched',
  why:'Your line-careers-lg.svg exactly as exported, revealed with a clip-path. No re-export, nothing to redraw. The leading edge is a flat vertical cut.',
  html:'<p class="head blanco">Come work somewhere<br><span class="u wipe" data-k="line-careers-lg">you actually want to be</span></p>'},
 {g:'gA',id:'A2',t:'Draw — stroked centreline',
  why:'A true pen-draw with a live rounded tip. Needs the five files re-exported as strokes rather than filled outlines (or the centreline derived).',
  html:'<p class="head blanco">Come work somewhere<br><span class="u draw" data-k="line-careers-lg">you actually want to be</span></p>'},
 {g:'gA',id:'A3',t:'Same as A1 — different stroke, different words',
  why:'ANSWERING YOUR QUESTION: there is NO mechanical difference between A1 and A3. Identical wipe, identical code. A1 is line-careers-lg.svg (1122×31) under the careers headline; A3 is line-home-lg.svg (845×28) in yellow under the home one. It is here to show the artwork carrying its own width — nothing measures the text.',
  html:'<p class="head blanco">We’re in the business<br>of <span class="u wipe" data-k="line-home-lg" style="color:var(--yellow)">making your day great.</span></p>'},
 {g:'gA',id:'A4',t:'Draw — careers, direction corrected',
  why:'line-careers-lg.svg is authored right-to-left, so a naive draw writes backwards. This one is flipped so it always writes left-to-right.',
  html:'<p class="head blanco">Come work somewhere<br><span class="u draw rtl" data-k="line-careers-lg">you actually want to be</span></p>'},

 {g:'gA',id:'A5',t:'A1 on the Team headline',
  why:'Same wipe again, line-team-lg.svg in pink. Third headline, third stroke, one mechanism.',
  html:'<p class="head blanco">The crew behind<br><span class="u wipe" data-k="line-team-lg" style="color:var(--pink)">every single day.</span></p>'},
 {g:'gA',id:'A6',t:'A1 on a long headline',
  why:'Stress test: more words than the stroke was drawn for. The artwork stretches to the span — watch whether it thins out at this width.',
  html:'<p class="head blanco">Great food, great people,<br><span class="u wipe" data-k="line-community-lg" style="color:var(--orange)">epic communities everywhere.</span></p>'},

 {g:'gB',id:'B1',t:'After the whole headline',
  why:'Every line lands, then the stroke draws. Reads as a signature at the end.',
  html:'<p class="head blanco" data-split>Come work somewhere you actually want to be</p><span class="u wipe blk" data-k="line-careers-lg" data-delay="whole"></span>',split:true,delay:'whole'},
 
 {g:'gC',id:'C1',t:'Box first, then words',
  why:'REBUILT to your note. "Born in San Diego. Built" lands first, the box starts as "Built" finishes, and the words rise in HALFWAY through the box rather than waiting for it — so it reads as one fluid move. Text rises from a mask, same as the headline, not a fade.',
  html:'<p class="head blanco">Born in San Diego.<br>Built <span class="mk tilt"><span class="tw"><span class="t">for community.</span></span></span></p>'},
    {g:'gC',id:'C5',t:'Yellow banner — What we’re about',
  why:'Now identical to C1, as you asked — box in, words rising halfway through. It was not showing the full move before because the text only faded; it now rides the same mask.',
  html:'<p class="head blanco"><span class="mk tilt" style="--mkc:var(--yellow)"><span class="tw"><span class="t">What we’re about</span></span></span></p>'},

 {g:'gD',id:'D1',t:'Draw in, un-draw out',
  why:'Leaving reverses the stroke back out, as the Osmo pen does.',
  html:'<div class="navbar"><a href="#">Our Story</a><a href="#">Team</a><a href="#" class="act">Careers</a><a href="#">Community</a></div>'},
 ];
