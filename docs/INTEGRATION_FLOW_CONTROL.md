# Integration Flow Control

Ready PRの流入量がIntegration / Rescueの処理能力を上回っても、開発全体を自己渋滞させないための制御面。

## Queue pressure / Backlog Burn-down

`flowPressure()` の正本閾値は次のとおり。

- Ready/AI-repair demand 0〜4: `NORMAL`
- 5〜9: `BUSY`
- 10以上: `BURN_DOWN`

BUSY以上では非緊急な自動Code Health PR生成を止める。Ready件数を取得できない場合もfail-closedで生成しない。監査そのものは継続する。
BURN_DOWNではQueue Recoveryの走査を最古Readyから開始し、既存のexact-ancestor証明が成立するPRだけ`SUPERSEDED`で自動closeする。72時間超で未包含のReadyは`STALE_READY_AI_REVIEW_CANDIDATE`として診断に残し、勝手にcloseしない。

## Integration Train

通常Integrationのreview/check/dependency/exact-head gate、merge API、develop最終検証は変更しない。Rescue stateに完全なscope証拠があるReady PRだけを対象に、`compareScopes()` が互いに`GREEN`となる最大5件をTrain先頭へ並べる。

`integration:repair` とRescueから戻ったexact headはTrainより先に扱う。scope不明、同file、control plane、contract/shared consumer等のRED/YELLOWは従来の順序と再評価へ残す。Trainはmerge bypassではなく、安全な評価順最適化である。

## Recoverable manualの即時signal

#217の`workRepairEligibility()`を唯一の判定として、recoverable `FAILED_MANUAL` がoutboxへ到達した時点でPRへ冪等な`AI_REPAIR_REQUIRED` marker/commentと、head SHAへ`integration-rescue/work-repair=pending`を記録する。

これによりGitHub PRイベントを購読する既存Work経路が即時に拾える信号を作る。モデルAPIや新しい常駐serverは追加しない。イベント連携が利用できない場合も既存の定期`Integration Rescue 復旧` Workをdurable backstopとして維持する。新しい修復headへ進めば旧headのpending statusは継承されない。

## CI coalesce

CIは既存の`ci-<PR>-<validation|observation>` concurrencyと`cancel-in-progress: true`を正本として維持する。同じPR/purposeの旧runを置換し、validationとobservationは相互にcancelしない。この契約をflow-control回帰テストで固定する。

## Rescue state寿命

`RescueStore.mutate()`はCAS保存前に`compactRescueState()`を通す。

- `MERGED`はDEV確認まで残す。
- `DEV` / `CLOSED`の48時間超は件数集約してactive stateから外す。
- recoverable `FAILED_MANUAL`は消さない。巨大な`baseChanges`だけ件数へ圧縮し、immutable refs・failureReason・scope・Work evidenceは残す。
- completed waveは最大48、activityは24時間/最大400、outboxは24時間/最大120。
- 既存900KB hard budgetは維持し、圧縮できない異常時はfail closed。

## PULSE flow metrics

PULSEのRescue直上に保持履歴から次を表示する。

- Ready検知 → Merge: p50 / p95
- Merge → DEV: p50 / p95
- Ready検知 → DEV: p50 / p95
- 現在のNORMAL / BUSY / BURN_DOWNと主要bottleneck

Repositoryには全依頼のcanonical request timestampがないため、ここでいうReady起点はRescueがReadyを検知した`detectedAt`であり「ユーザーがチャットで依頼した瞬間」ではない。数字を混同しない。

## Safety

main / Production、review/Changes requested、未解決thread、explicit hold、browser repair ownership、schema/save/protocol等のproduct decision、fast/browser/DEV gateは変更・弱体化しない。Integration Train、backpressure、state圧縮、PULSE表示はいずれも既存の最終merge safetyを迂回しない。
