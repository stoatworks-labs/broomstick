# AGENTS.md — Broomstick

Invariants for anyone (human or agent) changing this repo.

- **`src/art/` is generated. Do not edit it.** It is Test Card's Halloween artwork
  (`~/Projects/video/test-card`, `src/patterns/art/` and `src/patterns/random.ts`), copied by
  `scripts/sync-art.mjs` from Test Card's committed `main` with two import paths rewritten. A
  drawing that needs changing is changed in Test Card, then synced. `npm run check-art` says
  whether the copy has drifted.
- **The rules are pure.** `src/game.ts` has no canvas, DOM or clock: a test flies a whole run in a
  loop. Painting lives in `src/scene.ts` and `src/hud.ts`, input and timing in `src/main.ts`.
  Keep anything that decides what happens out of the painters.
- **The rules run at a fixed 240 Hz** (`STEP` in `main.ts`) so every screen flies the same.
- **A gap must be flyable.** `growTree` scales each tree so its solid branches end exactly at the
  gap's edge. Only the outermost fork (thinner than `TUNING.twig` of the trunk) is forgiven, and
  the tests hold those twigs to a short reach into the gap. After changing anything in `TUNING`,
  run the tests: the pilot (aim for the middle of the next gap, flap when below it) must still get
  through 50 trees on every seed. A crown wider than the space between pairs, or a gap that moves
  further than she can fall between them, fails it.
- **The witch's hit points are taken from Test Card's drawing** (`HIT_POINTS`, in broom lengths).
  If the drawing changes shape, check them against it.
- **Pausing never flaps.** The press that resumes is not aimed at anything, so she carries on from
  a standstill.
- **The video depends on `?pilot`, `?seed` and the `broomstick` events.**
  `stoatworks-backend/video/projects/broomstick` films the live page with them and times its
  captions off the events. Renaming one breaks the next take. The autopilot is `autopilot()` in
  `game.ts`, the same function the tests fly, so the demo can't fly a different game.
- **Deploy is a static-assets Worker**, by hand (`wrangler.toml` has the command). No CI workflows
  here. A route on a proxied `AAAA 100::` record, not a custom domain: see `wrangler.toml`.
