# Visual Review Focus Flow

This interaction contract refines `docs/art/VISUAL_REVIEW.md` without changing model, motion, VFX, gameplay, or Integration source-of-truth rules.

## Goal

Visual Review is a launcher, not a dashboard. The reviewer chooses one thing to inspect and immediately enters the dedicated inspection surface.

## Direct-launch flow

- `review.html` contains only five primary destinations: Character, Motion, Equipment/Objects, Effects, Battle.
- Character, Motion, Equipment/Objects and Effects navigate directly to their existing dedicated review pages. Do not embed them in iframes and do not keep a Visual Review shell above them.
- Battle has its own dedicated `review-battle.html` surface because it needs the real `RaidHost -> Tidebreak` state plus runtime-model controls.
- The browser/device Back action is the primary return path. Dedicated pages may expose a small `← Review` link, but no persistent global launcher, app-context bar, source dashboard or workflow explanation may remain above the inspected content.
- Canonical-source explanations and cross-app contracts remain in repository docs and inside the specialist tools where relevant. The launcher must not front-load them.
- On mobile, the launcher should fit as a simple single-screen choice surface and the destination page should own the viewport.

## App context

App context belongs inside the specialist surface that can actually apply it. Character/Motion may expose their existing context controls. The launcher does not maintain a second global app-context state.

## Battle review

Battle review must continue to consume the real current `RaidHost -> Tidebreak` battle state and must not invent a second combat clock or hit logic.

The visual representation must use real repository runtime character models instead of abstract circles. Requirements:

- render two actual shared runtime models in a 3D combat stage;
- drive positions, facing, combat pose timing, hit state, HP and result from the existing battle state;
- provide explicit model selectors for both sides so reviewers can compare current KayKit variants without changing combat rules;
- keep model switching presentation-only and labelled as such;
- keep restart and pause/resume;
- remain usable on a Pixel Fold-class narrow viewport;
- if a model cannot load, show an explicit review fallback/status instead of silently pretending the model is present.

## Browser acceptance

The PR implementing this contract must carry `Browser-Playtest: rinne` and the exact PR head must be exercised in Chromium. The playtest must prove at least:

1. the launcher exposes exactly the five primary destinations without the old dashboard layers;
2. one tap navigates to each dedicated review page;
3. browser Back returns to the launcher;
4. no iframe-based specialist surface remains in the launcher;
5. Battle shows actual model geometry, battle time advances, pause/restart work, and both model selectors change the rendered model;
6. Character/Motion/Equipment/Effects still load their current real review surfaces.
