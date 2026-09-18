# VFX review library

## Purpose

Visual Review の戦闘エフェクト画面で、再利用可能な外部 VFX 原本を大量比較し、本番採用候補を人間が高速に絞り込めるようにする。

## Sources and provenance

- Production source: `effekseer/ResourceData@1adef35d78363d3e914192267adf83a8e2b30759` (CC0-1.0 sample terms already pinned by the existing pipeline).
- Review expansion source: `effekseer/EffekseerForWebGL@e8c3ce076644789918695b0cba0031461c817890/tests/Resources` (MIT repository license).
- Runtime: Effekseer for WebGL 1.70 at the same pinned runtime revision.
- External originals remain unmodified. Repository code owns catalog metadata, review placement, playback timing and combinations only.

Every review-only source file is pinned by byte length and Git blob SHA. `.efkefc` INFO dependency closure is checked before use.

## Library

Production `AUTHORED_EFFECTS` remains exactly:

- `slash`
- `impact`
- `finisher`

Review adds four upstream originals without promoting them to production gameplay dependencies:

- `Arrow1.efkefc`
- `Blow1.efkefc`
- `Cure1.efkefc`
- `ToonWater.efkefc`

Together with the three existing originals, Visual Review exposes 7 original-effect cards. It also exposes the existing 4 gameplay presentations and 5 comparison compositions, for 16 review cards total.

## Loading boundary

The Visual Review launcher only preloads the existing small effect bootstrap. The expanded library is loaded only after entering `review-effects.html`.

The production game continues to call `createEffekseerBackend` without an override and therefore loads only `AUTHORED_EFFECTS`. The effect Review page passes `REVIEW_AUTHORED_EFFECTS` explicitly.

## Review UX

The effect catalog supports:

- text search across labels, tags and upstream effect names
- original-only filtering
- attack / impact / support / elemental / finisher / combination filters
- clear badges for upstream originals, review combinations and game-adopted presentations
- replay speed, quality tier, reduced motion and looping
- the existing humanoid scale / source / impact / area guides

## Review boundary

The Lab is for visual selection only. Choosing or previewing an entry does not assign damage, hit detection, combat timing or production approval. Comparison compositions are intentionally labeled and are not presented as distinct upstream assets.
