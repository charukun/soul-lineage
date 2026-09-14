# Integration Reconciliation Control Plane

## 目的

Integration / Rescue / Virtual Train / Queue Recovery を別々の業務フローとして連結せず、GitHub の現在状態から毎回「次に必要な行為」を再計算する reconciliation control plane に整理する。

この文書は新しい独自Task-ID、外部DB、別の永続queueを導入するものではない。正本は引き続き GitHub の PR / branch / commit / review / Checks / statuses と、既存Rescueが保持する修復lease情報である。

## 設計原則

1. **Events are wake signals**
   - PR Ready、CI完了、repair返却、develop更新、schedule/manual wake はすべて同じ `reconcile` の起動契機として扱う。
   - event payloadを業務状態の正本にしない。起動後はGitHubのcurrent stateを再取得する。
2. **Planner is pure**
   - Plannerは取得済みsnapshotから `runnable / validating / repair / blocked / train / deferred` を計算するだけで、branch・PR・statusを書き換えない。
3. **Parallel prepare, serialized write**
   - immutable snapshotに対するpreflight、Train検証、repairはbounded parallelで実行できる。
   - developを書き換えるmerge laneは1本だけ。merge直前にmutable stateを再取得し、exact headを渡す。
4. **Repair is an executor, not a second queue**
   - Rescueは通常Integrationと別の最終状態機械を持たず、Plannerが返すrepair actionを処理するexecutorとして扱う。
   - repair完了後はreturn専用の長い業務フローへ依存せず、再びreconcileをwakeする。
5. **Liveness is explicit**
   - `pending work > 0 && active work == 0` は例外通知だけでなく、次のreconcileで必ず再配分される通常状態とする。
   - event欠落だけで永続停止しないよう、bounded schedule wakeを維持する。
6. **Safety gates are inherited, not weakened**
   - exact-head fast/browser、review、unresolved thread、hold、Depends-On、same-repository/trusted author、develop verification、Production gateを維持する。
   - proofはdevelop/head/inputのどれかが変われば無効化する。

## Control Plane の責務

```text
wake
  ↓
reconcile current GitHub reality
  ↓
pure plan
  ├─ validate / preflight executors
  ├─ virtual train executor
  ├─ repair executor
  └─ blocked/deferred diagnostics
  ↓
serialized expected-head writer
  ↓
DEV publisher / verification
  ↓
reconcile again only when actionable work remains
```

### Reconciler

- current develop SHA / `integration/develop`
- open non-Draft develop PR
- labels / body / Depends-On
- review / unresolved thread
- exact-head validation evidence
- mergeability / changed scope
- active repair ownership

を必要な粒度で取得し、Plannerへsnapshotを渡す。

### Planner

Plannerの出力は診断可能なJSONとし、少なくとも以下を含む。

- `mergeable`: 今のsnapshotでwriter候補となるPR
- `trains`: 相互にcompatibleな2〜5件の集合
- `repair`: current-headで修復可能なPR
- `blocked`: human/hold/dependency/conflict等で進めないPRと理由
- `deferred`: bounded budgetで次回へ送るPR
- `wakeAgain`: 進展可能なworkが残るか

Trainは「同じ機能カテゴリ」ではなく、Depends-On・changed scope・conflict risk・validation requirement・head/base identityからcompatibleなものだけを編成する。

### Executors

ExecutorはPlannerの決定を実行するだけで、全体の優先順位や最終merge可否を独自判断しない。

- preflight executor
- virtual train executor
- repair executor
- publisher / browser verification

既存の検証済みprimitiveを優先して再利用する。

### Writer

develop mutationの唯一のlane。各PRのmerge直前にPR/review/thread/check/developを再取得し、expected head SHA付きのGitHub merge APIだけを使う。developが予期せず進んだ場合は停止し、次のreconcileへ戻す。force push / history rewriteは行わない。

## 移行

1. vNext Plannerを既存Integrationと独立にunit testできるpure moduleとして追加する。
2. 既存安全primitiveをadapterとして使用し、同一snapshotからplan JSONを生成する。
3. vNextをprimary Controllerへ接続するが、既存Rescue worker/base-update/repair safety primitiveはexecutorとして段階移植する。
4. Virtual TrainをRescue固有概念からPlanner管理へ移す。
5. Queue Recovery / idle wake / Returnは、最終的にreconcile wakeへ縮退させ、同じ判定を複数箇所へ持たせない。
6. PULSEはPlanner分類とactive executorを表示し、制御判断を再実装しない。

## 受入条件

- Ready backlogが存在し、active executorが0でも次のreconcileで進展可能なPRが選ばれる。
- 1件のblocked/failed PRが独立PRの評価・mergeを止めない。
- compatible PRはbounded Trainへ編成できるが、shared file/control/schema/dependency conflictは同一Trainへ入らない。
- preflightは並列化できてもdevelop writeは同時実行されない。
- head/develop/review/check変化で古いproofを使用しない。
- current safety gate、browser assertion、Production gateを削除・緩和しない。
- main / Productionを変更しない。
- planner/diagnosticsからPULSEが「待機総数」ではなく runnable / repair / blocked / train / active writer を説明できる。
