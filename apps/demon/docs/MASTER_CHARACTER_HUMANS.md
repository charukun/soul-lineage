# 魔物側ゲームのMasterCharacter人間NPC統合

Sendagaya_ShinoをMasterCharacter正本として、魔物側ゲームに登場する人間NPCの身体描画へ量産モデルを実投入する。

## 実施範囲

- NPCの役割、AI、位置、戦闘、序破急、捕食、入村履歴、報酬、当たり判定は変更しない。
- 人間NPCの身体だけをMasterCharacterへ置き換え、既存の武器・ネームプレート・戦闘演出は維持する。
- 怪物プレイヤー、KayKit Skeleton候補、背景アセットは変更しない。
- 同一NPCはID/roleから決定論的な外見を生成する。
- reviewed Shino VRMを同一DEV snapshotのRinne公開物から読み込み、SHA-256を検証する。
- モデル取得・ハッシュ・rig初期化に失敗した場合は既存の手続き型人間へ即時フォールバックする。
- 上限付きpoolで実VRM人数を制限し、遠距離・死亡・捕食済みNPCは既存軽量描画へ戻す。

## 初期受入条件

- 現行ゲームルールとセーブ形式を一切変えない。
- 人間NPCがMasterCharacter化しても既存の名前表示・戦闘対象・武器・捕食処理が維持される。
- main / Productionは変更しない。
