# RINNE 3D Production Standard

This directory is the repository-level production standard for 3D art work in 輪廻転焦. It defines how an implementation worker should choose references, edit real assets, preserve compatibility, and prove visual quality. It is not an Astra-only prompt library and it does not replace model-specific contracts.

## Authority order

When guidance conflicts, use this order:

1. Current repository rules and latest `develop`.
2. The applicable model/runtime contract under `docs/characters/` or an app/package contract.
3. Approved character/environment reference sheets and accepted in-game visual direction.
4. Existing reviewed source assets, provenance and license ledger.
5. This directory's production methods and review procedure.
6. External tutorials, generators and tool-specific workflows as non-normative technique references.

Never let a tutorial silently override an audited asset, license restriction, gameplay contract, rig/socket requirement, collision rule, renderer boundary or performance gate.

## Routing

Read only the standards relevant to the task:

| Task | Required standard |
| --- | --- |
| Rinne game construction, default playable character/art direction, KayKit reuse | `KAYKIT_GAME_AXIS.md` |
| Character mesh, face, hair, body, clothing, accessories, Blender character assembly, variant art | `CHARACTER_MODELING.md` |
| Visual polish, model comparison, render/runtime acceptance, before/after evidence | `VISUAL_REVIEW.md` |
| Rig/animation/material/export work that also changes character appearance | both files, plus the applicable `docs/characters/*` contract |
| Pure UI/code work with no 3D appearance or asset impact | these files are not required |

KayKit-first is the current Rinne game-construction axis. Read `KAYKIT_GAME_AXIS.md` for the playable runtime direction and `docs/characters/KAYKIT_FOUNDATION.md` for the current game-facing character foundation; new gameplay character and motion work uses that KayKit family by default. Sendagaya_Shino / MasterCharacter remains a supported compatibility and comparison path, not the default foundation for new game-facing work. When explicitly changing Shino/MasterCharacter, read `docs/characters/MASTER_CHARACTER.md`, `MODULAR_APPEARANCE.md`, and `CHARACTER_STUDIO.md` as applicable before using this standard.

## Core rule

The worker owns the implementation method. The repository owns the target, invariants and acceptance evidence.

A request such as "improve the model" must not be completed by changing only lighting, colors, screenshots or descriptive text when the defect is geometric. A generated image is not evidence that the runtime model improved. A GLB/VRM that exports successfully is not proof that the character looks correct or deforms correctly.

Use real editable assets, preserve already-approved work, and make local changes before broad rewrites. If a requested tool path is unavailable, check another allowed path before declaring the task impossible. Blender MCP is one possible Blender control path, not the definition of Blender availability and not a reason to substitute a primitive mock-up for the requested asset.

## Minimal character refinement loop

For short-term quality improvement while generation quality is still uneven, prefer a small repeatable loop over free-form regeneration:

1. Reuse the current reviewed DCC/source asset as the base when it is compatible; do not restart the whole character by default.
2. Compare the same candidate in fixed `front`, `three-quarter`, `side`, and `back` views.
3. Check the repository's small structural checklist for silhouette/proportion, side profile, joint readability, hands, hair consistency, and back-view identity.
4. Repair only failed regions and preserve regions that already pass.
5. Repeat for at most three refinement rounds. Remaining failures stay explicit instead of being hidden by another camera/light setup.
6. Search external/open-source references only for the unresolved failing part, with provenance/license review before reuse. Replacing the whole model is a fallback, not the first response.

The provider-neutral model build request and Character Workshop QA should expose the same checklist and three-round limit so humans and implementation workers review the same contract. This loop does not grant visual approval or advance Character Production stages by itself.

## External technique reference

Non-normative reference checked 2026-09-13:

- Tripo, "GPT-6 Astra 3D Character Workflow: Rig and Animate from One Image": https://www.tripo3d.ai/blog/gpt-6-astra-3d-character-workflow

Useful ideas adopted here include clear full-character references, optional body/head/hair decomposition, read-only scene verification before edits, preserving approved silhouette/UV/material/rig data, reusing a working armature where possible, testing deformation with explicit poses, checking materials under consistent lighting, and starting animation review with a short readable action. Tripo, Blender MCP and three-part generation are not mandatory repository dependencies.

## Growth rule

Update these standards when a repeated production failure is understood well enough to prevent recurrence. Prefer a small durable rule plus a verification step over a large model-specific prompt. Do not turn temporary session problems into permanent global restrictions.
