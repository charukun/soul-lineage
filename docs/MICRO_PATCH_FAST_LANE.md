# Micro Patch Fast Lane

## 目的

数行の安全な変更を、通常の大きな実装と同じ反復CI固定費に通さず、品質条件を維持したまま最終headの検証1回から `develop` mergeへ短絡する。

Micro Patch Fast Lane は品質 gate の省略ではない。変更と **pre-Ready develop reconciliation** を先に完了し、Draft PR本文の `Astra-Validate: <head SHA>` で最終reconciled headの検証を1回だけ明示起動する authoring fast path である。中間pushのCIは待たない。main / Production gate は通常経路と同じ契約を維持する。

## 適用条件

次をすべて満たす場合だけ Micro Patch として扱ってよい。

- 最新 `develop` から作った専用短命 branch である。
- 既存ファイルの小さな編集で、原則 3 files 以下かつ 30 changed lines 以下を目安とする。
- 新規/削除/rename、binary/generated asset、dependency/manifest/lockfile変更を含まない。
- `.github/**`、`scripts/**`、root `tests/**`、deploy/Integration/通知など control-plane を変更しない。
- shared package、schema/save/protocol/API contract、auth/security、migration、infrastructure、build systemを変更しない。
- 変更対象と期待挙動が明確で、未解決の product choice や review objection がない。
- Ready 化前に current `develop` を branch へ merge-forward できる。
- reconciliation後の最終headで、merge-owning focused validationを1回だけ実行できる。

行数・file数だけで安全性を判定しない。上記の除外条件に触れる、影響範囲が不明、または判断に迷う場合は通常の Draft PR 経路を使う。

## 実行経路

```text
latest develop
  -> short-lived branch / Draft PR
  -> micro implementation
  -> current develop merge-forward
  -> final head
  -> PR body: Astra-Validate: <head SHA>
  -> one focused validation
  -> freshness verify
  -> Ready
  -> same-task develop merge
  -> asynchronous DEV publication
```

Micro Patch では空 commit、ダミー差分、PR作成だけのための文書差分を作らない。実装が完了してから意味のある変更を用意し、Ready の直前に [`DEVELOPMENT.md`](DEVELOPMENT.md) と同じ current develop 取り込みを行う。final reconciled headが決まってから `Astra-Validate: <head SHA>` をPR本文へ入れて検証を1回だけ起動する。staleになった場合だけsyncからやり直す。

true merge conflict、意味衝突、最終reconciled head の focused validation failure を fast path 維持のために自動片側採用・assertion削除・未検証で通してはならない。その時点で通常 Development WORK 契約へ移行する。

merge-owning validationはReady前のDraft PRで明示起動し、`git diff --check` 相当の差分衛生検査と必要なDEV checks/buildを含む。成功後はReadyで止まらず同じセッションでmergeする。merge後の通常CI・browser verification・DEV publicationは待機・pollingしない。

## 通常経路へ戻す条件

実装中または pre-Ready reconciliation 中に適用条件を外れた場合は、その branch を捨てずに同じ branch で Draft PR を作成または Draft へ戻し、通常の Development WORK 契約へ移行する。fast pathを維持するために変更を分割して安全条件を偽装したり、テスト・review・exact-head gateを弱めたりしない。

## 非対象

- main / Production publication
- Production品質gateの短縮
- full verification が必要な明示playtest / browser / WebGL / P2P検証
- character DCC / binary asset production
- Integration / Repair 自体の変更

これらは各canonical routeを使う。
