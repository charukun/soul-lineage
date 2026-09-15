# develop Integration Fast Lane

## 目的

通常の develop Integration は **PRで最低限守り、通るものから即流す**。DEV公開/browserの遅さや、別PRの失敗を通常merge laneへ伝播させない。

実装セッションの終了条件は [実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md)。通常実装は Draft PR → 実装 → 高速検証 → push → Ready → `READY_FOR_INTEGRATION` で終了し、CI/DEV完了を待機・pollingしない。

## 通常経路

```text
Ready PR
  -> Validate and build
  -> exact-head pr-fast artifact
  -> Fast Lane
       success -> serialized expected-head merge
       failure -> そのPRだけ保留/repair
  -> develop push
  -> DEV Publisher
  -> public/browser smoke
       failure -> repair ticket
```

### merge前の必須条件

Fast Laneはmerge直前にcurrent GitHub stateを再取得し、次をすべて満たすPRだけをmergeする。

- open / non-Draft / base=`develop`
- same repository、trusted author
- `integration:hold` / `integration:manual` / `do-not-merge` / `Integration-Hold:` なし
- `Depends-On` 完了
- GitHub mergeable
- Changes requestedなし、未解決review threadなし
- **current exact head** の `Validate and build` が成功
- 同じPR/headの `pr-fast-<PR>-<SHA>` artifactが存在
- `.github/**` / `scripts/**` / Integration文書などcontrol-plane変更はcurrent exact-head trusted review条件を維持
- develop進行後に重複scopeが生じた場合も既存review条件を維持

merge APIにはcurrent exact head SHAを渡す。develop writerは単一laneで、force pushやhistory rewriteをしない。

## browserはmerge laneを止めない

`Affected browser smoke` は削除しない。CIで継続実行し、成功/失敗をbrowser repairへ記録する。ただし通常develop mergeの前提にはしない。

したがってPR Aのbrowser失敗・timeout中でも、PR Bがexact-head fast条件を満たすならBはmergeできる。assertionを削除したりtimeoutを恣意的に伸ばして通すことは禁止のまま。

## DEV deliveryはmerge healthと分離する

`integration/develop` は **DEV delivery health** であり、通常PRのglobal merge lockではない。

- `pending`: DEV公開・検証中
- `success`: そのdevelop SHAのDEV公開/source/browser確認成功
- `failure`: そのdevelop SHAのDEV delivery/browser失敗。repair対象だが、独立Ready PRのmergeは止めない

DEV側の公開・HTTP/source照合・focused browser・LKG rollbackは維持する。失敗時はmachine-readable repair ticketを更新する。

## latest-only DEV Publisher

Fast Laneが`GITHUB_TOKEN`でmergeした更新は`push` workflowを連鎖起動しない。mergeしたbatchの完了時に、最新developを対象とする`deploy.yml`の`publish_only=true`を明示的にdispatchし、DEVとPULSEを非同期で公開する。公開要求の受理と公開検証の成功は区別し、dispatch失敗を黙って成功扱いしない。

自動公開要求には専用の識別子を付け、同じSHAの実行中publisherへ重複要求しない。古い自動publisherはlatest developへまとめるが、通常のIntegration、repair、人が開始した公開、main/Productionの実行は取り消さない。公開完了の待機はmerge laneへ持ち込まない。

develop pushごとに `deploy.yml` は起動するが、`DEV Publisher Coalescer` が古い **push由来** publisher runを取消し、最新developへ収束させる。Integrationのworkflow_dispatchやrepair runは巻き込まない。

publish自身も公開直前にdevelop SHAを再確認するため、superseded snapshotをpublicへ昇格させない。

## 1件の失敗で全体を止めない

Fast LaneはReady PRをPR単位で評価する。

```text
A: exact-head fast failure -> Aだけ保留/repair
B: exact-head fast success -> merge
C: exact-head fast success -> merge
```

explicit hold、dependency、review objection、merge conflict、exact-head fast failureは対象PRだけを止める。developが外部writerで予期せず移動した場合のみ、そのFast Lane passを停止してcurrent stateから再評価する。

## Rescue

Rescueは第二のmerge queueではなくrepair executorとして扱う。通常merge判定はFast LaneがGitHub current stateから行う。`rescue_mode=scan` は修復executorを起動できるが、修復中PRが他の独立PRをglobal lockしない。

## Draft / Ready

Draftでは lightweight checkのみ。Readyになると `Validate and build` とbrowser smokeを開始する。**Request Integrationはbuild成功直後に起動し、browser完了を待たない。** browserは並行してrepair evidenceを残す。

## main / Production

このFast Laneはdevelop専用。main / Productionのblocking browser、full regression、public source確認などの品質gateは変更しない。Productionへの昇格は明示許可がある場合のみ。

## 通知とPULSE

`INTEGRATED` と `DEV_DEPLOYED` は別イベントとして扱う。通知失敗はadvisoryでありmerge/publication判定を変更しない。PULSEはmerge状態とDEV delivery healthを混同せず表示する。

## 受入条件

- `integration/develop=pending|failure` 中でもeligible Ready PRをmergeできる
- Aのfast/browser失敗がB/Cを止めない
- exact-head `Validate and build` とartifactなしではmergeしない
- browser test自体は維持し、失敗をrepairへ送る
- develop writerはsingle expected-head writer
- stale DEV push publisherはcancelされ、最新developへ収束する
- main / Production品質gateは不変
