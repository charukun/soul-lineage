# Character DCC Carrier

## Purpose

Character DCC Carrier is the repository-wide execution path for repeatable Blender character builds. A future implementation session should not have to rediscover whether Blender is available or rebuild a one-off Actions workflow for every character.

The carrier standardizes execution, audit, evidence, hashing and generated-file handoff. Character-specific modeling remains in a dedicated Blender builder so visual identity and authored form are not reduced to a generic procedural template.

## Request branch contract

A carrier build starts from current `develop` on a short-lived branch named `dcc/<slug>`.

The branch contains `.dcc/character-dcc-request.json` plus the character-specific Blender builder referenced by that file. The request is repository data and must not contain secrets or external credentials.

Required request fields:

- `schema`: `character-dcc-request`
- `version`: `1`
- `id`: stable character candidate id
- `assetId`: stable asset id
- `reference.path`, exact `reference.sha256`, and the actually available `reference.views`
- `rig.path`, exact `rig.sha256`, and logical `rig.id`
- `builder`: repository-relative Blender Python script
- `generatedDir`: repository-relative temporary output root under `generated/`
- `blendName`, `modelName`, `format`, and runtime `publicPath`
- `canonical.blend`, `canonical.model`, `canonical.integrity`, `canonical.production`, `canonical.qaDir`
- `license.rigProvenance` and `license.surfaceAuthorship`
- `primary.separateSurfaces`, `primary.minMeshObjects`, `primary.minMaterials`
- `production.stage`, which may only be `REFERENCE`, `BLOCKOUT`, or `PRIMARY`
- explicit `review` evidence used for any requested stage promotion

All paths must be repository-relative, normalized, and remain inside the repository. Absolute paths and `..` traversal are rejected. Canonical outputs cannot target `generated/`, `.github/`, or `.dcc/`.

## Builder contract

The carrier invokes the builder through Blender headless with:

```text
blender --background --python <builder> -- \
  --source <copied rig GLB> \
  --source-vrm <rig path> \
  --out <generatedDir>
```

The builder owns character-specific geometry and must produce:

- `<generatedDir>/source/<blendName>`
- `<generatedDir>/export/<modelName>`
- `<generatedDir>/review/front.png`
- `<generatedDir>/review/three-quarter.png`
- `<generatedDir>/review/side.png`
- `<generatedDir>/review/back.png`
- `<generatedDir>/build.json`, with `characterId` equal to the request id

The final exported model must already contain the runtime metadata required by that model contract. A builder may call repository post-processing helpers internally, but the carrier does not guess character-specific VRM/GLB semantics.

A builder may use additional authored passes, but the carrier does not substitute primitive/runtime-procedural geometry when a DCC result was requested.

## Carrier execution

The repository-owned `Character DCC Carrier` workflow runs only for `dcc/**` branches. It:

1. validates the request and exact reference/rig hashes before installing Blender;
2. installs the repository-approved headless Blender runtime and records the actual Blender version;
3. runs the character builder for real;
4. runs `scripts/blender/character-production-audit.py` against the generated `.blend`;
5. requires the four fixed review views and non-empty editable/runtime artifacts;
6. copies only canonical outputs into their requested repository paths;
7. creates exact integrity and Character Production manifests from the request plus objective audit;
8. runs the repository Character Production checker, carrier contract tests, and `git diff --check`;
9. verifies the request did not change while Blender was running;
10. commits generated canonical assets back to the same `dcc/**` branch;
11. records `character-dcc/build` on the generated exact head.

The generated commit is made by the Actions token. GitHub does not recursively start another push workflow from a push performed with the repository `GITHUB_TOKEN`, preventing a build loop. A later implementation session resumes from the branch/head recorded in GitHub rather than repeating the DCC build.

## Production truth

The carrier can establish at most `PRIMARY / dcc-blender`. It always records `productionReady=false` and `visualApproval=pending`.

Stage promotion is fail-closed:

- `REFERENCE` requires locked identity/reference evidence and is the safe default for a first unattended DCC generation.
- `BLOCKOUT` additionally requires explicit `proportionsReviewed=true` and `silhouetteReviewed=true`.
- `PRIMARY` additionally requires explicit `topologyReviewed=true`; UV evidence comes from the Blender audit and `primary.separateSurfaces` must include skin, hair and clothing.

The carrier does not infer those review decisions merely because PNGs or an export exist. A first build can therefore stay at `REFERENCE`, expose the four fixed views, and be promoted by a later reviewed request without pretending that automation visually approved the asset.

It does not claim DEFORMATION, MOTION, POLISH, RUNTIME_READY, device performance or human visual approval from export/audit success. Those remain separate Character Production gates.

Visible review props do not grant gameplay inventory/combat ownership.

## Future-session procedure

For a new character modeling request, a future Chat/WORK should:

1. start from latest `develop`, read `AGENTS.md`, this document, the applicable character contract and art standards;
2. create a short-lived `dcc/<slug>` branch;
3. add the character-specific Blender builder and `.dcc/character-dcc-request.json` using `docs/characters/dcc-request.example.json`;
4. push the branch through normal git, the connected GitHub API, or the already-authorized Codespaces fallback;
5. perform one bounded post-push state read. Do not wait/poll the run;
6. on a later interaction, recover from the current branch/head and `character-dcc/build` status. If successful, inspect the committed fixed views and continue refinement/promotion from that exact generated head.

Do not route ordinary DCC generation through RINNE Dispatch merely to obtain Blender. The carrier is the dedicated execution route and does not require `DISPATCH_GITHUB_TOKEN` or `RESCUE_GITHUB_TOKEN`.

## Visual Review Lab handoff

The carrier does not modify `work/visual-review-lab-v2` automatically. After a successful generated head exists, an explicitly requested Lab task may copy the exact model into the long-lived Draft Lab and register it as a distinct comparison candidate with exact bytes/hash validation.

This keeps DCC generation reusable while preventing concurrent Lab work from being overwritten.

## Recovery

If the normal work environment cannot run Blender locally, the `dcc/**` push is the normal repository execution route. If transport itself fails, the standing delivery authorization permits switching the same branch through the connected GitHub API or repository Codespaces plus normal git without asking again.

A carrier failure remains on the same `dcc/**` branch with the exact workflow URL/status and retained review/debug artifact where available. Fix that branch and push a new request/builder head; do not create a second competing DCC task for the same candidate.

Never weaken the production audit, reference hash check, generated-file checks, or Integration gates to make a carrier run pass.
