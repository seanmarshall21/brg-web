# wp-admin edits for the 18 Nov client feedback

Why these are yours and not a code push: the old wording and photos are **saved in wp-admin**,
and a saved value always wins over the code. Checked on the live pages at build 2026.11.18.1:
the old heading, the "Lorem ipsum", the old contact lines and Libette are all still showing.
Where: wp-admin (https://blacktoprestaurantgroup.com/wp-admin/) → **Section Content** in the left
menu → the page named below. Save with **Update** at the top right of each page.

## Home (Section Content → Home)

1. **What We're About, shorter.** Open the tab **What we're about slider**. Set **Height** to
   *60% of the screen* (80% or 40% also work). Leave **Height — never shorter than** at 400.
   Note: the shorter heights are not pinned, so the arrows change the slide (no scroll-through).
2. **A different kind of restaurant group.** Tab **A different kind of restaurant group** (it may still say "company" until the admin refreshes).
   **Heading** field: change the second line to `restaurant group` (the first line stays `of`).
3. **Swap Board & Brew and Odie's photos.** Same tab. Today **Photo 1** (large) is the Odie's
   food photo `brg-odies-food.webp` and **Photo 2** (tall) is the Board & Brew photo
   `brg-bnb-sando.webp`. Swap them: put the Board & Brew photo in Photo 1 and the Odie's photo in
   Photo 2. Heads-up: `brg-bnb-sando.webp` is only 519 x 479 pixels, and Photo 1 is the big
   frame (the site asks for about 1600 x 1067), so it will look soft there. A larger version of
   that photo would fix it.
4. **Culture and Stay Stoked photos.** Tab **Core values** (not "Core values 2"), the list. Row **Culture**: set
   **Photo** to `brg-culture-main-page.webp`. Row **Stay Stoked**: set **Photo** to
   `brg-stay-stoked-main-page.webp`. Both are 1620 x 1080 and already in the media library
   (uploads/2026/11).

## Team (Section Content → Team)

5. **Remove Libette.** Tab **Crew grid**, "Team members": the row named **Libette Magallon** (Regional Manager,
   Board and Brew). Use the row's delete (the minus at the right of the row), then Update.

## Community (Section Content → Community)

6. **Switchfoot Bro-Am copy.** Tab **How we give back**, the slides: the slide titled **Switchfoot
   Bro-Am**, field **Text**. Replace the "Lorem ipsum" with:

   > We’re proud to sponsor the Switchfoot Bro-Am every year. What started as a beach day in 2005 has grown into one of San Diego’s best traditions, raising funds for local nonprofits that help kids thrive through music, art and surf.

## Contact (Section Content → Contact)

7. **Body copy.** Tab **Hero**, field **Sub copy**:

   > From partnerships and press to jobs and feedback, here’s who to reach.

8. **Press & media.** Tab **Where to send it**, **Box 2 — top right** (Press & media), field **One-liner**:

   > Press inquiries, interviews, or a comment on a story.

## Already live, nothing to do

- Careers "Open Positions" button now scrolls down to the job cards (build 2026.11.18.1).
- Community "Want to partner with us?" button now appears as soon as it is on screen (same build).
- Phone layout of the About slider restored (a 3 Nov update had dropped it).
