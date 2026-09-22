# Quaternius character intake — 2026-09-22

Status: nine selected CC0 characters materialized and immutable-browser reviewed on exact head 0a7701a9ec7349bb645d52dceda71682417e5fb7. Runtime/Production approval remains false; final reconciled-head validation is recorded by the PR validation status.

Base inspected: `c696c681a9f1699118ae36124c0fb9614f41351b` (develop).
Work branch: `assets/rinne-quaternius-characters-20260922`. PR: #1424.

## Source evidence

| Pack | Official page | Official folder | Included license |
| --- | --- | --- | --- |
| RPG Characters | https://quaternius.com/packs/rpgcharacters.html | https://drive.google.com/drive/folders/1MIRQXLfTd21HMI5rwOb6Xy0rv0xv1m8b | https://drive.google.com/file/d/1dc19T9_fxiy7jscseYp0lP2IhRi-e2b6/view |
| Ultimate Modular Women | https://quaternius.com/packs/ultimatemodularwomen.html | https://drive.google.com/drive/folders/1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf | https://drive.google.com/file/d/1lIFL16xEpoPbr0j_HUATgmcEnAmYoIK2/view |
| Ultimate Modular Men | https://quaternius.com/packs/ultimatemodularcharacters.html | https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX | https://drive.google.com/file/d/1TTvylHa1CsiJuHFWWiv6PFGhLM-aAH5z/view |

Each individual page and included License.txt declares CC0 1.0 Universal. No author-wide blanket license inference was used. The newer Quaternius Asset License is not substituted for these pack-specific CC0 declarations. Women License.txt has a mismatched `Ultimate Modular Males` header; preserve this fact and the original text rather than silently correcting the source. Women's official product page and official release post independently declare CC0. Do not infer that any other QAL pack is cleared.

These official folders distribute individual files, not a published original ZIP. Upstream archive hash/byteLength are therefore not applicable. Per-file original hashes must pin acquisition. Any locally constructed preservation ZIP must be labeled as a local snapshot, not an author release. No upstream version number or commit is published for the Drive files.

Source discovery artifact: https://github.com/charukun/soul-lineage/actions/runs/35686926856 ; `quaternius-intake-e943a2590d9ff301c951be9e4e2d5ad4bccd7340`. This run discovered filenames only, did not obtain model archives, and is NOT asset or browser validation.

## Original bytes obtained through the connected Drive file reader

| Original | Bytes | SHA-256 | Git blob SHA-1 |
| --- | ---: | --- | --- |
| Women / Individual Characters/glTF/Medieval.gltf | 3206051 | 32c3cd6d4e59bd1f433bc5eeca788b1430399ef15dfd2e0fb4a038a967c0c293 | 96d7374e8dc248f59842df3ba632b98c10e40e8f |
| RPG / glTF/Cleric.gltf | 2985183 | 6497456a3fa1c151d7a6ab4f7b4c343ee416c23d9454505b950c93ea558e4601 | dff96b9a1b40c930adb1a28139c4582003acdc98 |

The original Medieval bytes match the corresponding file in `agentkaerf/FreeModels@db3df04d1e4714298a09510b26fb6de6645138a2`. The original Cleric bytes match `euuuuuuan/cairnfall-public@8ee4cfd789282c59632a9339e61564b7d6c1acfe/assets/vendor/quaternius_rpg/Cleric.gltf`. These are acquisition mirrors, not authors. Mirrors must never become runtime/build asset origins. This evidence applies only to the files actually compared, not every file in either repository.

Medieval measured from actual glTF: 7276 triangles, 5 meshes, 10 materials, 1 skin, 62 unique joints, 24 embedded clips, no external dependencies. Cleric: 1 skin, 32 unique joints, 11 embedded clips, no external dependencies. This is structural inspection, not a render/deformation pass, and does not establish KayKit Rig_Medium compatibility.

## Art-direction selection (before model render review)

RPG Characters: inspect all six unique characters: Cleric, Monk, Ranger, Rogue, Warrior, Wizard. Alternate formats, textures and recolors do not count as additional people.

Women: prioritize Medieval and Witch. Exclude Casual, Formal, Punk, SciFi, Soldier, Suit, Worker and Adventurer from the usable list: the author's preview shows modern casual/business/cocktail/workwear, tactical/SF equipment or modern safari clothing. No modern pack is converted to medieval merely by renaming it.

Men: prioritize King. The original preview shows modern overalls for Farmer and modern outdoor/safari clothing for Adventurer; do not count these as medieval peasants or adventurers without a separate authored edit and visual acceptance. Exclude Beach, Casual_2, Casual_Hoodie, Punk, Spacesuit, Suit, Swat and Worker as modern/SF or insufficiently clothed.

No protagonist, game NPC, combat, growth, age, equipment, or input contract changes are authorized by this intake. Native rigs/clips remain separate from KayKit. Review availability and productionReady are different approvals.

## Browser evidence closeout

Exact-head immutable browser review succeeded in GitHub Actions run 35716819930. The run built RINNE and the self-owned Asset Origin, published an immutable Cloudflare Worker version preview, loaded all nine models from the self-owned origin, exercised native idle / locomotion / combat clips, checked the comparison stage and mobile emulation, and completed without browser/network assertion failures. This is browser emulation, not Pixel Fold hardware validation.
