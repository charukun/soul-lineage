# Visual Review Focus Flow

This task-specific interaction contract refines the existing `docs/art/VISUAL_REVIEW.md` review requirements without changing the underlying model, motion, VFX, gameplay, or Integration source-of-truth rules.

## Goal

Visual Review must behave like a fast inspection tool rather than a control dashboard. The reviewer should choose what to inspect, then immediately spend the viewport on the inspected content.

## Focus-first flow

- The landing state is a small chooser for the review target. It must not front-load the full canonical catalog, workflow explanation, source metadata, and app diagnostics.
- Choosing Character, Motion, Equipment/Objects, Effects, or Battle enters a focused inspection state.
- In a focused state, the landing chooser/navigation is hidden. Only a compact Back control, the current target, source status, and controls that materially affect that target remain visible.
- On mobile, the focused surface uses the viewport height and must not keep the full app selector + review menu stacked above the inspected content.
- Returning Back restores the chooser without losing the selected app context.
- Canonical-source explanations remain available as secondary information, not the default first screen.

## App context

App context remains useful, but it is a filter/presentation dimension rather than a second primary navigation layer. Keep it compact and preserve the selected context across review targets. A focused tool may show the current app as one compact control instead of three persistent top-level buttons.

## Battle review

Battle review must continue to consume the real current `RaidHost -> Tidebreak` battle state and must not invent a second combat clock or hit logic.

The visual representation, however, must use real repository runtime character models instead of abstract circles. Requirements:

- render two actual shared runtime models in a 3D combat stage;
- drive positions, facing, combat pose timing, hit state, HP and result from the existing battle state;
- provide explicit model selectors for both sides so reviewers can compare current KayKit variants without changing combat rules;
- keep model switching presentation-only and labelled as such;
- keep restart and pause/resume;
- remain usable on a Pixel Fold-class narrow viewport;
- if a model cannot load, show an explicit review fallback/status instead of silently pretending the model is present.

## Browser acceptance

The PR implementing this contract must carry `Browser-Playtest: rinne` and the exact PR head must be exercised in Chromium. The playtest must prove at least:

1. landing chooser is visible and simple;
2. tapping a review target hides the chooser and opens the focused view;
3. Back returns to the chooser;
4. the mobile focused view does not retain the full navigation above the content;
5. Battle shows actual model geometry, battle time advances, pause/restart work, and both model selectors change the rendered model;
6. Character/Motion/Equipment/Effects focused views still open their current real review surfaces.
