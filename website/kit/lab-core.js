/* lab-core.js — shared MECHANISM only.

   It used to also carry the artwork (L, sv) and the card list (CARDS). Both now live
   in lab-lines.js and lab-cards.js, loaded by lab.html AND lab-full.html, because a
   second copy here went stale and full view drew last week's shapes — 5 of 11 entries,
   none with centrelines, so every draw variant traced the outline and four cards threw
   on an undefined key. One home per fact; this file is not a home for either.

   Anything added below must be a MECHANISM, not data. If you find yourself pasting a
   path or a card, it belongs in one of the two shared files. */
