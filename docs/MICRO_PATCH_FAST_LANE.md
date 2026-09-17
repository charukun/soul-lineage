# Micro Patch Fast Lane

## 目的

数行の安全な変更を、通常の大きな実装と同じ Draft / Draft CI 固定費に通さず、品質条件を維持したまま `Ready -> exact-head DEV gate -> Integration -> DEV publication` へ短絡する。

Micro Patch Fast Lane は品質 gate の省略ではない。Draft の作業中 runner を起動せず、変更・局所検証・**pre-Ready develop reconciliation** を実装セッション内で完了してから Ready PR を作るための authoring fast path である。Ready 後の exact-head 差分検査、静的 check、code-health、必要な build、Integration、DEV source verification、main / Production gate は通常経路と同じ契約を維持する。

## 適用条件

次をすべて満たす場合だけ Micro Patch として扱ってよい。

- 最新 `develop` から作った専用短命 branch である。
- 既存ファイルの小さな編集で、原則 3 files 以下かつ 30 changed lines 以下を目安とする。
- 新規/削除/rename、binary/generated asset、dependency/manifest/lockfile変更を含まない。
- `.github/**`、`scripts/**`、root `tests/**`、deploy/Integration/通知など control-plane を変更しない。
- shared package、schema/save/protocol/API contract、auth/security、migration、infrastructure、build systemを変更しない。
- 変更対象と期待挙動が明確で、未解決の product choice や review objection がない。
- 変更した機能に必要な focused validation を branch head で実行済みである。
- Ready 化前に current `develop` を branch へ merge-forward し、reconciled head で focused validation を再実行できる。

行数・file数だけで安全性を判定しない。上記の除外条件に触れる、影響範囲が不明、または判断に迷う場合は通常の Draft PR 経路を使う。

## 実行経路

```text
latest develop
  -> short-lived branch
  -> micro implementation
  -> affected focused validation
  -> current develop merge-forward
  -> affected focused revalidation
  -> push exact head
  -> final develop freshness verify
  -> Ready PR directly
  -> exact-head DEV Validate and build
  -> Integration thin expected-head guard
  -> DEV publication/source verification
```

Micro Patch では空 commit、ダミー差分、PR作成だけのための文書差分を作らない。実装が完了してから意味のある変更を用意し、Ready の直前に [`DEVELOPMENT.md`](DEVELOPMENT.md) の Pre-Ready Reconciliation と同じ current develop 取り込みを行う。checkout がある場合は `npm run pre-ready:sync` → focused validation → push → `npm run pre-ready:verify` を使い、fresh を確認した head で develop 向け Ready PR を作る。verify が stale なら sync から繰り返す。

true merge conflict、意味衝突、reconciled head の focused validation failure を fast path 維持のために自動片側採用・assertion削除・未検証で通してはならない。その時点で通常 Development WORK 契約へ移行し、必要なら Draft PR を作る。

Ready CI は Draft 用 runner を前提にしない。Ready exact head で `git diff --check` 相当の差分衛生検査を含め、通常の trusted DEV validator を実行する。Ready 後のCI完了、merge、DEV publicationを実装セッションが待機・pollingしない点も通常経路と同じである。Ready 後に develop が進んだ短い race は Integration / Fast Repair の責任であり、Micro Patch worker は Ready 後に追跡しない。

## 通常経路へ戻す条件

実装中または pre-Ready reconciliation 中に適用条件を外れた場合は、その branch を捨てずに同じ branch で Draft PR を作成または Draft へ戻し、通常の Development WORK 契約へ移行する。fast pathを維持するために変更を分割して安全条件を偽装したり、テスト・review・exact-head gateを弱めたりしない。

## 非対象

- main / Production publication
- Production品質gateの短縮
- full verification が必要な明示playtest / browser / WebGL / P2P検証
- character DCC / binary asset production
- Integration / Repair 自体の変更

これらは各canonical routeを使う。
