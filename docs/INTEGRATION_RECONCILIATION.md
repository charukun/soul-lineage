# Integration Fast Lane Reconciliation

## 目的

Integrationの正本はGitHub current stateだけにする。Planner、通常Virtual Train、DEV health global lockを通常経路から外し、イベントごとにReady PRを再読して **通るPRだけ即merge** する。

新しいTask-ID、外部DB、独自永続queueは作らない。

## 原則

1. **Events are wake signals**
   - Ready、exact-head fast CI完了、review/label変更、repair scanなどはFast Laneを起こすだけ。
   - event payloadをmerge可否の正本にせず、PR/develop/review/checkをGitHubから再取得する。
   - GitHub Actionsの`GITHUB_TOKEN`でstacked Ready PRのheadを更新した場合は、再帰的な`pull_request/synchronize`起動に依存しない。更新直後のcurrent PR/headを再取得し、trusted Repair run内でexact-head fast validationを明示的に実行する。
2. **One failed PR never freezes independent PRs**
   - fast failure、browser failure、hold、dependency、review objectionはそのPRだけを保留する。
3. **Single develop writer**
   - develop mutationは`integration-controller-develop`で直列化し、merge直前にdevelop SHAとPR exact headを再取得する。
4. **Fast check before merge, browser after/alongside it**
   - merge条件はcurrent exact-head `Validate and build` + `pr-fast` artifact。Actions botのstack reconciliationでは、trusted Repair runの同等exact-head evidenceをFast Laneがrun/job/artifact/statusまで再検証して利用できる。
   - browser smokeは継続するが通常mergeを待たせない。
5. **DEV health is not merge health**
   - `integration/develop`はDEV deliveryの状態。pending/failureでも通常Ready PRをglobal blockしない。
6. **Repair is an executor, not another queue**
   - Fast Laneで通らないPRのうち、機械的に安全に直せるものだけをRepairへ渡す。
   - Repairは独自queue、Wave、priority、AWAITING_PUSH、Work push relay、Return待ちを通常経路に持たない。
   - 修復後は同じtrusted runでcurrent exact-headを再検証し、Fast Laneを再度wakeする。
   - 仕様判断が必要な衝突だけをdeep repair / human-requiredへ送る。

## 最小トポロジー

```text
GitHub event
  -> Fast Lane
       eligible -> expected-head merge
       repairable -> Repair -> exact-head fast validation -> Fast Lane wake
       semantic / unsafe -> deep repair or HUMAN_REQUIRED
```

正常PRはRepairを一度も通らない。RepairはFast Laneの横にある補助executorであり、第二のIntegration control-planeではない。

通常経路ではRescue固有の永続queueや配送状態をmerge権限に使わない。repair対象の同一PR重複実行はGitHub ActionsのPR単位concurrencyとcurrent head再取得で防止する。永続stateが残る場合も診断・移行互換のみに限定し、Fast Laneや修復後pushの正本にしない。

## Fast Lane

```text
wake
  -> list current Ready develop PRs
  -> for each PR
       cheap hold/dependency/mergeability/review
       exact-head fast artifact + Validate and build
       sensitive/overlap review if required
       re-read mutable state
       expected-head merge
  -> continue with next independent PR
```

1 passは最大24 mergeにboundedする。`integration:repair`、`integration:priority`は先に評価できるが、ラベルは安全条件を迂回しない。

## stacked dependency reconciliation

Dependencyがmerge済みになったReady PRを最新developへmerge-forwardする処理はRepair executor内でboundedに行う。独自WaveやAWAITING_PUSHを経由せず、更新直後のcurrent PR/headを再取得して同じtrusted run内のexact-head fast validationへ渡す。

merge-forwardされたheadは最大4件を並列にfast validationする。各workerはcurrent PR/headを再取得し、reconciled develop SHAがexact headのancestorであることを証明してから通常fast validationを実行し、`pr-fast-<pr>-<head>` artifactと`integration/stack-fast` statusを作る。Fast Laneはstatusの文字列だけを信用せず、target runがtrusted `deploy.yml` / `develop` / `workflow_dispatch`であること、exact artifact、completed success build jobまで再検証する。

この経路はGitHubの`GITHUB_TOKEN`で作られた`pull_request/synchronize`がapproval-requiredになる仕様を迂回して承認するものではない。approval-required runはそのまま残してよく、trusted Repair runのexact-head evidenceを別経路で作る。PAT・別GitHub App・人間の空commitは不要。

## browser / repair

`Affected browser smoke` はFast Laneと並行して実行する。失敗結果は既存browser repair ticketへ記録する。assertion削除、検証条件の弱体化、無制限retryは禁止。

stack reconciliation由来headも同じくbrowser smokeを別matrixで後追いし、Fast Laneを待たせない。結果は通常のbrowser repair recorderへ返す。

DEV公開後のfocused browserも同様にdelivery health / repair evidenceとして維持する。

## deep repair / human-required

同一fileや関連契約の意味衝突など、機械的なmerge-forwardだけでは安全を証明できないものはFast Lane内で無理に直さない。既存ChatGPT Work等のdeep repairへhandoffし、両側の確定仕様・review・test coverageを確認できた場合だけ元PR branchを修復する。

明示hold、Changes requested、未解決thread、schema/save/protocol等の真のプロダクト判断、main / Productionは自動Repairで解除・変更しない。deep repairが使えない場合はGitHub上にhuman-requiredの理由を残し、正常PRのmerge laneは継続する。

## DEV Publisher

Fast Lane mergeでdevelopが進むとpushがPublisherを起こす。`DEV Publisher Coalescer`は古いpush由来`deploy.yml` runだけを取消し、最新develop SHAへ収束させる。

workflow_dispatchのIntegration/repair runはcoalescer対象外。publish step自身も公開前にcurrent developを確認し、古いsnapshotを昇格させない。

## 廃止した通常経路

以下は通常merge critical pathに置かない。

- pure reconciliation Planner
- normal Virtual Integration Train
- Train browser検証
- publisher-handoff
- `integration/develop` pending/failureによるglobal merge停止
- browser完了待ちからのIntegration request
- Rescue専用の通常queue / Wave / priority
- `AWAITING_PUSH` を介した通常Work push relay
- Repair worker終了後の多段Return dispatch待ち
- 定期watchdogを通常修復の必須起動条件にする構成

既存の旧scriptやRescue stateに互換データが残っていても、それをFast Laneのmerge権限や通常Repairの進行条件には使わない。診断・移行目的のコードは段階的に削除できる。

## 例外と安全性

- explicit holdは解除しない
- Changes requested / unresolved threadは迂回しない
- dependency未完了はmergeしない
- current exact-head fast evidenceなしではmergeしない
- control-plane / overlapping scopeはexact-head trusted reviewを維持
- automated stack reconciliation後のvalidationはPR番号・expected headを受け取っても、実行直前にcurrent open/non-Draft/base/same-repository/head一致を再確認する
- stale statusだけではtrusted stack evidenceと扱わない。run identity、artifact、job successを再検証する
- developが外部更新されたらそのpassを停止してcurrent stateから再開
- main / Production gateは変更しない

## 受入条件

- 正常Ready PRはRepair/Rescue stateを経由せず `Validate and build -> Fast Lane -> merge` で流れる
- A失敗中でもB/C成功ならB/Cがmergeされる
- DEV/browserが数分かかってもmerge laneは前進する
- normal Integration topologyはFast Lane writer + optional Repair executorだけ
- repairableなstack/base更新は同じtrusted Repair runで更新・exact-head fast validation・Fast Lane wakeまで完結する
- `AWAITING_PUSH` や1時間watchdogが通常Repairの待ち時間にならない
- stale DEV push publicationはlatest developへcoalesceする
- current head/review/dependency/hold/mergeabilityの再読を省略しない
- Actions botがdependency reconciliationでReady PR headを更新しても、人間の空commitやApprove-and-runなしでcurrent exact-head fast validationが開始される
