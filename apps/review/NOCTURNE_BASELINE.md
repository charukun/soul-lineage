# Battle presentation 2: NOCTURNE baseline

`apps/review/battle2.html` is the native, headless NOCTURNE baseline at the canonical `/battle2` route. It is not an iframe or a second game shell. The existing battle presentation remains separate. New combat rules are deliberately not mixed into this baseline.

## Runtime and assets

- `src/nocturne-stage.js`: observable boot, loading/error presentation and page/context lifecycle.
- `src/nocturne/runtime.js`: original actor playback, automatic combat, death, camera, effects and owned round resets.
- `src/nocturne/environment.js`: original forest placement/material treatment.
- `src/nocturne/assets.js`: same-origin `/library` URLs, bounded retrieval, SHA-256/byteLength checks and registered local dependencies.
- `src/nocturne/audio.js`: original synthesized NOCTURNE timbres, unlocked by the first genuine gesture and suspended while hidden.
- `src/nocturne/manifest.json` and `public/library/provenance/nocturne-battle2-v1.json`: matching provenance for 28 original models, dependent resources, authors, licenses, revisions, archive hashes, Git blobs and byte lengths.

Asset bytes live beside the other project assets in `apps/review/public/library/model/`, `object/` and `licenses/`. Model/object paths contain their content Git blob hash. There is no runtime or build request to the NOCTURNE Worker or upstream repositories. The source-reference URLs in provenance are not delivery URLs.

The one-shot import scripts are reproducibility tools, not npm lifecycle hooks. Archive acquisition verifies the original published NOCTURNE hashes and CC0 license files. The source extraction verifies its pinned Git blob, preserves subsequent native-module edits, and is never run during ordinary builds. Do not rerun source extraction over edited native modules or add materialization to the Fast DEV path.

## Display and lifecycle contract

A visit loads the real models and starts combat automatically. There is no title, upgrade choice, menu, HP bar, damage number, hidden UI-support DOM, waypoint input or combat control. The transient loading/error text is outside the removed game HUD; a failed load must never become a silent green screen.

Enemies retain their original spawn/attack/death clips and visual effects. Wave upgrades are chosen automatically. Victory and defeat both restart under the simulation clock, after a 3.2-second settling interval so the last death animation is not cut short. No unowned timeout starts a second runtime. Hiding the page pauses simulation and sound, and teardown stops rendering and disposes owned resources. Browser audio permission still requires a real gesture; visual startup never waits for it.

`window.__BATTLE2__` exposes read-only state, errors, source SHA, metrics, actor snapshots and a bounded trace. `advance(seconds)` exists only on visits with `?evidence=1`; it drives the same simulation with fixed time steps for lifecycle regression, not fabricated battle results.

## Verification

Focused checks are `apps/review/tests/review-app.test.mjs` and `apps/review/tests/nocturne-library.test.mjs`, followed by the review build. The explicit specialist browser script is `apps/review/scripts/nocturne-browser.mjs`; it requires an installed Chromium and an already-built `dist/review` from the exact source checkout.

Browser evidence records the exact source SHA and separates real-time attack/death rendering from fixed-step repeated-round regression. It checks desktop/mobile WebGL, native audio unlock, no HUD/control DOM, same-origin library requests, resize, and a missing-asset fixture with two bounded attempts and a visible error. Reports, screenshots and Playwright traces belong to the task-specific evidence artifact, not an unconditional normal CI sweep.

Normal final-head validation and freshness remain unchanged. The task-scoped materializer/evidence workflow must be absent from the final merge tree. DEV publication begins after the verified head is merged and is not a waiting stage.
