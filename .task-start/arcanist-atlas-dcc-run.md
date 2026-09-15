# Arcanist Atlas DCC execution

Bootstrap source: `develop` `2fc4948049a58ed81a7e5bdf9d0d1c836d812525`.

Scope: actually execute a Blender-authored Arcanist DCC build from `docs/characters/references/npc-role-set/arcanist.avif`, preserving the existing `ARCANIST_ATLAS_STUDY` comparison model and avoiding overlap with the separate Astra/MAX worker.

Recovery context: PR #424 (`feat/arcanist-atlas-dcc`) contains an earlier unexecuted builder/workflow attempt that may be inspected and selectively reused, but current develop and repository contracts are authoritative. Completion requires real Blender execution and committed generated evidence, not another workflow-only implementation.
