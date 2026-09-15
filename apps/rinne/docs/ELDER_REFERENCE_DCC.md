# Elderly Man — one-character DCC modeling trial

User scope: build one character from the existing reference library and make it
selectable in the independent Visual Review Lab. The source is
`docs/characters/references/npc-role-set/elderly-man.avif` (front, side, back and
face details). The sheet is a compact preview; fine stitching and hidden garment
construction are authoring interpretations, not exact source detail.

Preserve the receding gray hair, kind elderly face, olive shoulder wrap, brown
scarf, cream tunic, cropped dark trousers, socks, boots and belt pouch. Retain
editable Blender meshes and the common humanoid bone naming/provenance. Export
an actual rigged VRM with separate skin, hair, clothing and accessory surfaces.

This is a new selectable DCC candidate, `model.ELDER_DCC`, distinct from the
retired procedural `elderly-man.reference.v1`. It does not replace any accepted
model or change gameplay, source motions, develop or main. PR #23 stays Draft
under the independent Lab contract. No artistic approval or runtime-ready
classification is implied by authoring, export, tests or Lab publication.

Acceptance: inspect front/three-quarter/side/back/face, inspect relevant bend
poses, load the delivered file through the actual Lab, and retain source hash,
asset hash and observation evidence. Publish one completed batch through the
existing `work/visual-review-lab-v2` workflow.

## Delivered candidate and evidence

- Stage: PRIMARY / 大形状の試作, `productionReady=false`; explicit visual approval pending.
- Blender 4.3.2 source: `assets/characters/elderly-man/dcc-v1/ElderlyMan.blend`.
- Original surfaces: 163 editable mesh components, 54 humanoid bones, 80,151 source triangles, 16 exported material batches.
- Runtime asset: `ELDER_REFERENCE_V1.vrm`, 2,679,924 bytes; exact SHA-256 is in `packages/assets/src/elder-reference.js` and `docs/characters/qa/elderly-man-dcc/build.json`.
- Reference: repository elder sheet, SHA-256 `b5ac7b782b32eaa390c3e3df6816ffdb7e7907b5621da9011beb68fa39c93280`. No Shino render geometry is reused; semantic bone names and retained VRM metadata/provenance are inherited.
- DCC audit: one armature, UVs on every mesh, applied transforms, no degenerate polygons. Parametric UVs are local to each surface; they are not a packed painted texture atlas.
- Actual Chromium/WebGL2 Lab observation: real picker round trip, four directions each for relaxed idle, walk, run and slash; 16 captures and zero asset/page errors. See `docs/characters/qa/elderly-man-dcc/lab-contact.png` and `lab-observation.json`. These are inspected still poses, not an artistic motion approval or a claim of observed full-speed playback.

## Integration corrections

The Lab's shared runtime bake must read the selected candidate before the generic SHINO cache: copying raw Shino rotations to this Blender rig lifted its legs into its face. The selected mesh now supplies its own rest axes and proportions. The bake caller also supplies the existing sword dimensions required by locomotion generation. No authored motion source or timing is changed. A small normal shadow bias removes self-shadow bands on smooth DCC surfaces while retaining cast/received shadows.

## Remaining work

This is the requested single modeling trial. The sheet's receding hairline and cloth finish need further art refinement. The face is a static gentle smile; no expression morphs, cloth/hair secondary motion, complete collision/deformation pass, eight-direction Motion QA or physical-device performance certification is claimed. Aggressive leg bends can intersect the rigid tunic hem, so DEFORMATION and later stages remain unapproved. Cane/equipment integration is outside this trial.

Use the Lab model picker: **老人男性（リファレンス造形）**. Existing entries remain available for comparison. The stage manifest is `packages/characters/production/elderly-man-dcc.production.json`.
