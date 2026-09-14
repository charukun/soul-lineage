# Integration Flow Control

Ready PRの流入量がIntegration / Rescueの処理能力を上回っても、開発全体を自己渋滞させないための制御面。

## Queue pressure / Backlog Burn-down

`flowPressure()` の正本閾値:

- Ready/AI-repair demand 0〜4: `NORMAL`
- 5〜9: `BUSY`
- 10以上: `BURN_DOWN`

BUSY以上では非緊急な自動Code Health PR生成を止める。Ready件数を取得できない場合もfail-closedで生成しない。BURN_DOWNでは古いReadyから走査する。

## Dependency critical path

`Depends-On:` をDAGとして読み、あるPRを先に入れることで後続何件を解放できるかを`unblockCount`として計算する。Rescue返却headと`integration:repair`を最優先に維持した上で、依存チェーンの根にbounded boostを付ける。

循環・不正依存は従来どおりRescue safetyで停止する。依存を無視して子PRを先にmergeすることはない。

## Validated Virtual Integration Train

通常Integrationのreview/check/dependency/exact-head gate、merge API、develop最終検証は変更しない。

BUSY/BURN_DOWN時、次の条件を満たす独立PRを最大2〜5件、一時branch `automation/integration-train-*` 上でGitHub merge engineにより順番に合成する。

- same-repository Ready PR
- review / hold / dependency safetyを再確認済み
- 各exact headのfast/browser gateが成功済み
- Quarantineではない
- Rescue stateに完全scope証拠があり、独立PR同士が`GREEN`

合成後、synthetic treeに対して`validate.mjs fast`とaffected Chromium smokeを実行する。両方成功し、かつdevelop baseと全候補headが変わっていない証拠だけを`validated` TrainとしてRescue stateへ保存する。一時branchは成功・失敗・例外を問わず削除する。

Validated TrainはIntegrationの評価順を改善するだけであり、各PRの最終review/check再読、exact SHA merge、develop DEV/browser gateを省略しない。developが1commitでも動けば証拠は自動失効する。

## Stack Auto-Reconciler

`Depends-On:` の全親PRがdevelopへmerge済みになったstacked PRは、trusted Rescue Return laneだけが最新developをfeature branchへ通常mergeする。force push/rebaseはしない。

書込み前にPR head、develop SHA、Draft/hold、review、未解決thread、dependency、mergeabilityを再取得する。競合した場合はbranchを書き換えずRescueへ残す。Queue Recoveryは候補検知だけで、contents write権限を持たない。

## Quarantine Lane

同一headでobservation-only churnを除いた意味のある修復失敗が3回以上あり、少なくとも2種類の失敗原因があるPRはQuarantine対象とする。

Quarantineは破棄ではない。通常Integration Train / Queue Recoveryのwakeから隔離し、`integration/quarantine=pending`として深いAI修復の対象にする。新しいheadへ進み、過去の失敗証拠と一致しなくなれば通常評価へ戻せる。Human-required判断はQuarantineで自動解除しない。

## Semantic supersession

既存のexact-ancestor自動closeに加え、72時間超のstale Readyについてboundedにcontent supersessionを確認する。

AIの類似判定では閉じない。PR changed-filesが完全取得でき、PR headと現在developの各touched pathについて`mode:type:blob SHA`が全件完全一致した場合だけ`SUPERSEDED`でcloseする。head/developを直前再取得し、review/hold/dependency safetyも再確認する。

## Recoverable manualの即時signal

#217の`workRepairEligibility()`を唯一の判定として、recoverable `FAILED_MANUAL` がoutboxへ到達した時点でPRへ冪等な`AI_REPAIR_REQUIRED` marker/commentと、head SHAへ`integration-rescue/work-repair=pending`を記録する。既存定期`Integration Rescue 復旧` Workはdurable backstopとして残す。

## Bounded adaptive tuning

固定ギアではなく、Ready demand、全配送ledgerのp95、最近のfailure率、GitHub API残量から次の範囲だけを選択する。

- Virtual Train: 2〜5 PR
- Rescue worker: 3〜6
- Rescue evaluation: 12〜24

API余力が小さい、またはfailure率が25%以上なら下限へ縮退する。BURN_DOWNかつDraft→DEV p95が20分以上なら上限まで広げる。scan 60秒、queue stall 5分、retry 2分などの安全時間は固定する。Runtime auditはこのbounded range外をfailureとする。

## CI coalesce

CIは既存の`ci-<PR>-<validation|observation>` concurrencyと`cancel-in-progress: true`を維持する。同じPR/purposeの旧runだけを置換し、validationとobservationは相互cancelしない。

## Rescue state / delivery ledger

`RescueStore.mutate()`はCAS保存前に`compactRescueState()`を通す。

- `MERGED`はDEV確認まで残す。
- `DEV` / `CLOSED`の48時間超は件数集約。
- recoverable `FAILED_MANUAL`は消さず、大きな`baseChanges`のみ件数へ圧縮。
- completed wave最大48、activity 24時間/400件、outbox 24時間/120件。
- 全Ready PRの配送ledgerは最大120件/7日。Draft PR作成時刻をRepository上の実装開始基準、Ready初回観測、merge、verified DEVを記録する。
- 既存900KB state hard budgetを維持する。

## PULSE flow metrics

PULSEは全配送ledgerから次を表示する。

- Draft → Ready: p50 / p95
- Ready → Merge: p50 / p95
- Merge → DEV: p50 / p95
- Draft → DEV: p50 / p95
- NORMAL / BUSY / BURN_DOWN
- 現在のworker/evaluation/Train tuning
- Validated Virtual Trainと候補PR
- Quarantine件数
- 最大の現在bottleneck

Repository運用ではコード変更前にDraft PRを作るため、Draft作成時刻を`implementationStartedAt`として使う。これはユーザーがChatで依頼した瞬間そのものではないため、PULSE上でも「Draft→DEV」と明記する。

## Safety

main / Production、review/Changes requested、未解決thread、explicit hold、browser repair ownership、schema/save/protocol等のproduct decision、fast/browser/DEV gateは変更・弱体化しない。Virtual Train、Critical Path、Stack Reconciler、Quarantine、semantic supersession、adaptive tuningはいずれも最終merge safetyの代替ではない。