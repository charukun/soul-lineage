# Development WORK

通常の実装セッションが担当する範囲だけを定義する。現行資料の入口と優先順位は [`README.md`](README.md)、実装終了・通知・非同期待機の詳細は [`RINNE_PROJECT_EXECUTION_POLICY.md`](RINNE_PROJECT_EXECUTION_POLICY.md) を正本とする。

## 完了境界

通常実装:

```text
latest develop
  -> work branch / Draft PR
  -> implementation
  -> affected focused validation
  -> pre-Ready reconciliation with latest develop
  -> affected focused revalidation
  -> push
  -> final develop freshness check
  -> Ready for review
  -> merge PR to develop
  -> asynchronous DEV publication
  -> session ends
```

適用条件を満たす Micro Patch:

```text
latest develop
  -> short-lived branch
  -> micro implementation
  -> affected focused validation
  -> pre-Ready reconciliation with latest develop
  -> affected focused revalidation
  -> push
  -> final develop freshness check
  -> Ready PR directly
  -> merge PR to develop
  -> asynchronous DEV publication
  -> session ends
```

Micro Patch の適用条件・除外条件は [`MICRO_PATCH_FAST_LANE.md`](MICRO_PATCH_FAST_LANE.md) を正本とする。fast path を理由に局所検証や freshness verify を省略しない。

このRepositoryは個人開発 + AI並列workerを前提とする。develop PRではGitHub CIを起動しない。実装 WORK が focused validation、current develop reconciliation、focused revalidation、push、final freshness verify を完了したら、その同じ実装 WORK がPRをReadyにして exact current head を `develop` へmergeする。別のmerge queue、Ready handoff、Fast Repair自動ループは通常経路に置かない。

PULSE (`ops-board/**`, `tests/pulse-*`, `tests/ops-*`, PULSE workflow/config) は例外的に `npm run pulse:preflight` を focused validation の必須入口とする。`scripts/validate.mjs dev` もPULSE関連差分を検出したら同じpreflightを実行し、公開workflowも同一コマンドを使う。UI文言とbrowser assertionを別々の正本にせず、`ops-board/public/pulse-contract.mjs` のsemantic contractを共有する。

**Ready for review は終了状態ではない。** develop向け実装タスクの正常終了は `Merged` / `MERGED_TO_DEVELOP` だけとし、`READY_FOR_INTEGRATION`、`Readyでhandoff`、`Integration待ち` を完了報告・PR status・運用上の終端として使わない。merge権限不足・未解決holdなどでmergeできない場合だけ `FAILED` として、branch / exact head / PR / reason を残す。

## Pre-Ready Reconciliation

実装 WORK は、自分が作業を開始した時点の `develop` を Ready の前提にしない。実装と最初の focused validation が終わったら、**Ready にする前に current `develop` を再取得し、その時点の最新 `develop` を work branch へ merge-forward してから Ready 化する**。

標準 checkout では `npm run pre-ready:sync` を使用する。このコマンドは current `origin/develop` を fetch し、work branch がそれを含んでいなければ `--no-edit` merge-forward を行う。true merge conflict が出た場合は、実装意図と current develop 契約の両方を知る実装 WORK がその場で意味的に解決する。無条件の ours/theirs、品質 gate 削除、変更の捨て直しで解消しない。

merge-forward 後は affected focused validation をもう一度行い、reconciled head を push する。Ready 化の直前には `npm run pre-ready:verify` で current `origin/develop` をもう一度 fetch し、取得した develop が current head の ancestor であることを確認する。verify が stale を返した場合は `pre-ready:sync` → focused validation → push → `pre-ready:verify` を繰り返してから Ready にする。

merge直前にcurrent developとPR headを再取得する。どちらかが変わっていたらmergeせず、実装WORK自身がlatest developを再reconcileし、focused validationをやり直す。

checkout がなく connected GitHub API 経路だけで作業する場合も同じ意味契約を守る。Ready の前に current develop を再取得し、work branch head がその develop を親履歴として含む reconciled head を作り、必要な focused validation を済ませてから Ready にする。

## 標準手順

1. 最新 `develop` SHA と `AGENTS.md` を確認する。checkout があれば `npm run context:plan -- --task "<要約>"` を実行し、必要資料だけ読む。
2. 最新 `develop` から専用 branch を作る。コード変更を伴う通常タスクは、コード編集前に branch を push して develop 向け Draft PR を作る。`MICRO_PATCH_FAST_LANE.md` の全条件を満たす小変更だけは例外で、実装と focused validation を branch head で完了してから意味のある差分を push し、develop 向け Ready PR を直接作る。
3. GitHub は差分のない branch から PR を作れないため、通常タスクで Draft PR を先に必要とする場合は、必要なら既存仕様・運用文書へ今回の受入条件を最小限追記して最初の意味ある差分にする。ダミーファイル、空 commit、恒久的に無意味な履歴は作らない。文章・資料だけを更新するタスクは、その意味ある資料差分自体を最初の commit にしてよい。Micro Patch では PR 作成だけのための文書差分を作らない。
4. 実装する。確定要件と現在の `develop` 契約を守る範囲の可逆的な細部は AI が選び、重要な仮定を PR に短く残す。
5. **実装セッション内では**変更した機能に必要な局所テスト・check・buildを行う。通常は `npm ci`、対象app/packageの focused test/check/build、必要なら `node scripts/validate.mjs fast origin/develop HEAD` を使う。基盤変更は関連する基盤contractを確認する。毎回の全体 E2E・全ゲーム browser 総点検は不要。
6. Ready 準備に入ったら `npm run pre-ready:sync` で current `develop` を work branch へ merge-forward する。競合があれば current develop と実装意図の両方を満たすよう実装 WORK が解消する。reconciled head で変更責任に必要な focused validation を再実行する。
7. push 前に `npm run push:route -- origin/develop HEAD` を使える環境では実行する。通常 git → 接続済み GitHub API → 同じ branch の既存 Codespaces + 通常 git の順に復旧する。1経路の失敗だけで終了しない。reconciled head を push する。
8. Ready 化の直前に `npm run pre-ready:verify` を実行する。current develop が head に含まれていなければ手順6へ戻り、最新 develop の取り込み・focused validation・push を行う。fresh を確認したら PR 本文を実施結果へ更新し、通常タスクは Ready for review にする。Micro Patch はこの時点で初めて Ready PR を作る。
9. PRをReadyにし、merge直前のfreshnessを再確認して、同じ実装WORKがexact current headを`develop`へmergeする。branch / exact head SHA / PR / merge commit / reconciled develop SHA / 実行済み検証を報告して終了する。DEV公開の完了待ちはしない。

## Micro Patch Fast Lane

Micro Patch は「変更行が少ない」だけでは成立しない。原則 3 files 以下・30 changed lines 以下の既存ファイル小編集で、control-plane、shared package、dependency/manifest/lockfile、schema/save/protocol/API contract、auth/security、migration、infrastructure、build system、generated/binary assetを触らず、影響範囲と期待挙動が明確で focused validation 済みの場合だけ使う。

条件を外れた、実装中に範囲が広がった、または判断に迷う場合は同じ branch を捨てずに通常の Draft PR 経路へ戻す。fast pathを維持するために変更を不自然に分割したり、テスト・review・exact-head gateを弱めたりしない。詳細は [`MICRO_PATCH_FAST_LANE.md`](MICRO_PATCH_FAST_LANE.md)。

## PR 契約

PR 本文は空行・見出し・HTML コメントを先頭に置かず、必ず連続した2行で始める。

```text
短い作業タイトル
何を変更・修正・追加するか分かる簡潔な詳細
```

3行目以降に必要な情報を置く。

- 変更理由 / 挙動
- 影響 app / package
- 実行した検証と未確認事項
- `Depends-On: #N` または `Depends-On: none`
- AI が採用した重要な仮定
- DEV で確認してほしい画面・操作（該当時）

GitHub 標準状態をそのまま使う。

| 状態 | 意味 |
| --- | --- |
| Draft | 作業中 / 未完了 |
| Ready for review | merge直前 |
| Merged | develop 統合完了 |
| Closed (unmerged) | 中止 / 終了 |

独自 Task-ID、第二のタスク DB、別の永続 queue を追加しない。

## Ready にしてよい条件

- 依頼された実装が完了している。
- current develop を work branch へ merge-forward 済みで、`pre-ready:verify` が fresh を確認している。
- reconciled head で、変更した機能に必要な局所検証が成功している。
- current head が push 済み。
- 未解決の重大な契約選択がない。
- 既存の hold / Changes requested / unresolved thread / dependency を勝手に解除していない。

技術的に難しい、同じ file を触っている、見た目を後で調整できる、DEV で実物を見たい、という理由だけでは Draft / human-required に止めない。現在仕様へ安全に適応できる古い PR や機械的競合は修復対象。

未実装、reconciled head の局所検証失敗、pre-ready reconciliation の未解決競合、権限不足、互換性を壊す save/schema/protocol 等の未承認選択、確定仕様から解けない重大な契約矛盾は Ready にしない。実行可能な修復を行い、それでも人間判断が必要な対象だけ理由を具体化する。

## develop PR の検証境界

develop向けPRではGitHub ActionsのPR CIを起動しない。検証責任は実装セッションに置く。

- affected focused test/check/buildを実装WORK内で実行する。
- current developをwork branchへ取り込んだ後にaffected focused validationを再実行する。
- merge直前にcurrent developとPR exact headを再取得し、staleなら再reconcileする。
- browser/WebGL/P2P等の重い検証は、ユーザー明示playtest、専門evidence workflow、またはmain / Productionの品質gateで実行する。
- assertion削除、timeout引き延ばし、品質gate弱体化で「通す」ことは禁止。

main / Production のblocking gateは不変。

単一 app の変更を root ゲーム構成へ戻さず、`apps/<id>` と `packages/<id>` の境界を維持する。詳細は [`MONOREPO.md`](MONOREPO.md) と [`PLATFORMS.md`](PLATFORMS.md)。

## GitHub / Codespaces 経路

Codespaces は別開発フローではなく搬送経路の代替。branch、PR、局所検証、Ready → same-task merge の終了境界は変えない。容量・Base64・payload 上限のときは同じ branch を Codespaces で開き通常 `git push` へ切り替える。大きなバイナリを API 経由で分割再送しない。詳細は [`MOBILE_HYBRID_DEVELOPMENT.md`](MOBILE_HYBRID_DEVELOPMENT.md)。

依頼成果を同 Repository / 既存 Codespaces へ転送・push する許可は [`DELIVERY_AUTHORIZATION.md`](DELIVERY_AUTHORIZATION.md) に記録済み。同じ範囲の許可を再質問しない。

## 復旧

セッションが停止しても最初から作り直さない。GitHub の現在状態から、同じ PR / branch を復旧する。

必要な引き継ぎ情報は repository、branch、head SHA、PR、Draft/Ready、base、reconciled develop SHA、必要な exact-head Checks/status。過去チャット全文や古い handoff を正本にしない。

merge前に問題が見つかった場合は同じPR/branchで修正 → current develop reconciliation → 局所検証 → push → freshness verify → Ready → mergeまで同じ実装WORKで完了する。

## 関連資料

- Micro Patch Fast Lane: [`MICRO_PATCH_FAST_LANE.md`](MICRO_PATCH_FAST_LANE.md)
- Develop merge: [`DEVELOP_MERGE.md`](DEVELOP_MERGE.md)
- Repair / legacy Rescue compatibility: [`INTEGRATION_RESCUE.md`](INTEGRATION_RESCUE.md)
- Context budget: [`CONTEXT_EFFICIENCY.md`](CONTEXT_EFFICIENCY.md)
- Browser verification / repair: [`BROWSER_SELF_HEALING.md`](BROWSER_SELF_HEALING.md)
- Documentation map: [`README.md`](README.md)
