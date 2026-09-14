# Visual Review Lab runtime reference picker

The `work/visual-review-lab-v2` preview exposes the runtime reference characters directly from the existing character picker.

Selectable runtime references: Shino Reference v2, Child Boy, Child Girl, Elderly Man, Elderly Woman, Guard, Knight, Blacksmith, Laborer, Hunter, and Arcanist.

Each runtime reference loads the audited Shino humanoid source for the common motion skeleton, hides the source render meshes, and attaches reference-specific procedural body, hair, clothing, armor, footwear, and prop geometry. This keeps the existing motion, stance, expression, camera, weapon, and Motion QA path available while the reference-specific silhouette is reviewed.

The legacy SHINO variants and A/B/C/TSUKU review assets remain available in the same picker. This Lab branch stays Draft and publishes only to the dedicated `rinne-visual-review` Worker preview.
