# Motion Quality A/B comparison

## Purpose

This review exists to answer one concrete question: does the shared Motion Quality runtime layer materially improve the same Shino motion, or are we merely accumulating infrastructure?

The comparison must keep the character, source motion, timeline, camera and playback speed fixed. The only intentional difference is whether the shared correction path is applied.

## Reviewer surface

Character Workshop -> Motion QA exposes a dedicated **A/B比較** mode.

- **A / 基盤OFF** renders the existing source pose and legacy grip ordering without the shared transition repair, anatomical correction or geometry-space grip calibration.
- **B / 基盤ON** renders the same frame through the current shared Motion Quality path.
- Both views use the same selected Shino, source frame, camera, lighting and playback clock.
- The UI labels the two sides explicitly and never presents numeric diagnostics as visual approval.
- A reviewer can pause, scrub, step one frame and change the fixed QA camera while preserving A/B alignment.

The first acceptance case remains the known slash follow-through around Workshop time 17.475 s / frame 1049. Review front-left plus at least one right/back view rather than judging only the front silhouette.

## What to judge

The visible comparison should make these questions easy to answer without reading implementation details:

1. Does the upper arm remain outside the torso instead of disappearing through it?
2. Does the elbow bend plane read as anatomical rather than arbitrary roll?
3. Does forearm/wrist twist look less broken while keeping the authored hand target recognizable?
4. Does the sword sit in the palm more naturally, including the support hand for two-handed poses?
5. Do corrections avoid introducing a larger silhouette, timing or pose regression elsewhere?

The diagnostics panel may show self-intersection issues, affected bones and applied correction metadata as supporting evidence. It is not a quality score.

## Decision rule

Keep or expand the shared basis only when the same input visibly improves and the correction is reusable across body variants or consumers. If A and B are visually indistinguishable, or B creates equal or worse regressions, treat that portion of the basis as a candidate for simplification/removal rather than adding more rules around it.

This comparison does not change gameplay timing, hit detection, damage, source animation keys, production-stage approval or Integration gates. Human visual judgment remains the final acceptance for appearance quality.
