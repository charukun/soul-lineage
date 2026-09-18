# develop merge

## 目的

このRepositoryは個人開発 + AI並列workerを前提とし、develop向けのPR CI・merge queue・Ready handoff・自動repair loopを持たない。

通常経路は次だけとする。

```text
latest develop
  -> work branch / PR
  -> implementation
  -> affected focused validation
  -> merge-forward current develop
  -> affected focused revalidation
  -> push
  -> final freshness verify
  -> Ready
  -> same-task worker merges exact PR head to develop
  -> develop push starts DEV publication
```

## merge前の条件

同じ実装workerはmerge直前にcurrent GitHub stateを再取得し、次を確認する。

- PRがopen / non-Draft / base=`develop`
- same repository
- `merge:hold` / `merge:manual` / `do-not-merge` / `Merge-Hold:` がない
- `Depends-On` が完了している
- current developをwork branchへ取り込み済み
- reconciled headで必要なfocused validationが成功している
- PR headが検証したexact headから動いていない
- merge直前にdevelopが進んでいない

developまたはPR headが動いていた場合はmergeせず、最新developを再reconcileして必要なfocused validationをやり直す。

## GitHub Actions

develop向けPRイベントではCIを起動しない。PR更新・Ready化・review状態変更を起点にbranchを自動更新するworkflowも置かない。

これにより、
`PR更新 -> CI -> repair/reconcile -> branch更新 -> CI再発火`
という循環経路を構造的に持たない。

## DEV publication

developへmergeされた後のpushを起点としてDEV publicationを実行する。DEV公開はPR mergeの前提条件ではない。

DEV publication failureはdevelop履歴を巻き戻さず、公開側の問題として扱う。必要ならLast Known Good復旧を使う。

## main / Production

main / ProductionのCI・blocking test・browser verification・公開gateは変更しない。Productionへの変更は明示許可時のみ。
