# Integration Autonomous Delivery v4

> Historical design record. この文書は Control Plane v2 / Autonomous Delivery v3 を統合した当時の設計記録であり、現在の merge authority・通常運用の正本ではない。

現在の develop Integration は [`INTEGRATION.md`](INTEGRATION.md) の Fast Lane、control-plane の現在形は [`INTEGRATION_RECONCILIATION.md`](INTEGRATION_RECONCILIATION.md)、Repair は [`INTEGRATION_RESCUE.md`](INTEGRATION_RESCUE.md) を参照する。

## この設計から現在も維持されている原則

- current GitHub state と exact-head evidence を正本にする。
- develop mutation は single expected-head writer で直列化する。
- 1件の失敗、browser failure、DEV delivery failureで独立PR全体を止めない。
- DEV publication / browser verification は merge lane と分離し、最新 develop へ非同期に追従する。
- review、hold、dependency、exact-head gate、main / Production gate を弱めない。
- 新しい有料 API、独自 Task-ID、外部の永続 queue を通常経路の前提にしない。

## 現在の通常経路ではないもの

この版で扱っていた Planner、通常 Virtual Train、Wave、Quarantine を通常の merge authority・現在待ち件数・必須経路として使わない。旧 Rescue state / scripts と同様、残存実装や資料が必要な場合は migration / diagnostics / compatibility の文脈でのみ扱い、現在の挙動は必ず latest `develop` のコードと canonical documents で確認する。

当時の PR 番号、閾値、run 状態、実験結果を現在の設定値として流用しない。歴史的な判断理由を調べる必要がある場合だけ Git 履歴・該当 PR からその時点の版を取得する。
