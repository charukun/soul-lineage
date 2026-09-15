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
- `reference.path` and exact `reference.sha256`
- `rig.path`, exact `rig.sha256`, and logical `rig.id`
- `builder`: repository-relative Blender Python script
- `generatedDir`: repository-relative temporary output root
- `blendName` and `modelName`
- `canonical.blend`, `canonical.model`, `canonical.integrity`, `canonical.production`, `canonical.qaDir`
- `license.rigProvenance` and `license.surfaceAuthorship`
- `primary.separateSurfaces`, `primary.minMeshObjects`, `primary.minMaterials`

All paths must be repository-relative, normalized, and remain inside the repository. Absolute paths and `..` traversal are rejected.

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
- `<generatedDir>/build.json`

A builder may use additional authored passes, but the carrier does not substitute primitive/runtime-procedural geometry when a DCC result was requested.

## Carrier execution

The repository-owned `Character DCC Carrier` workflow runs only for `dcc/**` branches. It:

1. validates the request and exact reference/rig hashes;
2. installs the repository-approved headless Blender runtime and records the actual Blender version;
3. runs the character builder for real;
4. runs `scripts/blender/character-production-audit.py` against the generated `.blend`;
5. requires the four fixed review views and non-empty editable/runtime artifacts;
6. creates exact integrity and Character Production manifests from the request plus objective audit;
7. runs the repository Character Production checker and carrier contract tests;
8. copies only canonical outputs into their requested repository paths;
9. commits generated canonical assets back to the same `dcc/**` branch;
10. records `character-dcc/build` on the generated exact head.

The generated commit is made by the Actions token. GitHub does not recursively start a new push workflow from that token, preventing a build loop. A later implementation session resumes from the branch/head recorded in GitHub rather than repeating the DCC build.

## Production truth

The carrier can establish at most `PRIMARY / dcc-blender` from this build path. It always records `productionReady=false` and `visualApproval=pending`.

It does not claim DEFORMATION, MOTION, POLISH, RUNTIME_READY, device performance or human visual approval from export/audit success. Those remain separate Character Production gates.

Visible review props do not grant gameplay inventory/combat ownership.

## Visual Review Lab handoff

The carrier does not modify `work/visual-review-lab-v2` automatically. After a successful generated head exists, an explicitly requested Lab task may copy the exact model into the long-lived Draft Lab and register it as a distinct comparison candidate with exact bytes/hash validation.

This keeps DCC generation reusable while preventing concurrent Lab work from being overwritten.

## Recovery

Carrier execution does not depend on `DISPATCH_GITHUB_TOKEN` or `RESCUE_GITHUB_TOKEN`. If the normal work environment cannot run Blender locally, the `dcc/**` push is the normal repository execution route. If transport itself fails, the standing delivery authorization permits switching the same branch through the connected GitHub API or repository Codespaces plus normal git without asking again.

Never weaken the production audit, reference hash check, generated-file checks, or Integration gates to make a carrier run pass.
