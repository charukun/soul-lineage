# Sendagaya_Shino MasterCharacter — production contract v1

## Status and integration boundary

This is a reviewable shared foundation, **not approval to start unrestricted character production**. The implementation base is `69ea1f714e6c07bea079884ab7ebc0088f0feaa9` on `charukun/soul-lineage/develop` (checked 2026-09-11). At this SHA `apps/rinne` and `apps/village` remain foundation previews; the character catalog is empty; the real-time transport and Host Migration coordinator are not connected. Do not substitute an old Library game for this develop, claim a local replica is a live multiplayer service, or silently change the existing games.

The Lifecycle Library package was read as a compatibility reference only. Its sources, runtime, dependencies and entrypoints were **not imported wholesale**. Apps, input, combat, collider rules, title routing, main, Production and CI/deployment automation are unchanged. The new renderer is opt-in. `createWorldPreview` is preserved.

## Decisions

| Concern | Contract | Implemented limit |
| --- | --- | --- |
| Identity | Stable `id`, `masterId`, content/schema version, revision; a new life gets a new ID. | No player authentication/entitlement service. |
| Age | Integer world milliseconds; 60,000 ms/year, capped at 90; world delta is scaled once by the existing world clock. Pausing passes `running=false`. | No replacement game clock, duplicate multiplier, wall-clock ageing or automatic save overwrite. |
| Growth | Match Lifecycle's 0–90 scale curve; child head ratio, gradual gray hair and stoop. | Not an authored child/elder topology or a face-wrinkle texture set. |
| Equipment | Proposed visual policy: weapons from age 7, hidden on death. Adapter receives `canEquipWeapon`; existing gameplay owns actual eligibility. | This module never grants/removes game inventory or changes hitboxes. Reconcile the flag with the integrated game rather than overriding it. |
| Body | Adult reference height 2.02 game metres; individual height 0.90–1.10, width 0.88–1.12. | Conservative presentation variation, not arbitrary bone-length surgery. |
| Lineage | Two unsigned-16-bit alleles for each of height/build/hair/eyes/skin; one from each distinct parent with bounded 1% variation. | Visual genes only. Relationships, lawful parent selection and combat stats remain game-owned. |
| Wardrobe | Approved complete-outfit IDs and shared rig ID. Original/Moss/Ember are three uniform **colorways**. | Source has no guaranteed complete body under clothing. New garment geometry, skinning, body masks and clipping approval remain required. Never hide source clothing and call exposed holes a costume swap. |
| Network | Authenticated transport supplies sender ID separately; current host+epoch, session/content/protocol version, monotonic sequence/world clock; full snapshot and baseline-checked delta. | Authority election, heartbeat, transport, encryption, position/NPC/world sync and the darkness effect are not implemented here. |
| Migration | Trusted coordinator installs a strictly newer host epoch, pauses replica, retains committed age/lineage rollback floor. Old host/replayed packets reject. | Coordinator must restore the entire authoritative world under darkness before resuming. Received packets must never appoint their own host. |
| Crowd | Maximum 30 active pooled actors; geometry/textures shared, raw bones/morph weights/material uniforms independent. Up to six important/near poses at 60 Hz; other poses at 15/5 Hz; hidden pose update off. | This is animation update LOD, **not geometry LOD or instanced skinned rendering**. Never throttle world simulation with this policy. |
| Weapons | Socket position/rotation follow the hand, but weapon mesh is outside non-uniform body scale; caller retains ownership. | Each actual weapon still needs its own grip calibration and visual motion review. |
| Ownership | Pool owns clones/materials/skeleton resources. Loader owns source geometry/textures. Caller owns weapons. | Despawn before reuse; do not use a released handle; dispose the loader-owned source only after every pool is disposed. |

`CharacterReplica` validates changes against currently resident records. Persistent lineage/removed-character history must be validated by the authoritative world store; a replica is not an anti-cheat server. `makeCharacterSnapshot` is a serializer, not an authentication method. Resync all peers from the same persisted alleles, not from platform-dependent floating-point random calls. Birth/age mutation is host-only. New content revisions require a reviewed manifest/code update on all peers.

## Source and license ledger

Master ID: `character.sendagaya-shino.v1`; rig ID: `humanoid.shino-vrm1.v2`; content: `shino-production-contract.1`.

Original: VRoid Project / pixiv Inc., CC0. Conversion: Coatie (`coati`), VRM 1.0 v2.0. The conversion publisher also describes the model as CC0; the actual file carries VRM Public License 1.0 metadata. Preserve both the provenance and those embedded settings rather than substituting the repository's software license.

Primary sources checked 2026-09-11:
- Original terms: https://vroid.pixiv.help/hc/en-us/articles/360013482714-Sendagaya-Shino
- Conversion and settings: https://hub.vroid.com/en/characters/4593660874193246717/models/7956589129305596116
- Embedded license text: https://vrm.dev/licenses/1.0/
- Distribution provenance: https://github.com/yw0nam/YUI/blob/9bce6c36d28f58693db3ce6f4203871ab1c11b76/resources/vrms/Sendagaya_Shino.PROVENANCE.md
- Official clone contract: https://threejs.org/docs/pages/module-SkeletonUtils.html

Pinned upstream: `yw0nam/YUI@9bce6c36d28f58693db3ce6f4203871ab1c11b76`, `resources/vrms/Sendagaya_Shino.vrm`.

| Input | SHA-256 |
| --- | --- |
| Upstream | `fab70124f0025e444a6eef84d6ab3a04e78c0adb626099e54b55287d0f083a47` |
| Existing reviewed Library derivative | `83843ade7dbdfaacc9d601bda099fcb5757527e339b9c5deb223a2c2f5eb28ca` |

The reviewed derivative retains model topology and metadata and has a reduced thumbnail. Its bytes were audited locally: 18,541,124 bytes, 37,097 triangles, 16 primitives/materials, 54 humanoid mappings. The source contains no animation clips. This is not a mesh simplified for crowds. Approval requires both a known source hash and compatible embedded metadata; unknown hashes/external image or buffer references fail closed. A new derivative requires a new reviewed hash and source chain. Preserve notices and metadata in exports; no pixiv/Coatie endorsement is implied.

## Reproduce import and review

Use the repository's Node 24 / npm lockfile, not the local fallback environment noted below.

```sh
npm ci
mkdir -p generated
node scripts/prepare-master-character.mjs --fetch --out generated/shino
# Or use the audited existing local VRM instead of --fetch:
# node scripts/prepare-master-character.mjs --source /path/to/SHINO_review.vrm --out generated/shino
node scripts/check-master-character-asset.mjs generated/shino/master.vrm
node --test packages/characters/tests/*.test.mjs packages/rendering/tests/*.test.mjs tests/master-character-import.test.mjs
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/examples/master-character-review.html?asset=/generated/shino/master.vrm` or select the model with the file picker. The import command creates one unchanged shared VRM, 30 deterministic individual records, an audit report and a license notice; it refuses existing output directories and unapproved inputs. Generated files are review artifacts, not an automatic deployment. Do not commit them unintentionally.

The review exposes 1/30 actors, mixed/fixed age, three uniform colorways, simple diagnostic poses, rotation, counts and measured frame times. It uses ordinary glTF PBR fallback materials, **not a verified replacement for the existing MToon/VRM expression/spring-bone pipeline**. `skinAge` is reserved data; no wrinkle shader is claimed. The included breathing pose is diagnostic, not a new gameplay animation.

Raw-bone clips can be assigned with `setClip`. Do not share an `AnimationMixer`, VRM humanoid controller, spring-bone manager, mutable material, or morph weight array across individuals. A normalized VRM animation controller requires one per-actor bridge into raw bones. The source glTF loader and `shinoHumanoidFromGLTF` are separate from portable character data.

## Evidence and remaining gates

Local tests: **27 passed, 0 failed**, Node 22.16.0 with the Library's Three 0.185.1 vendor modules. These are supplemental checks, not a claim that `npm ci` or the Node 24 / Three 0.186.0 repository gate ran locally. See `VERIFICATION.json`. Fast CI discovers character/rendering tests in their respective workspaces; import CLI tests are infrastructure tests.

Actual audited model CPU test: 30 clones, 6 sampled ages (0/7/22/55/85/90), 54 humanoid mappings, 16 shared geometries, 480 actor-owned materials; independent bone changes and preservation of source resources on pool disposal passed. Texture objects were deliberately stubbed to avoid browser APIs; texture decoding, GPU rendering, shader compilation, actual posed visual bounds and FPS are **not** validated by this test.

A real Chromium attempt to open the local review failed before page execution with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. No successful browser screenshot or visual acceptance is claimed. Do not bypass that environment control. This review must be run in an authorized development/browser environment.

Before clearing `integration:hold` / starting production:
1. Connect this opt-in adapter to the integrated current Tidebreak lifecycle, animation, inventory and save code; verify its existing controls, title flow and combat. Do not replace current apps with the Library handoff.
2. Complete and visually approve actual clothing geometry at body/age extremes, plus MToon/expressions/spring-bone and weapon/clip integration. Colorways alone do not satisfy full garment production.
3. Connect authenticated host/transport and test two real peers, late join, disconnect, migration, failed migration and full-world resync under darkness.
4. Run actual model browser validation on the pinned repository dependencies, followed by 30 visible actors in representative scenes on desktop and Pixel Fold-class hardware. Target p95 frame time <=16.67 ms desktop / <=33.34 ms mobile after warmup; record viewport, DPR, device/browser/GPU, asset/build hashes, duration, draw calls, texture memory, and thermal conditions. Require geometry/texture LOD or atlas work where measurements demand it. Software rendering is not device acceptance.

A green fast check, Ready PR, import audit or a synthetic 30-clone test must not be relabeled as completing these gates. Keep main and Production unchanged; merge and final DEV verification belong to Integration.
