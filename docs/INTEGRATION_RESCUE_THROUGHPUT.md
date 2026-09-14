# Integration Rescue throughput acceleration

Integration Rescueの安全条件を維持したまま、検知からReady復帰・develop統合・DEV到達までの待ち時間を短縮する。

## 受入条件

- 追加モデルAPI課金や新規PATを要求しない。既存Actions + ChatGPT Work + GitHub接続を利用する。
- `FAILED_MANUAL`へ落としていた意味的競合のうち、自動base更新では安全判定できないものを既存WorkのSemantic Rescueへ引き渡せる。明示hold、Changes requested、未解決thread、外部PR、main / Productionは対象外のまま。
- Rescue Workerが実行したtrusted fast verificationをexact SHA / tree / artifactで証明し、通常Integrationが同一証拠を再利用できる場合は同じfast検証を重複実行しない。証拠が一致しない場合は従来どおり通常fast gateを必須とする。
- `RETURNED_TO_INTEGRATION`のexact headを通常Readyキューより最優先で再評価し、古いheadやbaseline failureを飛び越えない。
- Integration / Rescueの制御面PRには72時間相当のbounded priority boostを与え、Rescue自身の改善が通常キューの末尾で自己待機し続ける状態を避ける。`integration:repair` はさらに強いbounded boostを持つ。
- 通常PRはReadyになってから1時間ごとにagingを積み、十分古い通常PRは制御面boostを追い越せる。制御面レーンを導入しても通常機能PRを永久に飢餓状態へしない。
- `PR_CONTRACT_CHANGED` / `HEAD_CHANGED`のように修復内容の失敗ではない観測競合はattemptを浪費せず再観測へ戻す。
- scan上限と並列数を引き上げるが、API reserve、CAS、PR単位concurrency、RED lock、Depends-On、review、browser repair所有権は維持する。
- 同一develop SHAの `integration/develop=success` とexact Rescue fast evidenceは再利用し、同じ検証をPRごとに重複実行しない。SHA・tree・artifact等が一致しない証拠は再利用しない。
- PULSE/stateでSemantic Rescue待ち、fast evidence再利用、優先return、再観測、manual conflictを区別できる。

## Ready優先順位

1. `RETURNED_TO_INTEGRATION` / `CHECKING` のexact head。Rescueで実push済みのheadを通常queueへ即座に戻す。
2. `integration:repair`。develop baseline失敗を解消する修復を先に通す。
3. Integration / Rescue control plane。branch / title / body / explicit labelから制御面を識別し、72時間相当のboostを付ける。
4. 通常Ready PR。Readyの経過時間をagingとして加算する。

優先順位は固定階級ではなくscoreであり、通常PRのagingは制御面boostを最終的に追い越せる。exact-head safety gate、Depends-On、review、mergeability、baselineは優先順位に関係なく必須。

## 初期チューニング目標

- max concurrency: 4 → 6
- max evaluations per scan: 12 → 24
- scan minimum interval: 120秒 → 60秒
- queue stall threshold: 900秒 → 300秒
- retry base: 300秒 → 120秒。ただし指数的な無限retryはせずmaxAttemptsを維持する。
- control-plane boost: 72時間相当。古い通常Readyはagingで追い越せる。

## 非目標

- 意味が不明な競合を機械的にours/theirsで解消しない。
- CI、browser assertion、review、hold、Depends-On、develop baseline gateを弱めない。
- Rescueからdevelop/mainへ直接pushしない。
- Productionを変更しない。
