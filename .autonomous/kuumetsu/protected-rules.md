# 喰滅廻遊固有の保護

共通rulesに加え、現在の `src/hunt/`、native tests、`docs/demon/INTEGRATION.md` の該当仕様を照合する（歴史的な配信/旧実装状況は現在のworkflowを優先）。

- 単独狩りのジャンル、タップ非移動/スワイプ移動/接敵自動戦闘を無断で変えない。
- authored Tidebreakの序破急・間合い・strike・勝敗を簡易式/擬似ヒットで置換しない。skillSetへ接続されたtempoを保持する。
- 捕食、記憶3枠、形態、警鐘/敵、帰還/撤退/敗北の意味と入力を維持する。
- verified extractionなしで報酬を持ち帰らせない。caller提供bonus/quotaを信用しない。任務/forage、章進行、automatic growthとlegacy save互換を保持する。
- canonical village/player ID、先書き入村台帳、破損保存fail-closed、single writer、environment分離を保持。敗北/中断/改名/revision変更で再入場券を作らない。
- メニューへの移動を帰還成功にしない。NPCを実プレイヤーと偽らない。共有村や元データを勝手に削除しない。
- probeの都合で接敵capやHP/tempo上限を変えない。未確認の編成/敵勝率を「測定した」と報告しない。

調査基準: develop `c5c83902ed34ecce1ca7d3f50ac93f568dcc6945`。開始時に最新へ更新。
