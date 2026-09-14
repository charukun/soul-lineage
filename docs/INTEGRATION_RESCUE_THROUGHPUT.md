# Integration Rescue throughput acceleration

Integration Rescueの安全条件を維持したまま、検知からReady復帰・develop統合・DEV到達までの待ち時間を短縮する。

## 受入条件

- 追加モデルAPI課金や新規PATを要求しない。既存Actions + ChatGPT Work + GitHub接続を利用する。
- `FAILED_MANUAL`へ落としていた意味的競合のうち、自動base更新では安全判定できないものを既存WorkのSemantic Rescueへ引き渡せる。明示hold、Changes requested、未解決thread、外部PR、main / Productionは対象外のまま。
- Rescue Workerが実行したtrusted fast verificationをexact SHA / tree / artifactで証明し、通常Integrationが同一証拠を再利用できる場合は同じfast検証を重複実行しない。証拠が一致しない場合は従来どおり通常fast gateを必須とする。
- `RETURNED_TO_INTEGRATION`のPRを通常Readyキューより優先して再評価し、古いheadやbaseline failureを飛び越えない。
- `PR_CONTRACT_CHANGED` / `HEAD_CHANGED`のように修復内容の失敗ではない観測競合はattemptを浪費せず再観測へ戻す。
- scan上限と並列数を引き上げるが、API reserve、CAS、PR単位concurrency、RED lock、Depends-On、review、browser repair所有権は維持する。
- PULSE/stateでSemantic Rescue待ち、fast evidence再利用、優先return、再観測を区別できる。

## 初期チューニング目標

- max concurrency: 4 → 6
- max evaluations per scan: 12 → 24
- scan minimum interval: 120秒 → 60秒
- retry base: 300秒 → 120秒。ただし指数的な無限retryはせずmaxAttemptsを維持する。

## 非目標

- 意味が不明な競合を機械的にours/theirsで解消しない。
- CI、browser assertion、review、hold、Depends-On、develop baseline gateを弱めない。
- Rescueからdevelop/mainへ直接pushしない。
- Productionを変更しない。
