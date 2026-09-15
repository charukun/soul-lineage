# First-build validation, 2026-09-12

The implementation adds legal placement candidates, an explicit confirmation label, actual bed-capacity feedback and 44px auxiliary targets. It does not grant access to NPC houses or unlock undiscovered furniture.

PR98 native browser evidence already confirms tent selection, candidate preview without creating an object, successful construction and exactly two additional beds (run34689168763). The earlier interior fixture incorrectly selected a locked bed; its correction then exposed that NPC homes are intentionally not player-editable (run34689478820). These are not reasons to relax furniture or ownership rules.

The final acceptance path uses native input to construct the tent, then selects the existing editable storehouse mesh using read-only scene projection and places the unlocked dirt bed. It reloads the app and asserts exact persistence of both the tent and storehouse furniture. No world, inventory, save or progress injection is used.

Normal git merged develop c9434ffe0f56543058fda7163bc86901b75eda16 into this branch. The proof-producing action also connected the existing strict playback-evidence collector immediately before reload, preserving evidence across page navigation rather than ignoring media failures. Refreshed head before this documentation commit: c8223d51da80fd5b744c2eca02d6e5d12d7a0449.

Local placement unit checks: 8 passed. Prior complete Village tests/build: passed. The final native path and deployed DEV result require successful current-head Actions evidence; this document does not claim them before they run.

The broader interior UI inconsistency, resident cameras and facility art remain separate PR90 work. main and Production are unchanged.
