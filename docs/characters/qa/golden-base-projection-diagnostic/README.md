# Golden Base pixel projection diagnostic (rejected geometry)

Hosted exact-head run: https://github.com/charukun/soul-lineage/actions/runs/35835240743
Artifact: 10738628512. Source head: e1dbc7af692bf54570134ce3f0317e05eb84401b.
Pinned upstream camera fit and de-light/PBR descriptors feed the RINNE Three.js pixel/UV bake transport.
These screenshots isolate head and gray suit torso on the rejected blockout. The face, eyebrows,
eyes, mouth and clothing originate in the observed source images; only accepted visibility/mask
samples count as observed. Projected texels are not unique source-image pixels.

The reference geometry and source coordinates do not yet align: eyes spill over face boundary,
forehead and cheeks have holes, side suit has gray contamination, and back has a missing patch.
The rest of the body was hidden for diagnosis. This is not a completed or accepted character.
Current upstream silhouette quality gate still fails (Front .4899, Side .4746, Back .564;
threshold .85). No pass was accepted by this diagnostic. Next repair is landmark-to-generated-
mesh reprojection and per-part source pixel alignment before a fresh bake and visual review.
