# All-model Equipment Review

Growth Review の装備試着は KayKit だけに限定せず、成長ページで選べるすべてのモデルへ同じ操作で適用する。

## Scope

- 既存の固定 KayKit Adventurers GitHub revision から、実在する武器・盾・背負い物・小物モデルを読み込む。
- VRM 系は監査済み humanoid bone、KayKit は Rig_Medium の hand/chest socket を使う。必要 bone が無い slot は fail-closed とし、キャラクター横に浮かせる代替表示をしない。
- model / age / view / equipment state を URL query に保持し、同じレビュー状態を再現できる。
- 装備は review-only presentation。gameplay inventory、所有権、年齢解禁、Production stage、visualApproval は変更しない。
- 既存の 0〜90 歳 timeline と aging curve は変更しない。

## Source / provenance

Primary equipment geometry:

- Repository: `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`
- Revision: `672074b73ba276876a19e8816ecdc5241817ab47`
- License: CC0 1.0 Universal
- Runtime source: `addons/kaykit_character_pack_adventures/Assets/gltf/`

Expanded model/equipment library:

- Repository: `KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0`
- Revision: `15b62b9bad122f72926c10fb14d622c73819fa54`
- License: CC0 1.0 Universal
- Character source: `addons/kaykit_character_pack_skeletons/Characters/gltf/`
- Equipment source: `addons/kaykit_character_pack_skeletons/Assets/gltf/`
- Growth Review adds `Skeleton Warrior / Skeleton Rogue / Skeleton Mage / Skeleton Minion` as real selectable models, not aliases or recolors.
- Equipment picker adds the Skeleton blade / axe / staff / crossbow / four shields / quiver family as distinct real models.

Attachment behavior is cross-checked against the open-source KayKit integration in `levy-street/world-of-claudecraft` at commit `83347159f70103c887768fc0aa0e6aff0d030e8d` (MIT). The original KayKit repositories remain the geometry source.

## Slots

- main hand: one/two-handed swords, one/two-handed axes, dagger, staff, wand, one/two-handed crossbows, Skeleton blade / axe / staff / crossbow
- off hand: round / square / badge / spikes shield variants, Skeleton shield variants and selected held props
- back: quiver plus compatible carried items, including Skeleton quiver

Each slot supports `none`; the page also provides `clear all`.

## Acceptance

- Every model selectable in Growth Review can use the same equipment UI.
- Model picker count increases by at least four real character models from the pinned Skeletons pack.
- Equipment picker exposes at least nine additional real Skeletons-pack equipment models.
- Switching model or age keeps the selected equipment and reattaches it to the new rig without NaN/Infinity transforms.
- Main/off-hand equipment follows the actual hand bone; back equipment follows the torso/chest.
- KayKit models prefer authored native accessory/socket data when present. Other humanoids use anatomical hand calibration based on real hand/finger bones.
- Model/equipment source URLs are pinned to immutable Git commits. No moving `main` URLs are introduced.
- `none` and `clear all` remove equipment deterministically.
- Existing age review, game saves and Production approval state remain untouched.
