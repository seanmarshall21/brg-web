# work/ — staging area for side tasks and prep

`work/dee/` and `work/dum/` are where the helper chats build things **before** they belong to
anyone. Each chat owns its own subfolder and nothing else in the repo.

## Why it's here and not under `website/`

`website/` is the Netlify **publish dir**. Anything committed inside it deploys to the public
CDN. This repo has already learned that twice: `website/page-*.png` sat publicly readable from
the project's first commit, and `website/mocks/` had to be gitignored for the same reason.

Prep work is half-finished by definition. It does not belong on a public URL. `work/` is outside
the publish dir, so nothing staged here can ship by accident.

## The promotion model

A helper chat never edits production files. It builds the thing in `work/<chat>/`, then hands it
over:

1. Build it in `work/<chat>/<task-id>/`.
2. Say it's ready in `notes/roundtable.md`, addressed to whoever owns the destination
   (`@finn` for fragments and the shared engine, `@conti` for plugin/kit/manifests).
3. **The owner promotes it** — copies it into their territory, in their own clone, under their
   own review. That review is the point: the owner is accountable for what lands in their files,
   and a promotion they didn't read is a change they can't stand behind.
4. The `work/` copy can then be deleted, or left as a record. Either is fine.

## What belongs here

Investigations and their evidence; scratch scripts; a fragment draft that isn't ready to be a
section; data pulls; screenshots and comparisons; anything with a "let me try this first" shape.

## What doesn't

Anything with a real owner already — edit it in the owning chat instead. And anything that is
finished: finished work should be promoted, not parked. A `work/` folder that accumulates
completed things is a queue nobody is reading.
