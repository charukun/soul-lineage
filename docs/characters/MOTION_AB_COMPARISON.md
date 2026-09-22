# Motion Quality A/B comparison

## Purpose

This review exists to answer one concrete question: does the shared Motion Quality runtime layer materially improve the same Shino motion, or are we merely accumulating infrastructure?

The comparison keeps the character, source motion, timeline, camera and playback speed fixed. The intentional comparison is the existing Workshop **Before** path versus the current Motion Quality correction path. Shared rendering, rig loading and coordinate infrastructure remain common so unrelated renderer differences do not contaminate the result.

## Reviewer surface

Character Workshop -> **動き比較** is a live split-screen comparison, not a still-image gallery.

- The upper 3D viewport is divided into two synchronized panes while review is active.
- **Left / 基盤 OFF** renders the same source pose through the pre-correction review path and legacy grip profile. It does not apply the current transition-repaired frame bank or anatomical arm-clearance correction.
- **Right / 基盤 ON** renders the same playback time through the current transition-repaired frame bank, anatomical correction and current grip-calibration profile.
- Both panes use the same selected Shino, source clock, camera and lighting. The live labels remain visible over the viewport so the reviewer never has to remember which state is being shown.
- Playback starts as a single-character comparison. Scrubbing, frame stepping and camera changes stay synchronized.
- Switching the fallback single-view basis ON/OFF must preserve the current playing state. Changing basis is a visual comparison operation, not a pause command.
- The primary controls are start, play/pause, live split toggle and exit. Single-view basis, automatic camera tour, cohort counts, static evidence capture, diagnostics and JSON stay under secondary disclosure controls.
- Static A/B capture remains available only as evidence/export support. It is not the primary review experience.

The first acceptance case remains the known slash follow-through around Workshop time 17.475 s / frame 1049. Review front-left plus at least one right/back view rather than judging only the front silhouette.

## What to judge

The live comparison should make these questions easy to answer without reading implementation details:

1. Does the upper arm remain outside the torso instead of disappearing through it?
2. Does the elbow bend plane read as anatomical rather than arbitrary roll?
3. Does forearm/wrist twist look less broken while keeping the authored hand target recognizable?
4. Does the sword sit in the palm more naturally, including the support hand for two-handed poses?
5. Do corrections avoid introducing a larger silhouette, timing or pose regression elsewhere?
6. Does the improvement remain visible during continuous motion, rather than only at one hand-picked still frame?

The diagnostics panel may show self-intersection issues, affected bones and applied correction metadata as supporting evidence. It is not a quality score.

## Decision rule

Keep or expand the shared basis only when the same input visibly improves and the correction is reusable across body variants or consumers. If OFF and ON are visually indistinguishable during continuous playback, or ON creates equal or worse regressions, treat that portion of the basis as a candidate for simplification/removal rather than adding more rules around it.

This comparison does not change gameplay timing, hit detection, damage, source animation keys, production-stage approval or Integration gates. Human visual judgment remains the final acceptance for appearance quality.
