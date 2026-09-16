# develop Integration Fast Lane

## 目的

通常の develop Integration は **PRで最低限守り、通るものから即流す**。DEV公開や、別PRの失敗を通常merge laneへ伝播させない。通常developのブラウザ検証はopt-inとし、古いUI契約や表示タイミングだけで自動CIを赤くしない。

実装セッションの終了条件は [実行ポリシー](RINNE_PROJECT_EXECUTION_POLICY.md)。通常実装は Draft PR → 実装 → 高速検証 → push → Ready → `READY_FOR_INTEGRATION` で終了し、CI/DEV完了を待機・pollingしない。

## 通常経路

```text
Ready PR
  -> Validate and build
  -> exact-head pr-fast artifact
  -> Fast Lane
       success -> serialized expected-head merge
       mechanically repairable -> Fast Repair (GitHub Actions)
            -> exact-head fast validation -> Fast Lane wake
       semantic/unsafe -> owner-notified Chat Repair Issue / HUMAN_REQUIRED
  -> develop push
  -> DEV Publisher
  -> candidate manifest / public HTTP + source verification
```

通常経路ではPR browser smoke、DEV candidate browser、DEV post-publish browserを自動実行しない。ブラウザ検証は明示依頼、`full_verification=true`、専門workflowのevidence契約、main / Productionでだけ実行する。

正常PRはFast Repairを通らない。Fast Repairは第二のmerge queueではなく、Fast Laneの横にある短命executorだけとする。Chat repair待ちのPRは独立eligible PRを止めない。

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

## Fast Repair

`rescue_mode=scan` は既定branch互換のwake入力として残すが、通常経路では旧RescueのCoordinator/Wave/claim/heartbeat/`AWAITING_PUSH`/Work push relay/Return queueを使わない。

Fast Repairが扱うのは、依存PRのmerge後に最新developを取り込むなど **機械的に安全性を証明できるstack/base更新** だけ。実行直前にcurrent PR/head/develop、Draft、repository、author、hold、review thread、Depends-Onを再確認し、元PR branchへ通常のmerge-forwardを行う。更新後は同じtrusted runでexact-head fast validationを行い、`integration/stack-fast` と `pr-fast-<PR>-<SHA>` の実証拠を作ってFast Laneを即wakeする。

Fast Repairのmerge成功直後にPR情報が旧headを返す場合は、元headから変わっていない安全条件と実branch refを照合し、返却されたmerge SHAへの更新を確認できた場合だけ検証へ進める。別writerのhead・Draft・hold・依存本文変更は採用しない。

同一fileや契約の意味衝突、true merge conflict、source-level修復が必要なexact-head CI failureはGitHub Actionsが片側を選ばず、[Deep Repair / Chat handoff](INTEGRATION_DEEP_REPAIR.md) へ送る。

## semantic repairはWorkを使わない

Deep RepairはバックグラウンドAI workerではない。Fast Laneがcurrent exact headごとに1件だけGitHub Issueを作り、ownerへ既存GitHub通知を送る。Issueには `integration-deep-repair:v1`、`chat-repair:v1`、PR/head/develop/reasonと、**通常Chatへそのまま貼れる復旧prompt**を含める。

通知を受けたユーザーが通常Chatを手動開始した場合だけ修復する。Chatはrecorded SHAを正本にせずcurrent PR head / latest developを再取得し、PR側・develop側の意図と確定契約を読み、双方を両立できる第三の修復を作る。無条件ours/theirs、blind cherry-pick、assertion削除、品質gate弱体化は禁止。

修復は同じsource PR branchだけへpushし、focused checks / fast validation後にReady / `READY_FOR_INTEGRATION`へ戻す。通常git → 接続済みGitHub API → 必要時のみ同branchの既存Codespaces＋通常gitの順で反映する。ChatはCI/DEVを待機・pollingしない。

Integration復旧では ChatGPT Work、Codex、OpenAI API、追加有料モデルAPI、専用PATを自動起動・fallback・watchdogに使わない。旧Work repair文書/scripts/stateは互換・履歴参照用であり現行実行経路ではない。

current repository contractsから解けないschema/save/protocol/API等の真のproduct choiceだけを `human-required` とする。同file競合・技術的難しさ・目視未確認だけでhuman-requiredにしない。

## browserはdevelopでopt-in

通常のdevelop PRでは `Affected browser smoke` を自動実行しない。通常DEV Publisherでもgameplay/WebGL browser verificationを自動実行しない。

ブラウザ検証は次の場合だけ行う。

- ユーザーが明示的にブラウザ操作・playtest・確認を依頼した場合
- `deploy.yml` を `full_verification=true` で明示実行した場合
- motion / Visual Review等の専門workflowが自身のevidence契約として必要とする場合
- main / Productionのblocking gate

明示ブラウザ検証が失敗した場合も、assertion削除や恣意的timeout延長で通すことは禁止。true source semantic repairが必要ならnormal Chat handoffへ送る。過去の `browser-repair:v1`、`pr-browser-*`、`dev-browser-*` は履歴証拠であり、通常developの自動実行トリガーにしない。

## DEV deliveryはmerge healthと分離する

`integration/develop` は **DEV delivery health** であり、通常PRのglobal merge lockではない。

- `pending`: DEV公開・source検証中
- `success`: そのdevelop SHAのDEV公開とHTTP/source確認成功
- `failure`: そのdevelop SHAのDEV delivery/source確認失敗。repair対象だが独立Ready PRのmergeは止めない

DEV側の公開・候補manifest・HTTP/source照合・LKG rollbackは維持する。通常develop deliveryの成功条件にbrowser結果は含めない。

## latest-only DEV Publisher

Fast Laneが`GITHUB_TOKEN`でmergeした更新は`push` workflowを連鎖起動しないため、merge batch完了時に最新developを対象とする`deploy.yml`の`publish_only=true`を明示dispatchする。公開要求の受理と公開検証成功を区別し、dispatch失敗を成功扱いしない。

自動公開要求は同じSHAの実行中publisherへ重複要求せず、古い自動publisherはlatest developへまとめる。通常Integration、repair、人が開始した公開、main/Production runは取消対象にしない。publish直前にdevelop SHAを再確認し、superseded snapshotをpublicへ昇格させない。

## 1件の失敗で全体を止めない

Fast LaneはReady PRをPR単位で評価する。

```text
A: exact-head fast failure -> AだけChat repair/保留
B: exact-head fast success -> merge
C: exact-head fast success -> merge
```

explicit hold、dependency、review objection、merge conflict、exact-head fast failureは対象PRだけを止める。developが外部writerで予期せず移動した場合のみ、そのFast Lane passを停止してcurrent stateから再評価する。

## Draft / Ready

Draftではlightweight checkのみ。Readyになると `Validate and build` を開始する。**Request Integrationはbuild成功・失敗の直後に起動し、browser jobは通常develop経路に存在しない。** current exact-head source repairが必要な失敗はChat Repair Issueへ送る。

## main / Production

このFast Laneはdevelop専用。main / Productionのblocking browser、full regression、public source確認などの品質gateは変更しない。Productionへの昇格は明示許可がある場合のみ。

## 通知とPULSE

`INTEGRATED` と `DEV_DEPLOYED` は別イベントとして扱う。通知失敗はadvisoryでありmerge/publication判定を変更しない。PULSEはmerge状態とDEV delivery healthを混同しない。

意味的競合のChat修復要求はGitHub Issue assignment/mentionを使い、既存GitHub通知メール経路でownerへ届ける。独自SMTP・外部メールサービス・通知queueは追加しない。同じexact headは1 Issueだけで重複通知を防ぐ。メール配送可否はownerのGitHub通知設定に従う。

ユーザーが修正依頼した内容のDEV反映連絡も既存GitHub PR購読メールを利用する。詳細は [開発中のDEV反映メール通知](DEV_NOTIFICATION.md) を参照する。

## 受入条件

- 正常Ready PRはRepair stateやWorkを経由せず `Validate and build -> Fast Lane -> merge` で流れる
- mechanically repairableなstack/base更新はGitHub Actionsだけで更新・検証・Fast Lane wakeまで進む
- semantic conflict / source-level CI repairはexact headごとに1件だけowner通知Chat Repair Issueを作る
- 通知Issueに通常Chat用promptがあり、修復時はcurrent GitHub stateを再取得する
- `AWAITING_PUSH` / Work relay / periodic Work watchdogを通常Repairの待ち時間にしない
- normal developでbrowserはopt-in、明示full verificationとProduction browser gateは維持
- develop writerはsingle expected-head writer
- stale DEV push publisherはcancel/coalesceされlatest developへ収束する
- ChatGPT Work / Codex / OpenAI API / paid fallbackなし
- main / Production品質gateは不変