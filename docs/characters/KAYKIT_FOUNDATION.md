# KayKit Game Foundation

## Purpose

百年転生のゲーム構築・キャラクター実装・Visual Reviewは、KayKit Adventurers系を既定の外部キャラクターファミリーとして進める。商用利用にモデル固有の条件が残る第三者キャラクターモデルはactive runtime / review candidate / Production配布から退役させる。詳細は `docs/characters/CHARACTER_LICENSE_POLICY.md` を正本とする。

この変更はキャラクター資産の採用基準を変更するもので、既存の寿命、遺伝、戦闘、保存、通信契約をKayKit固有データへ結合しない。

## Canonical foundation

- family id: `kaykit.adventurers.v1`
- source repository: `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`
- pinned revision: `672074b73ba276876a19e8816ecdc5241817ab47`
- license: `CC0-1.0`
- shared rig family: `Rig_Medium`
- primary runtime format: GLB/glTF

既定キャストは Knight / Barbarian / Mage / Rogue / Rogue Hooded の5体。各モデルは上記固定revisionの `addons/kaykit_character_pack_adventures/Characters/gltf/` 以下を正本とし、mutableなbranch URLや最新版追従をruntime sourceにしない。

## Development axis

新規のキャラクター・モーション・装備・戦闘演出・成長確認は、原則としてKayKit foundationまたは完全なRINNE-owned asset上で成立させる。共通機能は特定モデル名を前提にせず、character-family / rig adapter / runtime presentationの境界を通す。

- Character Workshopの新規build requestはKayKit `Rig_Medium` / GLBを既定にする。
- Visual Reviewのactive candidateはCC0またはRINNE-ownedに限定する。
- ゲームruntimeの新規presentation選択はKayKit familyを既定にする。
- 条件付き第三者モデルのrig / VRM / material処理を新しいfallbackとして追加しない。
- 既存save schema、遺伝データ、ゲームルールはこの資産退役では変更しない。

## Asset and quality rules

KayKitが既製の高品質アセットであることと、百年転生で `RUNTIME_READY` であることは別。導入時も既存Character Production gateを維持する。

- provenanceとCC0 licenseを記録する。
- upstream revisionとGit blob identityを固定する。
- runtimeへ置く場合は固定revisionからlocalizeし、取得内容をfail-closedで検証する。
- `Rig_Medium` は共有rig family / 互換識別子であり、glTF scene nodeの文字列が必ず `Rig_Medium` であることを要求しない。固定revisionの実モデル階層から必須boneを解決する。
- 必須bone不足時に条件付き第三者rigへ黙ってfallbackしない。
- front / three-quarter / side / backと既存の局所改善6項目を使う。
- imported meshであってもdeformation / motion / visual approval / runtime performanceを未確認のまま `RUNTIME_READY` としない。
- `license` gateを通過しないcandidateは、他の品質gateが全passでもdistribution manifestを生成できない。

## Retired conditional assets

次の系統はactive character assetとして使用しない。

- VRoid AvatarSample A / B / C
- Sendagaya_Shino review / reference runtime assets
- つくよみちゃん Type A review asset
- Sendagaya_Shino carrier rigを保持したままのDCC runtime output

第三者reviewモデル本体はcurrent treeから削除する。RINNE-authored surfaceのBlender sourceは再リグ移行のため保持できるが、旧carrier rig依存を除去しprovenanceを更新するまでProduction対象外とする。

`MASTER_ID = character.sendagaya-shino.v1` などの旧ID/schema定義は、過去データの読取やmigration compatibilityに必要な範囲だけ残せる。これはactive model採用を意味しない。

## Migration acceptance

- KayKit foundationがshared packageから1つの正本として取得できる。
- 5モデル・固定revision・CC0・Rig_Mediumがテストで固定される。
- 固定revisionの実GLBと同じくscene root名が `Rig_Medium` でなくても、必須boneが揃うKayKit rigをruntime adapterが解決できる。
- active character catalogは条件付き第三者モデルを含まない。
- 新規model build requestはKayKit fallback / `Rig_Medium` / GLBを使用する。
- 条件付き第三者モデルまたは旧carrier rigを含むcandidateはProduction distributionを拒否される。
- KayKit asset localizationは固定revision + blob identityを検証し、ネットワークや内容不一致でfail-closedする。
- 既存Visual Approval、Character Production、browser、Integration、Production gateは弱めない。
