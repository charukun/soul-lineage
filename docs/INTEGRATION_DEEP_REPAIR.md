# Integration Deep Repair Handoff

Fast Laneは通常Ready PRの唯一のmerge入口であり、Fast RepairはGitで機械的に安全なmerge-forwardだけを処理する。

Fast LaneまたはFast Repairが真のmerge conflict、overlapping runtime change、large-base reconciliation、その他のsemantic repair候補を検出した場合、旧Rescue queueや1時間watchdogを通常の起動条件にせず、そのcurrent exact headに対するDeep Repair handoffを同じIntegration passで即時に記録する。

Deep Repair handoffは次を満たす。

- GitHub current stateだけを正本にし、PR番号、branch、exact head、current develop、reasonを固定する。
- `integration/deep-repair` statusと冪等なPR comment/envelopeを即時に作る。
- explicit hold、Changes requested、未解決thread、未merge dependency、external PR、main / Productionを自動修復へ送らない。
- Deep Repair自身はmerge権限を持たない。元PR branchをfast-forwardで修復し、exact-head fast validation後に同じFast Laneへ戻す。
- OpenAI API、Codex Action、専用PAT、有料fallbackを通常Deep Repair起動条件に追加しない。
- ChatGPT Work等のAI実行面が即時起動できない場合でも、GitHub上のhandoff記録はそのpassで完了し、独立Ready PRのFast Laneを止めない。
- 旧periodic Work/watchdogは取りこぼし復旧のfallbackとして残してよいが、Deep Repair要求の発見や状態生成を担当しない。

受入条件:

1. 真のconflictを検出したFast Lane passが、同じexact headへ一度だけDeep Repair envelope/statusを作る。
2. 同じheadを再評価してもコメントを重複生成しない。
3. headが変わった場合は新しいexact headとして再評価する。
4. Fast Repair可能なbehind/stack更新はDeep Repairへ送らない。
5. Deep Repair要求中でも他のeligible PRはmergeされる。
6. main / Production gate、review/hold/thread/dependency gate、exact-head validationを弱めない。
