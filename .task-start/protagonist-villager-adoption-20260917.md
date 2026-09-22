# Adopt the approved KayKit-derived protagonist candidate

Use the existing `protagonist.villager.v1` DCC output from PR #584 as the Rinne playable hero runtime model.

Acceptance:

- carry forward the clean KayKit `Rig_Medium` version of the GLB, editable Blender source, integrity receipt and fixed-view QA evidence;
- connect only the playable Rinne hero to `PROTAGONIST_VILLAGER_V1.glb`; keep mother, peers, guards and enemies on the existing KayKit family unless their current contract says otherwise;
- preserve gameplay, equipment attachments, carry presentation, motion authority, collision/save/network behavior;
- verify the runtime asset exact SHA-256 / byte length before parsing;
- keep Character Production status truthful (`visualApproval=pending`, `productionReady=false`) and do not weaken gates;
- do not modify `main` / Production.
