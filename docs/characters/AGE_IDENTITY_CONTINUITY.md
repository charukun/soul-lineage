# Age Identity Continuity Review

## Purpose

Validate whether one canonical character still reads as the same person across five deliberately separated life stages before adopting a character-generation workflow for broad production use.

This is a review contract, not a new save schema or a replacement for the existing runtime `child / adult / elder` presentation bands. It must not change Character identity, genome, parents, gameplay eligibility, production stage, or model-generation provider behavior.

## Five-stage probe

Use one canonical Character record and derive deterministic review snapshots at these ages:

| Review stage | Age | Intent |
| --- | ---: | --- |
| `childhood` | 4 | 幼少。大きい頭身差と幼い顔でも本人性が残るか |
| `boyhood` | 12 | 少年。成長途中で別人化していないか |
| `young-adult` | 22 | 青年。成人基準の本人像を固定する |
| `mature-adult` | 50 | 壮年。加齢変化が入っても顔の骨格・目鼻・体格系譜が残るか |
| `elder` | 75 | 老年。白髪・姿勢・皮膚年齢を許容しながら同一人物に見えるか |

The ages are review anchors only. They intentionally exercise the existing `ageAppearance()` curve without introducing new persisted lifecycle states.

## Identity invariants

All five snapshots must preserve the same canonical:

- `id`, `masterId`, `seed`, parents and genome;
- underlying eye, skin and hair lineage before age-driven gray treatment;
- inherited height/build tendencies;
- reference identity intent and approved distinguishing features supplied to the model-generation task.

Age is allowed to change scale, head proportion, gray amount, stoop and skin aging according to the existing lifecycle appearance rules. Clothing and role presentation must not be used to fake identity continuity.

## Visual review recipe

Compare like with like using the repository visual-review standard. Each stage should expose the same neutral presentation where possible:

- front;
- three-quarter front;
- side/profile;
- back;
- face close-up;
- neutral pose and neutral lighting;
- identical projection/FOV/framing policy, adjusted only enough to keep character scale comparable.

Review adjacent stages and the full-span `childhood -> elder` pair. Judge structural identity before cosmetic polish.

## Review dimensions

Each comparison records these independent dimensions:

1. `face-structure` — jaw, cheeks, chin and overall facial construction evolve rather than reset.
2. `eyes` — spacing, angle and recognisable eye identity remain related.
3. `nose-mouth` — nose and mouth placement/proportion remain recognisably descended from the same face.
4. `hair-lineage` — hairstyle may mature and color may gray, but the chosen evolution should read as one person's history rather than a random replacement.
5. `body-lineage` — height/build progression follows the same inherited tendency.
6. `age-readability` — each stage actually reads at the intended life stage instead of preserving identity by freezing the same adult face.
7. `overall-same-person` — explicit visual judgment after the previous dimensions are inspected.

Automated or worker self-scores are diagnostic only. They must never set Production `visualApproval=approved` or advance `REFERENCE -> ... -> RUNTIME_READY` gates.

## Acceptance

The five-stage performance probe succeeds only when:

- all five review snapshots come from the same canonical Character identity;
- the review set is complete and deterministic;
- every adjacent comparison plus `childhood -> elder` has an explicit review result;
- no comparison has a failed identity dimension;
- every stage passes `age-readability`;
- the final `overall-same-person` decision is explicitly positive for every required comparison.

A failure is useful evidence. It should identify the earliest transition where identity breaks so the generation/modeling workflow can be corrected before producing a larger cast.

## Parallel-work boundary

This contract is designed to run in parallel with character-model generation experiments. It does not edit generated VRM/GLB assets, Shino production manifests, the long-lived Visual Review Lab branch, motion assets, runtime presentation selection, or main/Production. A generation worker may later attach its five candidate assets to this review plan without changing the Character save contract.
