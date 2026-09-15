# Integration Fast Lane Reconciliation

## 目的

Integrationの正本はGitHub current stateだけにする。Planner、通常Virtual Train、DEV health global lockを通常経路から外し、イベントごとにReady PRを再読して **通るPRだけ即merge** する。

新しいTask-ID、外部DB、独自永続queueは作らない。

## 原則

1. **Events are wake signals**
   - Ready、exact-head fast CI完了、review/label変更、repair scanなどはFast Laneを起こすだけ。
   - event payloadをmerge可否の正本にせず、PR/develop/review/checkをGitHubから再取得する。
   - GitHub Actionsの`GITHUB_TOKEN`でstacked Ready PRのheadを更新した場合は、再帰的な`pull_request/synchronize`起動に依存しない。更新直後のcurrent PR/headを再取得して、trustedなexact-head fast validationを明示的に起動する。
2. **One failed PR never freezes independent PRs**
   - fast failure、browser failure、hold、dependency、review objectionはそのPRだけを保留する。
3. **Single develop writer**
   - develop mutationは`integration-controller-develop`で直列化し、merge直前にdevelop SHAとPR exact headを再取得する。
4. **Fast check before merge, browser after/alongside it**
   - merge条件はcurrent exact-head `Validate and build` + `pr-fast` artifact。
   - browser smokeは継続するが通常mergeを待たせない。
5. **DEV health is not merge health**
   - `integration/develop`はDEV deliveryの状態。pending/failureでも通常Ready PRをglobal blockしない。
6. **Repair is an executor, not another queue**
   - Rescueは壊れたPR/DEVを直す。正常PRの流れを所有しない。

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

## browser / repair

`Affected browser smoke` はFast Laneと並行して実行する。失敗結果は既存browser repair ticketへ記録する。assertion削除、検証条件の弱体化、無制限retryは禁止。

DEV公開後のfocused browserも同様にdelivery health / repair evidenceとして維持する。

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

既存の旧scriptやRescue stateに互換データが残っていても、それをFast Laneのmerge権限には使わない。後方互換・診断目的のコードは別途整理できる。

## 例外と安全性

- explicit holdは解除しない
- Changes requested / unresolved threadは迂回しない
- dependency未完了はmergeしない
- current exact-head fast evidenceなしではmergeしない
- control-plane / overlapping scopeはexact-head trusted reviewを維持
- automated stack reconciliation後のvalidationはPR番号・expected headを入力として受けても、実行直前にcurrent open/non-Draft/base/same-repository/head一致を再確認する
- developが外部更新されたらそのpassを停止してcurrent stateから再開
- main / Production gateは変更しない

## 受入条件

- A失敗中でもB/C成功ならB/Cがmergeされる
- DEV/browserが数分かかってもmerge laneは前進する
- normal Integration topologyはFast Lane writer + optional repair executorだけ
- stale DEV push publicationはlatest developへcoalesceする
- current head/review/dependency/hold/mergeabilityの再読を省略しない
- Actions botがdependency reconciliationでReady PR headを更新しても、人間の空commitやApprove-and-runなしでcurrent exact-head fast validationが開始される
