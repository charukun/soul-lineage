# VFX review library

## Purpose

Visual Review の戦闘エフェクト画面で、再利用可能な外部 VFX 原本を大量比較し、本番採用候補を人間が高速に絞り込めるようにする。

## Source and provenance

- Primary source: `effekseer/ResourceData` pinned to an exact revision.
- Sample license: CC0-1.0 as recorded by the upstream Effekseer sample license.
- Runtime: existing Effekseer WebGL runtime and existing same-origin/pinned-hash acquisition pipeline.
- External originals remain unmodified. Repository code owns only catalog metadata, review placement and playback settings.

## Acceptance

- Production `AUTHORED_EFFECTS` keeps its current small runtime set.
- Review-only effects are a separate catalog and do not become production gameplay dependencies merely by appearing in the Lab.
- Review assets are pinned by exact revision, byte length and git blob SHA and their dependency closure is verified before use.
- Visual Review exposes searchable/filterable cards for a substantially larger effect set and can play a selected original without reloading the page.
- Review preloading remains bounded; it must not warm the full library on launcher load.
- Existing production combat-effect behavior and quality gates are not weakened.

## Review boundary

The Lab is for visual selection only. Choosing or previewing an entry does not assign damage, hit detection, combat timing or production approval.
