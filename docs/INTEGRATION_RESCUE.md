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
       semantic / unsafe -> deep repair or HUMAN_REQUIRED
```

正常PRはRepairを通らない。1件の失敗PR、browser failure、DEV delivery failureは独立PRをglobal blockしない。

## 実装

| 構成 | 実装 | 責任 |
| --- | --- | --- |
| Fast Lane | `scripts/integration-fast-lane.mjs` | current Ready PR再取得、exact-head gate、expected-head merge |
| Fast Repair planner | `scripts/integration-repair-fast.mjs` | current stacked Ready PRだけをbounded再取得し、安全なmerge-forwardを依頼 |
| Stack reconciliation | `scripts/integration-queue-recovery.mjs` の `reconcileStack` | Depends-On完了、review/hold/thread/head/develop再確認後の元PR branch更新 |
| Repair workflow | `.github/workflows/integration-rescue.yml` | compatibility file名。Fast Repair、最大4並列exact-head fast validation、Fast Lane wake、非blocking browser smoke |
| Trusted stack evidence | `scripts/integration-stack-fast-evidence.mjs` | trusted `deploy.yml/develop/workflow_dispatch` run、exact artifact、成功jobを再検証 |
| Deep repair compatibility | `scripts/integration-rescue-*`, `scripts/integration-quarantine-signal.mjs` | 意味競合や旧stateの移行・診断。通常Fast Repairの待ち条件ではない |
| PULSE | `ops-board/rescue.mjs` 等 | 観測のみ。merge/Repair権限を持たない |

## 起動

既定branchはmainのため、既存 `deploy.yml` を `ref: develop` で起動する互換入口を維持する。入力名 `rescue_mode=scan` は後方互換のwake signalであり、現在は lightweight Repair executorを起動する。

Ready/synchronize/review等はCIの既存 `Request Rescue observation` からこのscanを起こす。名称は互換のため残っていても、通常実行は旧Coordinator/Wave/Worker queueではない。

## Fast Repairの対象

通常Fast Repairは現時点では stacked dependency reconciliation を担当する。

1. current open/non-Draft develop PRをGitHubから再取得する。
2. same repository / trusted author / `Depends-On` ありだけを見る。
3. 依存PRがdevelopへmerge済みであることを確認する。
4. `recoveryReady` でhold、Changes requested、unresolved thread、head変更、dependency、mergeabilityを再確認する。
5. develop SHAとPR exact headを直前に再取得する。
6. 元PR branchへ最新developを通常merge-forwardする。force push/history rewriteはしない。
7. 更新headを最大4件並列でfast validationする。
8. `pr-fast-<PR>-<SHA>` artifactと `integration/stack-fast` statusを作る。
9. Fast Laneを即wakeする。Fast Laneはstatus文字列だけでなくrun identity、artifact、job successを再検証する。

Fast Repairは `AWAITING_PUSH` を作らず、通常Work push relayを待たず、独自Waveの完了を待たない。

## 自動Repairしないもの

次は速度のために安全条件を下げず、そのPRだけをdeep repair / human-requiredへ送る。

- 明示hold、`integration:manual`、`do-not-merge`
- Changes requested、未解決review thread
- external/untrusted PR
- main / Production
- 同一fileや関連実行コードの意味衝突
- schema/save/protocol/API等で真のプロダクト判断が必要な変更
- assertion削除を含みcoverage維持を証明できない修復

旧 `scripts/integration-rescue-worker.mjs`、store、Work push/repair、Coordinator等はdeep-repair互換・既存state/PULSEの診断・移行用に残してよいが、通常Fast Repair workflowからは呼ばない。将来削除する場合も、deep repair/human-requiredの受け皿と履歴参照を先に移行する。

## 追加API課金なし

通常Repair workflowは標準 `GITHUB_TOKEN` とGitHub Actionsだけを使う。`openai/codex-action`、`OPENAI_API_KEY`、`RINNE_CODEX_MODEL`、専用PATを要求しない。有料モデルAPIへのfallbackはない。

意味判断が必要なdeep repairは既存ChatGPT Work等の別経路で扱い、利用できない場合はそのPRだけ停止する。独立Ready PRのFast Laneは継続する。

## browser / DEV

stack更新後のbrowser smokeはfast validationと並行して走り、Fast Laneを待たせない。失敗結果は通常browser repair ticketへ返す。

DEV PublisherもFast Laneと分離する。`integration/develop` pending/failureはDEV delivery healthであり、独立Ready PRのmerge lockではない。

## 旧Rescue stateの扱い

`automation/integration-rescue-state`、`rescue-state.json`、Wave、claim、heartbeat、`AWAITING_PUSH`、Work relay、outbox等は旧Rescue/deep-repair互換の診断データとして扱う。**current Ready PRのmerge可否や通常Fast Repairの進行権限には使わない。**

PULSEが旧stateを表示しても、それは観測・移行情報であり制御面ではない。

## 安全条件

- exact-head fast evidenceなしではmergeしない
- explicit hold / review objection / unresolved threadをRepairが解除しない
- current PR/head/developをmutation直前に再取得する
- Fast Laneのsingle develop writerを維持する
- PR branch更新は通常merge-forwardのみ。force push禁止
- browser assertionsやProduction gateを弱めない
- main / Productionを自動Repair対象にしない

## 受入条件

- 正常Ready PRは旧Rescue stateを一度も通らずmergeできる
- stacked PRは依存merge後、1回のtrusted Repair runでmerge-forward → exact-head validation → Fast Lane wakeまで進む
- `AWAITING_PUSH` / Work relay / 1時間watchdogが通常修復の待ち時間にならない
- Repair失敗中でも独立eligible PRはmergeできる
- stale/missing evidenceでmergeしない
- 追加有料API/PATなし
- main / Production gate不変
