# Integration Repair

旧称 Integration Rescue。現在の通常経路では独立したRescue queueを持たず、**Fast Lane + optional Fast Repair** を正本とする。

Ready PRの通常merge判定は `scripts/integration-fast-lane.mjs` がGitHub current stateから行う。RepairはFast Laneでそのまま通せないPRのうち、機械的に安全性を証明できる更新だけを短命executorとして処理する。Repair自身はdevelopへmergeしない。

## 現行トポロジー

```text
GitHub event
  -> Fast Lane
       eligible -> expected-head merge
       mechanically repairable -> Fast Repair
          -> PR branch merge-forward
          -> exact-head fast validation
          -> Fast Lane wake
       true conflict -> Deep Repair Issue -> ChatGPT Work -> Fast Lane
       product decision required -> HUMAN_REQUIRED
```

正常PRはRepairを通らない。1件の失敗PR、browser failure、DEV delivery failureは独立PRをglobal blockしない。large-base reconciliationはcomplete fail-closed comparisonでFast Laneに残し、変更量だけを理由にDeep Repairへ落とさない。

## 実装

| 構成 | 実装 | 責任 |
| --- | --- | --- |
| Fast Lane | `scripts/integration-fast-lane.mjs` | current Ready PR再取得、complete base comparison、exact-head gate、expected-head merge、真のconflict・exact-head CI failureの即時Deep Repair handoff |
| Fast Repair / Stack reconciliation | `scripts/integration-repair-fast.mjs` の `reconcileStackFast` | current stacked Ready PRをbounded再取得し、Depends-On・review・hold・thread・head・developを再確認して元PR branchを安全にmerge-forward |
| Repair workflow | `.github/workflows/integration-rescue.yml` | compatibility file名。Fast Repair、最大4並列exact-head fast validation、成功headごとの即時Fast Lane wake、非blocking browser smoke |
| Trusted stack evidence | `scripts/integration-stack-fast-evidence.mjs` | trusted `deploy.yml/develop/workflow_dispatch` run、exact artifact、成功jobを再検証 |
| Immediate Deep Repair | `scripts/integration-deep-repair-handoff.mjs`, `docs/INTEGRATION_DEEP_REPAIR.md` | exact-head true conflictをmachine-readable Issue + `integration/deep-repair` statusへ即時handoff |
| Deep repair compatibility | `scripts/integration-rescue-*`, `scripts/integration-quarantine-signal.mjs` | 旧stateの移行・診断・fallback。通常Fast Repair/Deep Repair検出の待ち条件ではない |
| PULSE | `ops-board/rescue.mjs` 等 | 観測のみ。merge/Repair権限を持たない |

## 起動

既定branchはmainのため、既存 `deploy.yml` を `ref: develop` で起動する互換入口を維持する。入力名 `rescue_mode=scan` は後方互換のwake signalであり、現在は lightweight Repair executorを起動する。

Ready/synchronize/review等はCIの既存 `Request Rescue observation` からこのscanを起こす。名称は互換のため残っていても、通常実行は旧Coordinator/Wave/Worker queueではない。

## Fast Repairの対象

通常Fast Repairは現時点では stacked dependency reconciliation を担当する。

1. current open/non-Draft develop PRをGitHubから再取得する。
2. same repository / trusted author / `Depends-On` ありだけを見る。
3. 依存PRがdevelopへmerge済みであることを確認する。
4. Fast Repair自身がhold、Changes requested、unresolved thread、head変更、dependency、mergeabilityを再確認する。stack更新で正常に発生する `mergeable_state=behind` は許可するが、conflict/unknown等は自動修復しない。
5. develop SHAとPR exact headをmutation直前に再取得する。
6. 元PR branchへ最新developを通常merge-forwardする。force push/history rewriteはしない。
7. 更新後のPR headがGitHub上で実際にmerge commit SHAへ進んだことを再確認する。
8. 更新headを最大4件並列でfast validationする。
9. `pr-fast-<PR>-<SHA>` artifactと `integration/stack-fast` statusを作る。
10. 各headが成功した瞬間にFast Laneを即wakeする。他のRepair worker完了を待たない。Fast Laneはstatus文字列だけでなくrun identity、artifact、job successを再検証する。

Fast Repairは `AWAITING_PUSH` を作らず、通常Work push relayを待たず、独自Waveの完了を待たない。

## Deep Repairの即時handoff

Fast Laneがcurrent PRを再取得し、依存がdevelopへmerge済みで、hold・Changes requested・未解決threadがないにもかかわらず `mergeable=false / mergeable_state=dirty` を確認した場合、そのpass内で `integration-deep-repair:v1` Issueを作る。

CIの `Validate and build` が失敗したReady PRも、最新validation runの失敗jobを根拠に同じDeep Repairへ送る。CI完了時のIntegration wakeと失敗証拠の契約は `docs/INTEGRATION_DEEP_REPAIR.md` を参照。

IssueはPR番号、元branch、exact head、current develop、reason、attempt上限を固定し、同じexact headの`sourceKey`で重複しない。既存 `rinne-ai-repair:v1` envelopeも同梱する。

RepositoryはこのGitHub eventを作るところまでを責任範囲とする。ChatGPT WorkのGitHub Issue opened/edited event triggerはChatGPTアカウント/Project側の設定であり、Repositoryから登録できない。trigger条件・prompt・claim手順は `docs/INTEGRATION_DEEP_REPAIR.md` を正本とする。

別PRは別IssueなのでWork側が並列セッションを許す範囲で並列修復できる。同じIssueは `pending -> working` claimで二重修復を防ぐ。Workが修復して元PR branchへpushした後は通常CI/Fast Laneへ戻る。Deep Repair IssueやWorkの完了待ちは独立Ready PRのFast Laneを止めない。

旧periodic Work/watchdogはevent triggerの取りこぼしを拾うfallbackとして残してよいが、真のconflictを発見してhandoffを作る通常経路には使わない。

## 自動Repairしないもの

次は速度のために安全条件を下げず、そのPRだけをdeep repair / human-requiredへ送る。

この節のFast Repair対象外とhuman-requiredは同義ではない。同file競合はDeep Repairで確定仕様への適応を検討する。可逆的な細部はAIが判断しDEV公開後に確認する。仕様によるhuman-requiredの条件と記録は [実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md#devで実物を確認する標準開発) に従う。

- 明示hold、`integration:manual`、`do-not-merge`
- Changes requested、未解決review thread
- external/untrusted PR
- main / Production
- 同一fileや関連実行コードの意味衝突
- schema/save/protocol/API等で真のプロダクト判断が必要な変更
- assertion削除を含みcoverage維持を証明できない修復

旧 `scripts/integration-rescue-worker.mjs`、store、Work push/repair、Coordinator等はdeep-repair互換・既存state/PULSEの診断・移行用に残してよいが、通常Fast Repair workflowからは呼ばない。将来削除する場合も、deep repair/human-requiredの受け皿と履歴参照を先に移行する。

## 追加API課金なし

通常Repair workflowとDeep Repair handoffは標準 `GITHUB_TOKEN` とGitHub Actions/GitHub Issueだけを使う。`openai/codex-action`、`OPENAI_API_KEY`、`RINNE_CODEX_MODEL`、専用PATを要求しない。有料モデルAPIへのfallbackはない。

意味判断が必要なdeep repairは既存ChatGPT Work等の別実行面で扱い、利用できない場合はそのPRだけ停止する。独立Ready PRのFast Laneは継続する。

## browser / DEV

stack更新後のbrowser smokeはfast validationと並行して走り、Fast Laneを待たせない。失敗結果は通常browser repair ticketへ返す。

PR browser failureがmerge後に到着した場合、失敗したPR mergeがcurrent developの祖先なら、その失敗をcurrent developの`browser-repair:v1` generationへ昇格し、捨てない。これによりmerge非blocking化後もbrowser self-healingを維持する。

DEV PublisherもFast Laneと分離する。`integration/develop` pending/failureはDEV delivery healthであり、独立Ready PRのmerge lockではない。古いautomatic publisherは最新developへcoalesceし、公開中でも新しいeligible PRのFast Laneは進む。

## 旧Rescue stateの扱い

`automation/integration-rescue-state`、`rescue-state.json`、Wave、claim、heartbeat、`AWAITING_PUSH`、Work relay、outbox等は旧Rescue/deep-repair互換の診断データとして扱う。**current Ready PRのmerge可否や通常Fast Repair、Deep Repair handoffの進行権限には使わない。**

PULSEが旧stateを表示しても、それは観測・移行情報であり制御面ではない。

## 安全条件

- exact-head fast evidenceなしではmergeしない
- explicit hold / review objection / unresolved threadをRepairが解除しない
- current PR/head/developをmutation直前に再取得する
- Fast Laneのsingle develop writerを維持する
- PR branch更新は通常merge-forward/validated Deep Repairのみ。force push禁止
- browser assertionsやProduction gateを弱めない
- main / Productionを自動Repair対象にしない

## 受入条件

- 正常Ready PRは旧Rescue stateを一度も通らずmergeできる
- stacked PRは依存merge後、1回のtrusted Repair runでmerge-forward → exact-head validation → Fast Lane wakeまで進む
- 各repaired headは他worker完了を待たずFast Laneへ戻る
- large-baseはcomplete comparisonでFast Laneに残り、サイズだけでDeep Repairへ落ちない
- 真のconflictは同じFast Lane passでDeep Repair Issue/statusへhandoffされる
- 同じexact headでDeep Repair Issueを重複生成しない
- Deep Repair/Browser/DEV repair中でも独立eligible PRはmergeできる
- merge後に届いたPR browser failureをcurrent develop repairへ昇格できる
- `AWAITING_PUSH` / Work relay / 1時間watchdogが通常修復の待ち時間にならない
- stale/missing evidenceでmergeしない
- 追加有料API/PATなし
- main / Production gate不変
