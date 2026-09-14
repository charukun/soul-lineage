# Integration Reconciliation Control Plane

## 目的

Integration / Rescue / Virtual Train / Queue Recovery を別々の業務フローとして連結せず、GitHub の現在状態から毎回「次に必要な行為」を再計算する reconciliation control plane に整理する。

新しい独自Task-ID、外部DB、別の永続queueは導入しない。正本は引き続き GitHub の PR / branch / commit / review / Checks / statuses と、既存Rescue stateが保持する修復lease・bounded diagnosticsである。

## 設計原則

1. **Events are wake signals**
   - PR Ready、CI完了、repair返却、develop/DEV更新、既存scan/manual wakeは同じ `reconcile` の起動契機として扱う。
   - event payloadを業務状態の正本にしない。起動後はGitHubのcurrent stateを再取得する。
2. **Planner is pure**
   - Plannerは取得済みsnapshotから `writer / validating / repair / active / blocked / train / deferred` を計算するだけで、branch・PR・statusを書き換えない。
3. **Parallel prepare, serialized write**
   - exact-head preflightは最大6件、Train検証とrepairもbounded parallelで実行できる。
   - developを書き換えるmerge laneは1本だけ。merge直前にmutable stateを再取得し、exact headを渡す。
4. **Repair is an executor, not a second queue**
   - Rescueは通常Integrationと別の最終状態機械を持たず、repair executorとして扱う。
   - 既存のlease/CAS/base-update/validation primitiveは安全部品として再利用する。
5. **Liveness is explicit**
   - `pending work > 0 && active work == 0` を放置する設計にしない。既存のReady/CI/verified-DEV scan/repair-return wakeは、すべてcurrent stateを再計算する入口へ収束させる。
   - 1件のheld/failed PRで独立候補の評価を止めない。
6. **Safety gates are inherited, not weakened**
   - exact-head fast/browser、review、unresolved thread、hold、Depends-On、same-repository/trusted author、develop verification、Production gateを維持する。
   - Train proofはdevelop/head/inputのどれかが変われば無効化する。

## Control Plane の責務

```text
wake
  ↓
reconcile current GitHub reality
  ↓
bounded parallel exact-head preflight
  ↓
pure plan
  ├─ validating / blocked diagnostics
  ├─ virtual train executor
  └─ repair executor
  ↓
serialized expected-head writer
  ↓
DEV publisher / verification
  ↓
reconcile wake when current GitHub state changes again
```

### Reconciler

- current develop SHA / `integration/develop`
- open non-Draft develop PR
- labels / body / Depends-On
- review / unresolved thread
- exact-head validation evidence
- mergeability / changed scope
- active repair ownership

をbounded concurrencyで取得し、Plannerへsnapshotを渡す。preflightで得た証拠はPlanner分類にのみ使い、writerの最終merge gateを省略する証拠にはしない。

### Planner

Plannerの出力は診断可能なJSONとし、少なくとも以下を含む。

- `writer`: 現snapshotでserialized writerへ進める候補
- `validating`: exact-head CI/browser/check証拠待ち・preflight未確定
- `trains`: 相互にcompatibleな2〜5件の集合
- `repair`: current-headで修復すべきPR
- `active`: 現在leaseを持つrepair executor
- `blocked`: human/hold/dependency/review等で進めないPRと理由
- `deferred`: bounded evaluation budgetで次回へ送るPR
- `wakeAgain`: 進展可能なworkが残るか

Trainは「同じ機能カテゴリ」ではなく、Depends-On・changed scope・conflict risk・validation requirement・head/base identityからcompatibleなものだけを編成する。shared file、control/schema/contract、dependency waitは同一Trainへ入れない。

### Executors

ExecutorはPlannerの決定を実行し、最終merge可否を独自に緩和しない。

- bounded exact-head preflight
- virtual train executor
- repair executor
- publisher / browser verification

Virtual TrainはRepair配下からController配下へ移し、Plannerのexact member/head集合を再確認してから一時branchへ合成する。Repair workflowはTrainを所有しない。

### Writer

develop mutationの唯一のlane。既存 `integrate()` の実績ある安全primitiveをwriter adapterとして再利用し、各PRのmerge直前にPR/review/thread/check/developを再取得する。GitHub merge APIにはexpected PR head SHAを渡す。developが予期せず進んだ場合は停止して次のreconcileへ戻し、force push / history rewriteは行わない。

## 現在の実装構造

`integration-controller.yml` は `reconcile → optional planned Train → serialized writer` を主線とし、Repair executorを同じreconcile結果から並行起動する。旧 `integration-rescue.yml` からVirtual Trainを除去し、repair executor poolだけを残す。

Plannerのbounded JSONは既存Rescue stateの `flowControl.reconciliation` に保存する。これは新しいqueueの正本ではなく、PULSE/優先順位付け用の再生成可能なdiagnostics snapshotである。develop SHAが変わればwriter orderは利用しない。

verified DEV後の既存scan wakeも先にReconcilerを通るため、旧Queue Recoveryはmissed CI回復のexecutor/互換経路へ縮退する。通常writerのmerge可否は引き続きcurrent GitHub stateの再読で決める。

## 受入条件

- Ready backlogが存在しても、1件のblocked/failed PRが独立PRのpreflight・writer候補化を止めない。
- preflightは最大6並列、1回の評価は最大24件にboundedされる。
- compatible PRは2〜5件のTrainへ編成できるが、shared file/control/schema/dependency conflictは同一Trainへ入らない。
- Train検証完了後にserialized writerへ進み、develop writeは同時実行されない。
- writerはPlanner証拠だけでmergeせず、既存exact-head/review/thread/check/dependency/develop gateをmerge直前に再読する。
- head/develop/input変化で古いTrain/reconciliation orderを使用しない。
- Repair workflowはVirtual Trainを所有しない。
- current browser assertion、Production gateを削除・緩和しない。
- main / Productionを変更しない。
- PULSEが待機総数だけでなく writer / validating / Train / repair / active / blocked / deferred を説明できる。
