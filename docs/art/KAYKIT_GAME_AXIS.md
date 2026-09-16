# KayKit-first game axis

輪廻転焦の当面のゲーム構築は、特定のShino専用モデル完成を中心にせず、レビュー済み・出典固定済みのKayKit系資産を主要な実プレイ候補として進める。

## 方針

- ゲーム体験の検証は `生活 -> 技 -> 装備 -> 遠征 -> 戦闘 -> 帰還` のループを優先する。
- キャラクターの主要な実プレイ/レビュー候補は、既に導入実績のある KayKit Adventurers の Knight / Barbarian / Mage / Rogue / Rogue Hooded と、必要に応じて既存のKayKit系候補を使う。
- Shino / Sendagaya_Shino は削除しない。既存セーブ、identity、互換性、比較用モデルを維持するが、新規ゲーム機能の既定の成立条件や唯一のhero基準にはしない。
- 共通リグ、Motion QA、Character Workshop、Visual Review、Character Production、refinement loopはキャラクター非依存の共有基盤として扱う。
- KayKit由来の武器・盾・背中装備・小物は、既存のprovenance/license/asset-hash境界を守ってゲーム体験の構築に再利用する。Reviewでの試着がgameplay ownershipを自動的に与えることはない。
- 外部のmoving URLをruntime正本にしない。採用資産は固定revisionとRepository-local materializationを使う。

## 既定レビュー

キャラクター/モーション/成長/装備を確認するとき、KayKit候補が利用可能ならKayKitを主要候補として先に見せる。Shinoは比較・互換性確認の候補として残す。

## 禁止する逆戻り

- 新規共通機能を `Shino` という名前・asset path・専用hero gateへ直接依存させない。
- Shinoの見た目完成を、ゲームループ実装より先に必須化しない。
- KayKitを単なる一時スクリーンショット素材として扱い、ゲーム側が再びShino専用実装へ収束する構造を作らない。

## 移行

既存Shino固有コードは一括削除しない。触れる機能から、互換性を保ったまま `character / hero / master / selected model` の共有概念へ引き上げる。大規模renameより、実プレイの既定候補と新規依存方向をKayKit-firstへ変えることを優先する。
