# KayKit Game Foundation

## Purpose

輪廻転焦の今後のゲーム構築・キャラクター実装・Visual Reviewは、KayKit Adventurers系を既定のキャラクターファミリーとして進める。`Sendagaya_Shino` は削除せず、既存save/runtime互換と比較・参照に残すが、新規ゲーム機能の設計基準や唯一のMasterCharacterとして扱わない。

この変更はキャラクターの見た目の軸を変更するもので、既存の寿命、遺伝、戦闘、保存、通信契約をKayKit固有データへ結合しない。

## Canonical foundation

- family id: `kaykit.adventurers.v1`
- source repository: `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`
- pinned revision: `672074b73ba276876a19e8816ecdc5241817ab47`
- license: `CC0-1.0`
- shared rig family: `Rig_Medium`
- primary runtime format: GLB/glTF

既定キャストは Knight / Barbarian / Mage / Rogue / Rogue Hooded の5体。各モデルは上記固定revisionの `addons/kaykit_character_pack_adventures/Characters/gltf/` 以下を正本とし、mutableなbranch URLや最新版追従をruntime sourceにしない。

## Development axis

新規のキャラクター・モーション・装備・戦闘演出・成長確認は、原則としてKayKit foundation上で成立させる。共通機能は `KayKit` や `Shino` の名前を前提にせず、character-family / rig adapter / runtime presentationの境界を通す。

- Character Workshopの既定対象はKayKit foundation。
- Visual Reviewのキャラクター基準表示はKayKit foundationを先頭にする。
- ゲームruntimeの新規presentation選択はKayKit familyを既定にする。
- Shino専用のrig/VRM/material処理は互換adapterとして残し、共通APIの名前やゲームロジックへ昇格させない。
- 既存 `character.sendagaya-shino.v1`、save schema、遺伝データはこの移行では変更しない。

## Asset and quality rules

KayKitが既製の高品質アセットであることと、輪廻転焦で `RUNTIME_READY` であることは別。導入時も既存Character Production gateを維持する。

- provenanceとCC0 licenseを記録する。
- upstream revisionとGit blob identityを固定する。
- runtimeへ置く場合は固定revisionからlocalizeし、取得内容をfail-closedで検証する。
- `Rig_Medium` の必須boneを実モデルから解決し、不足時にShino rigへ黙ってfallbackしない。
- front / three-quarter / side / backと既存の局所改善6項目を使う。
- imported meshであってもdeformation / motion / visual approval / runtime performanceを未確認のまま `RUNTIME_READY` としない。

## Shino compatibility

Shinoは「ゲーム全体の軸」から「1キャラクター + 互換参照」へ移す。

- `MASTER_ID = character.sendagaya-shino.v1` は既存データ互換のため維持する。
- Shino VRM、既存hash、license、表情、spring bone契約を破壊しない。
- Shino専用テストは互換テストとして残す。
- 新しい共通API・UI文言・品質gateに `Shino` を既定名として追加しない。

## Migration acceptance

- KayKit foundationがshared packageから1つの正本として取得できる。
- 5モデル・固定revision・CC0・Rig_Mediumがテストで固定される。
- Rinne runtime presentationがKayKitを既定familyとして選ぶ一方、既存Character identity/save schemaは変更されない。
- Character Workshop / Art QAの既定表示からShino専用ブランドを外し、KayKit foundationを先頭にする。
- KayKit asset localizationは固定revision + blob identityを検証し、ネットワークや内容不一致でfail-closedする。
- 既存Visual Approval、Character Production、browser、Integration、Production gateは弱めない。
