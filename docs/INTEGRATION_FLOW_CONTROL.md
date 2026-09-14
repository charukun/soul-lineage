# Integration Flow Control

Ready PRの流入量がIntegration / Rescueの処理能力を上回っても、開発全体を自己渋滞させないための制御面を追加する。

## 受入条件

- Ready backlogの圧力をNORMAL / BUSY / BURN_DOWNで機械判定し、非緊急な自動メンテナンスPR生成へbackpressureを掛ける。
- 独立scopeのReady PRを小さなIntegration Trainとして優先し、関連scopeは従来どおり順序付け・再評価する。
- recoverable manual stopは可能な限りイベントで即Rescue観測へ戻し、定期Workは取り逃し時のbackstopにする。
- 同じPR head / purposeの重複CI起動をcoalesceし、古いrunをmerge成功証拠として扱わない。
- Rescue durable stateはactiveと最近の履歴をboundedに保持し、状態ファイル肥大化を防ぐ。
- PULSEはReady→Merge、Merge→DEV、Ready→DEVのp50/p95と現在の主要ボトルネックを表示できるmachine-readable集計を持つ。
- backlogが一定量を超えた場合はBacklog Burn-down Modeへ入り、古いReady・repair・AI repairableを優先し、非緊急maintenance生成を抑制する。
- main / Production、review/hold/browser/contract safety gateは変更しない。
