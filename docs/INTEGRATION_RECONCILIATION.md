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
   - 機械的に解けない衝突はdeep repairへ送り、AIが確定仕様への適応を検討する。human-requiredは実行ポリシーの例外条件に限定する。

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

## merge後のdependent chain wake

Fast Laneが1件以上mergeしたpassは、そのmergeで新たにdependency条件を満たしたReady PRを取りこぼさないため、current `develop` に対して `rescue_mode=scan` を1回だけ即時dispatchする。次のscanは通常のFast LaneとFast Repairを再評価し、stacked PRならmerge-forward・exact-head fast validation・Fast Lane wakeまで進める。

この継続wakeは永続queueやpollingではない。各passでmergeが0件なら連鎖を終了し、mergeが続く間だけ次のbounded scanを生成する。これにより `#parent -> #child -> #grandchild` のような依存列を定期watchdog待ちにせずイベント駆動で連続消化する。single develop writer、current state再読、hold/review/dependency/exact-head gateはそのまま維持する。

## browser / repair

`Affected browser smoke` はFast Laneと並行して実行する。失敗結果は既存browser repair ticketへ記録する。assertion削除、検証条件の弱体化、無制限retryは禁止。

stack reconciliation由来headも同じくbrowser smokeを別matrixで後追いし、Fast Laneを待たせない。結果は通常のbrowser repair recorderへ返す。

DEV公開後のfocused browserも同様にdelivery health / repair evidenceとして維持する。

## deep repair / human-required

同一fileや関連契約の意味衝突など、機械的なmerge-forwardだけでは安全を証明できないものはFast Lane内で無理に直さない。既存ChatGPT Work等のdeep repairへhandoffし、両側の確定仕様・review・test coverageを調べて元PR branchを修復する。最新の確定仕様に古いPRの改善意図を適応し、可逆的な細部はAIが決めて通常gateを通す。DEV公開後にユーザーが実物を確認する流れを標準とし、技術的難しさや目視未確認だけで人待ちにしない。

明示hold、Changes requested、未解決thread、未承認の不可逆な変更や互換性を壊すschema/save/protocol選択、main / Productionは自動Repairで解除・変更しない。仕様によるhuman-requiredは [実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md#devで実物を確認する標準開発) の根拠記録を満たす場合に限定する。deep repairの実行手段がない場合は実行経路の障害として根拠と復旧手段を記録し、仕様の承認待ちと混同しない。正常PRのmerge laneは継続する。

## DEV Publisher

Fast Laneのbot merge後は`GITHUB_TOKEN`によるpush連鎖を期待せず、最新developへ`deploy.yml`の`publish_only=true`・`automatic_publish=true`を明示dispatchする。公開要求処理は古いpush/自動公開runを取り消し、同じSHAの稼働中publisherへ重複要求しない。通常pushの`DEV Publisher Coalescer`も維持する。

workflow_dispatchのIntegration/repair/手動公開runはcoalescer対象外。自動公開は専用run titleで識別する。publish step自身も公開前にcurrent developを確認し、古いsnapshotを昇格させない。公開要求の記録がない既存の未公開SHAは次回Fast Laneで補完し、要求失敗は専用statusとrun失敗へ記録する。

## API予算とwakeの集約

GitHub APIは安全確認のためのcurrent-state再取得へ使い、同じ状態に対する重複wake・重複一覧取得には使わない。Fast Laneのmerge直前再確認やexact-head gateは削減対象にしない。

- Ready時はhandoff記録と通常Fast Lane起動を正規経路とし、同じReadyイベントから互換Rescue scanを重ねてdispatchしない。
- browser結果はrepair recorderへ渡すが、Fast Laneがbrowser非blockingになった後の互換Integration wakeは追加しない。
- workflow run一覧はstatusごとに同じendpointを複数回読むのではなく、boundedな1回の一覧を取得してローカルでactive stateを分類する。
- DEV Publisherのcoalescerも同じ一覧再利用を行い、古いpush由来runだけを取消す既存安全条件を維持する。
- 定期watchdogは通常処理の起点にしない。イベント取りこぼしの復旧時計として低頻度に限定し、依存列はmerge後の即時bounded wakeで消化する。
- PULSEのGitHub同期はブラウザ閲覧数から独立させ、Actionsから渡せる一時`GITHUB_TOKEN`をイベント同期で優先する。匿名定期同期だけを高頻度化してprimary rate limitへ近づけない。
- PULSEの古さは固定短周期Cronの不在だけで異常扱いせず、イベント同期失敗・rate-limit/backoff・期待される更新の欠落を区別する。公開データの正本性を推測で上書きしない。

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
- Fast Laneがmergeしたら次の`rescue_mode=scan`を即時wakeし、mergeが0件になるまで新たにunblockされた依存列をboundedに再評価する
- `AWAITING_PUSH` や1時間watchdogが通常Repairの待ち時間にならない
- stale DEV push publicationはlatest developへcoalesceする
- Ready/browser互換wakeは通常Fast Laneへ重複dispatchしない
- active publisher/coalescerのworkflow run一覧はstatus別の重複取得をしない
- 定期watchdogは低頻度の復旧時計に限定する
- PULSEは匿名GitHub APIの高頻度全量同期に依存せず、イベント同期と失敗状態を区別する
- current head/review/dependency/hold/mergeabilityの再読を省略しない
- Actions botがdependency reconciliationでReady PR headを更新しても、人間の空commitやApprove-and-runなしでcurrent exact-head fast validationが開始される