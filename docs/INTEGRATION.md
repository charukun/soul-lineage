# develop Integration Fast Lane

## 目的

Integration は [`ASTRA_OUTCOME_CONTRACT.md`](ASTRA_OUTCOME_CONTRACT.md) の `READY` を受け取り、**人間やAstraの意味判断を再実装せず、機械的に証明できる最後の原子性だけを守る deterministic layer** とする。

通常の develop Integration は PR 単位で最低限守り、通るものから即流す。別PRの失敗やDEV公開を独立PRのmerge lockにしない。通常developの自動CIはtest-free、browserはopt-in。semantic validation は Ready 前の Astra、重い品質認定は明示検証または main / Production が担当する。

## Outcome handoff

正常な Ready PR は次を前提にする。

- worker-facing state は `READY`。
- Ready直前に観測した current `develop` を work head が ancestry に含む。
- final reconciled exact head に必要十分な semantic evidence がある。
- validated head と pushed head が一致する。
- unresolved product choice がない。

Draft は optional `WORKING` transport であり、Integration の prerequisite ではない。短寿命workerが最終 outcome 完成後に Ready PR を直接作ってもよい。worker側の細分類やroute名を Integration の入力契約にしない。

```text
Astra WORKING
  -> final reconcile + sufficient evidence
  -> READY PR
       -> Validate and build (DEV tests=0)
       -> exact-head pr-fast artifact
       -> Fast Lane
            current develop unchanged -> serialized expected-head / CAS merge
            develop advanced after Ready + mechanically safe -> Fast Repair
            semantic/source repair required -> same PR returns to WORKING via Chat Repair handoff
       -> develop
       -> latest-only DEV publication / source verification
```

## merge前の必須条件

Fast Lane はmerge直前にcurrent GitHub stateを再取得し、次をすべて満たす exact head だけをmergeする。

- open / non-Draft / base=`develop`
- same repository / trusted author
- `integration:hold` / `integration:manual` / `do-not-merge` / `Integration-Hold:` なし
- `Depends-On` 完了
- GitHub mergeable
- Changes requestedなし / unresolved review threadなし
- **current exact head** の `Validate and build` 成功
- 同じ PR/head の `pr-fast-<PR>-<SHA>` artifact
- control-plane変更はcurrent exact-head trusted review条件を維持

`Validate and build` のdevelop契約はtest-freeであり、exact-headの差分衛生、syntax/static、code-health、必要なbuild可否を確認する。Astraが行ったsemantic testの代替ではない。merge APIにはcurrent exact head SHAを渡し、develop writerはsingle serialized laneとする。force push / history rewriteはしない。

Ready前にworkerがfreshnessを確認しても、Readyとmergeの間には必ずraceが残る。したがって current-state re-fetch と expected-head/CAS merge は削除しない。

## Fast Repair

Fast Repair は worker が省略した通常作業を肩代わりする第二実装工程ではない。扱うのは handoff **後** に発生した mechanically safe な変化だけ。

例:

- Ready後に別PRがdevelopへmergeされた。
- dependency PRがmergeされ、base ancestryだけ更新すればよい。
- scope-disjointなdevelop driftをcurrent stateから機械的に安全と証明できる。

実行直前に PR/head/develop、Draft、repository、author、hold、review、Depends-On を再確認し、同じ source branch を merge-forwardする。更新後は trusted exact-head DEV checks/build (tests=0) と `pr-fast-<PR>-<SHA>` evidence を作り Fast Lane をwakeする。

same-file semantic conflict、true merge conflict、source-level修復が必要なDEV check/build failureをGitHub Actionsがours/theirsで選ばない。これらは同じ source PR を implementation ownershipへ戻す。

## Semantic repair

Deep/Chat RepairはバックグラウンドAI workerではない。current exact headごとに1件だけ owner 通知 Issue を作り、通常Chatで current PR head / latest develop を再取得して修復する。

修復Chatは recorded SHA を盲信せず、PR側・develop側・現在契約を読み、第三の意味解を作る。blind ours/theirs、blind cherry-pick、assertion削除、gate弱体化は禁止。

修復中の outcome は `WORKING`。同じ source branch に修正し、current develop とreconcileした final headに必要な semantic evidence を実行し、push後に `READY` / `READY_FOR_INTEGRATION` へ戻す。ChatはCI/DEVを待機・pollingしない。

current repository contracts から解けない schema/save/protocol/API、権限、不可逆選択などだけを `BLOCKED` / human-required とする。同file競合・技術的難しさ・未実施visual確認だけで human-required にしない。

Integration復旧で ChatGPT Work、Codex、OpenAI API、追加有料モデルAPI、専用PATを自動起動/fallback/watchdogに使わない。

## develop CI: tests=0 / browser opt-in

通常develop PRとFast Repairの自動gateは `node --test` を常時実行しない。trusted control checkoutから static checks / code-health / 必要 build を行う。test資産は削除せず、Ready前のAstra evidence、明示full verification、main / Productionで使う。

browser検証は次だけで行う。

- ユーザーがブラウザ操作 / playtest / visual確認を明示した場合
- `full_verification=true`
- motion / Visual Review等の専門workflowが evidence として要求する場合
- main / Production blocking gate

明示browser検証が失敗しても assertion削除や恣意的timeout延長で通さない。

## DEV deliveryはmerge healthと分離

`integration/develop` は DEV delivery health であり、通常PRのglobal merge lockではない。

- `pending`: DEV公開/source verification中
- `success`: そのdevelop SHAのDEV公開とsource確認成功
- `failure`: そのdevelop SHAのDEV delivery/source確認失敗。delivery repair対象だが独立Ready PRを止めない

DEV publication、candidate manifest、HTTP/source照合、LKG rollbackは維持する。通常develop deliveryの成功条件にtest/browser結果は含めない。

## latest-only DEV Publisher

Fast Laneのmerge batch完了後は最新developを対象に publisher をwakeする。同一SHAの重複publisherを増やさず、古い自動publisherはlatest developへcoalesceする。publish直前にdevelop SHAを再確認し、superseded snapshotをpublicへ昇格させない。

publication wake失敗をmerge成功と混同しない。通知失敗もadvisoryでありmerge判定を変更しない。

## 独立PRを止めない

Fast LaneはPR単位で評価する。

```text
A: exact-head source failure -> Aだけ WORKING / Chat Repair
B: exact-head gate success   -> merge
C: exact-head gate success   -> merge
```

explicit hold、dependency、review objection、merge conflict、exact-head DEV failureは対象PRだけを止める。develop writer自体が予期せず動いた場合のみ current state から再評価する。

## PULSE state mapping

利用者向けPULSEでは worker mental model を `WORKING / READY / BLOCKED` に保つ。

- Draft または source exact-head failureでimplementation ownershipに戻ったもの: `WORKING`
- Ready後の CI / Fast Lane / mechanical repair / dependency wait: `READY`
- explicit holdなど、人間介入がGitHub stateから確認できるもの: `BLOCKED`

Fast Lane、Repair、Reconciliation、CI phaseは技術詳細として表示してよいが、トップレベルの追加ライフサイクル状態にはしない。

## main / Production

このFast Laneはdevelop専用。main / Productionのtest/full regression、blocking browser、public source確認など既存品質gateは変更しない。Productionへの昇格は明示許可がある場合のみ。

## 通知

`INTEGRATED` と `DEV_DEPLOYED` は別イベントとして扱う。semantic repairはGitHub Issue assignment/mentionで owner に通知し、独自SMTP・外部メールサービス・第二queueを追加しない。同じexact headは1 Issueだけ。

ユーザーが修正依頼した内容のDEV反映連絡も既存GitHub PR購読メールを利用する。詳細は [`DEV_NOTIFICATION.md`](DEV_NOTIFICATION.md)。

## 受入条件

- Ready入力は Astra Outcome Contract を満たす final reconciled exact head
- optional Draft や worker側のroute分類を Integration prerequisite にしない
- `Validate and build (tests=0) -> Fast Lane -> serialized expected-head/CAS merge` を維持
- Fast RepairはReady後の mechanically safe な race/base driftだけを扱う
- semantic/source repairは同じPRを `WORKING` に戻す
- human-required / `BLOCKED` は真の外部判断だけ
- normal developはtests=0 / browser opt-in、Production品質gateは不変
- one PR failure does not block independently eligible PRs
- DEV publisherはlatest-onlyへ収束
- main / Production品質gateは不変
