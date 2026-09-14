# Integration Autonomous Delivery v4

Control Plane v2 / Autonomous Delivery v3 を最新 develop 上で統合し、Stack-native CI、Failure Fingerprint、DEV Candidate Promotion、Last Known Good DEV recovery、Gate Cost Optimizerまでを既存Integration / Rescue / PULSEへ追加する。

## 受入条件

- #223 / #225 の安全契約を最新developへ再統合し、重複control-plane PRを残さない。
- stacked PRでは親のexact evidenceを安全に再利用し、子固有deltaと最終合成treeを検証する。品質gateは削らない。
- 既知失敗をfingerprint化して修復履歴を再利用するが、異なるheadや異なる失敗を成功扱いしない。
- DEVはcandidate snapshotで検証後に正式DEVへpromoteし、失敗時はlast-known-good公開snapshotへ自動縮退できる。
- develop履歴、main / Production、review / hold / browser assertion / exact-head safetyを変更・弱体化しない。
- Gate Cost Optimizerはgateを省略せず、安く失敗しやすい検査から順に実行する。
- 新しい有料モデルAPI、PAT前提、独自task DBは追加しない。

## 完了条件

専用Draft PRで実装・focused fast validation・self reviewを行い、Ready for review → READY_FOR_INTEGRATIONで既存Integrationへhandoffする。
