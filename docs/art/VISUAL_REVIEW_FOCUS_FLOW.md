# Visual Review Focus Flow

This interaction contract refines `docs/art/VISUAL_REVIEW.md` without changing model, motion, VFX, gameplay, or Integration source-of-truth rules.

## Goal

Visual Review is a launcher, not a dashboard. The reviewer chooses one thing to inspect and immediately enters the dedicated inspection surface.

## Canonical public route

Visual Review Lab has exactly one public DEV route: `https://charukun.github.io/soul-lineage/dev/rinne/review.html` and its sibling review pages under `/dev/rinne/`. Do not publish or advertise a separate Visual Review Worker, preview URL, dedicated public status, or second review deployment lane.


## Direct-launch flow

- `review.html` contains only five primary destinations: Character, Motion, Equipment/Objects, Effects, Battle.
- Character, Motion, Equipment/Objects and Effects navigate directly to their existing dedicated review pages. Do not embed them in iframes and do not keep a Visual Review shell above them.
- Battle has its own dedicated `review-battle.html` surface because it needs the real `RaidHost -> Tidebreak` state plus runtime-model controls.
- The browser/device Back action is the primary return path. Dedicated pages may expose a small `← Review` link, but no persistent global launcher, app-context bar, source dashboard or workflow explanation may remain above the inspected content.
- Canonical-source explanations and cross-app contracts remain in repository docs and inside the specialist tools where relevant. The launcher must not front-load them.
- On mobile, the launcher should fit as a simple single-screen choice surface and the destination page should own the viewport.
- Repeated label normalization must be idempotent. A MutationObserver-driven normalizer must not rewrite already-normalized text and trigger its own child-list loop.

## Selection UX

For Visual Review surfaces, primary subject/variant selection should use one consistent pattern whenever the candidate set is enumerable:

- show the current choice in one dedicated selected-value slot; when a preview stage already has a suitable corner overlay, that overlay should serve as the slot instead of duplicating the same selection below;
- keep the candidate list visible rather than hiding it behind a modal, drawer or dropdown;
- render candidates as a five-column grid on both desktop and narrow mobile review layouts;
- selecting a candidate updates the selected-value slot and the inspected subject immediately;
- keep the selected candidate visually obvious in the grid;
- reserve compact selects/dropdowns for secondary settings such as playback speed, quality tier, or other scalar/technical controls rather than the primary reviewed subject.

This pattern applies to review choices such as model, effect, equipment/part candidate and comparable visual variants unless a specialist contract requires a different interaction for a concrete reason.

## App context

App context belongs inside the specialist surface that can actually apply it. Character/Motion may expose their existing context controls. The launcher does not maintain a second global app-context state.

## Effects review

Effects review is a browsing surface before it is a tuning surface. It must stay useful when the effect catalog grows from a handful of authored effects to dozens or hundreds.

- Keep one real runtime preview stage; do not create one WebGL/Effekseer context per catalog card.
- Present the available review entries as an always-visible five-column grid list. The list must not be hidden behind a picker popup or drawer.
- Use the stage's upper-left overlay as the single selected-effect slot. It shows minimal context plus the selected effect name/components. Do not duplicate that slot below the stage. Selecting a grid item must immediately update the stage slot and replay the effect on the shared stage.
- Keep the selected grid item visually obvious and keep the five-column list reachable while the stage is visible on desktop and narrow mobile layouts. Avoid redundant catalog headings/counts and hide search/category tools while the candidate set is trivially small; reveal discovery tools automatically once the list is large enough to need them.
- Preserve the existing playback controls (speed, load tier, loop, reduced motion, pause, clear, camera reset) as secondary controls rather than the primary discovery UI.
- The gallery is source-agnostic UI. This task must not add network discovery, remote importing, or a second VFX source of truth.
- Cards may expose lightweight review metadata such as category, component count, and authored source label, but must not pretend a static decorative thumbnail is the real effect.
- The real-source effect count represents distinct authored source effects only. Playback speed, scale, position, mirroring, loop mode, lifetime, color-only variants, or other presentation-only variants must never increase the count.
- The same authored effect player / Effekseer backend remains the preview truth; selecting catalog entries changes presentation input only.
- The neutral VFX stage must communicate gameplay scale and effect intent. Do not use anonymous capsule/cylinder position markers as the primary review subjects; use readable humanoid review mannequins plus explicit source, impact and area/trajectory guides.
- VFX presets may change review-only staging (single target, multi-target, area/finisher context) while preserving the same authored effect event/runtime path. The staging must clarify where an effect originates and lands without inventing damage rules.

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
