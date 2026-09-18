# KayKit-first game axis

輪廻転焦のゲーム構築は、モデル固有の商用利用条件を抱えた第三者キャラクターを中心にせず、出典固定済みのCC0 KayKit系資産と完全なRINNE-owned資産を主要な実プレイ候補として進める。ライセンス採用基準の正本は `docs/characters/CHARACTER_LICENSE_POLICY.md`。

## 方針

- ゲーム体験の検証は `生活 -> 技 -> 装備 -> 遠征 -> 戦闘 -> 帰還` のループを優先する。
- キャラクターの主要な実プレイ/レビュー候補は KayKit Adventurers の Knight / Barbarian / Mage / Rogue / Rogue Hooded と、条件を満たすRINNE-owned assetを使う。
- VRoid A/B/C、Sendagaya_Shino review/reference、つくよみちゃん Type Aなど、モデル固有の商用利用条件が残る第三者キャラクターはactive runtime / review candidate / Production distributionから退役させる。
- Sendagaya_Shino carrier rigを保持したDCC outputも、CC0またはRINNE-owned rigへ再リグするまでProduction候補にしない。
- 共通リグ、Motion QA、Character Workshop、Visual Review、Character Production、refinement loopはキャラクター非依存の共有基盤として扱う。
- KayKit由来の武器・盾・背中装備・小物は、既存のprovenance/license/asset-hash境界を守ってゲーム体験の構築に再利用する。Reviewでの試着がgameplay ownershipを自動的に与えることはない。
- 外部のmoving URLをruntime正本にしない。採用資産は固定revisionとRepository-local materializationを使う。

## 既定レビュー

キャラクター/モーション/成長/装備を確認するとき、active候補はCC0またはRINNE-ownedだけにする。条件付き第三者モデルを比較用という理由でactive候補へ戻さない。

## 禁止する逆戻り

- 新規共通機能を条件付き第三者モデルの名前・asset path・専用hero gateへ直接依存させない。
- 条件付きモデルを「商用利用可能だから」という理由だけでfallbackや比較候補へ復帰させない。
- KayKitを単なる一時スクリーンショット素材として扱い、ゲーム側が条件付きモデル専用実装へ再収束する構造を作らない。
- ライセンスgateを品質や納期都合で弱めない。

## 移行

旧ID/schemaは過去データ読取やmigration compatibilityに必要な範囲だけ残せるが、active asset採用を意味しない。第三者reviewモデル本体はcurrent treeから除去し、RINNE-authored surfaceの旧DCC sourceは再リグ移行の証拠としてのみ保持する。新規依存方向はKayKit CC0または完全RINNE-ownedへ限定する。
