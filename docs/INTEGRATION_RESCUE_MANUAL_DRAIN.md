# Integration Rescue recoverable manual drain

`FAILED_MANUAL` は表示上の最終状態ではなく、安全側停止の総称である。既存 ChatGPT Work で解消できる停止と、本当に人間の判断が必要な停止を分離する。

## 受入条件

- `SEMANTIC_CONFLICT`、`OVERLAPPING_CHANGES`、`RELATED_CODE_RECONCILIATION`、安全性を証明できる `CONTROL_OR_CONTRACT_RECONCILIATION`、`ASSERTION_REMOVAL`、recoverable transport failure は `workRepairEligibility()` を正本として Work repair lane に残す。
- Work repair 中に latest `develop` が前進した場合、それだけを意味修復失敗として数えない。現在の修復予約を安全に終了し、最新 baseline で再取得・再検証する。
- baseline 前進による再開始は独立した有限 churn budget で制限し、同じ head を無限に再試行しない。
- 真の仕様選択、明示 hold、Changes requested、未解決 thread、Draft、外部/非 trusted PR、browser repair ownership は従来どおり自動解除しない。
- PULSE は recoverable な `FAILED_MANUAL` を「AI修復待ち」、真の human-required を「人の判断が必要」と分けて表示する。
- main / Production、review/hold/browser/Integration gate、検証強度は変更しない。

## 実稼働の完了条件

変更は最新 `develop` からの専用 PR で実装し、関連 unit test と PULSE contract を更新する。Ready for review 後は通常 Integration に引き渡す。統合後、既存の `Integration Rescue 復旧` Work は統合済み helper を正本として recoverable backlog を最大4PR/回で drain する。
