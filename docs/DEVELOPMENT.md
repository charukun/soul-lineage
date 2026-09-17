# Development WORK

通常の実装セッションは [`ASTRA_OUTCOME_CONTRACT.md`](ASTRA_OUTCOME_CONTRACT.md) を実行契約とする。AI を固定手順の operator として使わず、現在の `develop` とユーザー意図から **独立して統合可能な Ready outcome** を作る責任主体として使う。

## Worker-facing lifecycle

実装側で意味を持つ状態は 3 つだけ。

```text
WORKING
  Astra owns implementation / context / semantic reconciliation / validation choice

READY
  final reconciled exact head + sufficient evidence + pushed source
  -> READY_FOR_INTEGRATION
  -> implementation session ends

BLOCKED
  repository contract + user intent だけでは安全に解けない
  product / permission / external-input choice
```

Draft、Micro Patch、Repair はこの 3 状態と同列の worker state ではない。

- Draft は GitHub 上で途中作業を可視化したい時だけ使う transport state。
- 小変更か大変更かは route 名ではなく、影響範囲と risk から validation scope を変える。
- Ready 後の mechanical base race / Fast Repair は Integration の内部実装。
- semantic source repair が必要なら同じ PR を `WORKING` に戻し、current state から Astra が解き直す。

## DONE contract

Ready にしてよい exact head は次をすべて満たす。

- 依頼された挙動が実装済み。
- Ready 直前に観測した current `develop` を ancestry に含む。
- true conflict は task intent と current develop contract の両方を満たすよう意味的に解消済み。
- 変更責任に必要な validation evidence が **最終 reconciled head** に対して成功。
- validated head と push 済み head が同一。
- 未解決の重大な product / schema / save / protocol / auth / security 等の選択がない。
- PR に exact head、reconciled develop SHA、実行した evidence、未確認事項を短く残している。

途中検証は自由。デバッグを速めるなら何度でもよい。ただし **reconcile 前の検証 + reconcile 後の再検証を固定儀式として要求しない**。品質契約として必須なのは最終 reconciled head の必要十分な evidence だけである。

## 標準実行

1. 最新 `develop` SHA と `AGENTS.md` を確認する。checkout があれば `npm run context:plan -- --task "<要約>"` を実行し、必要資料だけ読む。
2. 最新 `develop` から 1 task 専用の短命 branch を作る。
3. Astra が task の意味、変更範囲、repository contract から必要 context と実装方法を選ぶ。長時間作業、dispatch、途中共有に価値がある場合だけ Draft PR を作る。短寿命タスクは branch 上で完成させ、Ready outcome が揃った時点で Ready PR を直接作ってよい。
4. 実装する。途中の test / check / browser / build は、フィードバックを速くする価値があるものだけ選ぶ。
5. 最終 evidence の前に current `develop` を再取得して work branch へ reconcile する。checkout がある場合は `npm run pre-ready:sync` を補助として使える。true conflict は Astra が意味的に解く。無条件 ours/theirs、assertion削除、品質gate弱体化は禁止。
6. **reconciled exact head に対して** Astra が必要十分と判断した focused validation を実行する。対象 app/package、shared consumer、control-plane、browser/evidence の必要性は変更内容から決める。
7. reconciled validated head を push する。使える環境では `npm run push:route -- origin/develop HEAD` を transport 補助として使える。通常 git → connected GitHub API → 同じ branch の既存 Codespaces + 通常 git の順で復旧し、1経路の失敗だけでタスク失敗にしない。
8. Ready 化直前に current `develop` をもう一度確認する。checkout では `npm run pre-ready:verify` を使える。develop が進んでいたら新しい drift を reconcile し、**その drift が影響する evidence だけ**再実行して push / freshness を満たす。意味のない全検証や固定二重検証へ戻さない。
9. Ready PR を作成または Draft を Ready にし、branch / exact head / PR / reconciled develop SHA / evidence を報告して `READY_FOR_INTEGRATION` で終了する。

Running / Queued / Pending CI、browser checks、handoff recorder、Integration、DEV publication を待機・pollingしてセッションを延命しない。

## Validation ownership

Astra は「変更行数」ではなく、壊し得る契約から evidence を選ぶ。

| Change | Typical sufficient evidence |
| --- | --- |
| copy / CSS / isolated presentation | syntax + affected UI evidence when behavior/visual contract needs it |
| app-local domain / gameplay | focused behavior/unit test + required app build/check |
| shared package | package evidence + affected consumer evidence |
| schema / save / protocol / API | compatibility/migration contract + affected consumers |
| auth / security | dedicated security/auth contract + affected behavior |
| `.github/**` / Integration / deploy / ops | control-plane focused tests/checks; game builds only when actually affected |
| binary / generated / character DCC | specialist production/evidence contract |

これは例であり固定マトリクスではない。Astra は repository の specialist docs と affected scope を使って必要十分な evidence を選ぶ。

`npm run affected`、`npm run pre-ready:sync`、`npm run pre-ready:verify`、`npm run push:route` 等は判断を補助する helper であり、全タスクで順番に踏む儀式ではない。

## BLOCKED にしてよい条件

次のように repository contract と user intent から一意に安全解を作れず、外部判断が必要な場合だけ `BLOCKED` とする。

- backward compatibility を壊す schema/save/protocol/API 選択で、許容される migration 方針がない。
- 権限・credential・有料resource・外部正本への access が必要で、既存許可範囲に含まれない。
- 相互に両立しない確定要件があり、現在資料から優先順位を決められない。
- ユーザー承認が契約上必須な不可逆 / Production 操作。

以下だけでは `BLOCKED` にしない。

- 同じ file を別PRも編集している。
- develop が進んだ。
- merge conflict が出た。
- 技術的に難しい。
- visual を後で確認したい。
- CIが Running / Queued / Pending。
- mechanically repairable な dependency / base drift。

## PR transport

GitHub 標準状態をそのまま使う。

| GitHub state | Outcome meaning |
| --- | --- |
| Draft | optional observable `WORKING` transport |
| Ready for review | `READY`, Integration owns the exact head |
| Merged | develop 統合完了 |
| Closed (unmerged) | 中止 / obsolete / superseded |

独自 Task-ID、第二の task DB、heartbeat queue を追加しない。Draft を使わない短寿命 worker は、Ready PR が作られるまで GitHub / PULSE から観測できなくてよい。観測性のためだけに余計な PR ceremony を作らない。

PR 本文は先頭2行を実施内容として連続させる。

```text
短い作業タイトル
何を変更・修正・追加したか分かる簡潔な詳細
```

必要に応じて以下を続ける。

- 変更理由 / 挙動
- 影響 app / package
- exact head / reconciled develop SHA
- 実行した evidence と未確認事項
- `Depends-On: #N` または `Depends-On: none`
- AI が採用した重要な仮定
- DEV で見てほしい操作（該当時）

## Integration boundary

Ready 後は [`INTEGRATION.md`](INTEGRATION.md) の deterministic layer が所有する。

- current GitHub state / exact head を再取得
- hold / dependency / review 条件を確認
- exact-head 差分衛生・syntax・static check・code-health・必要 build
- serialized expected-head / CAS merge
- Ready 後に発生した短い develop race の機械的 repair
- DEV publication / source verification

Implementation が current develop を reconcile 済みでも、Ready と merge の間の race は消えないため CAS は維持する。逆に Integration は、通常 worker が省略した意味判断や常時 base catch-up を第二実装工程として肩代わりしない。

## develop CI boundary

通常 develop CI は exact-head の deterministic gate であり、実装者の semantic validation を置き換えない。現在の trusted control checkout から差分衛生・syntax/static・code-health・必要 build を実行し、通常 develop では `node --test` / browser gameplay を自動常時実行しない。

重い全体回帰、browser/WebGL/P2P はユーザー明示playtest、`full_verification=true`、専門 evidence workflow、main / Production gate で使う。main / Production の blocking gate は不変。

## Micro Patch compatibility

旧 [`MICRO_PATCH_FAST_LANE.md`](MICRO_PATCH_FAST_LANE.md) の目的だった「小変更の固定費を減らす」は Outcome Contract に吸収した。worker は Micro Patch 適用条件を判定して別routeへ入る必要はない。

小さく安全な変更なら Astra が自然に小さい context / evidence を選び、Ready PRを直接作る。high-risk / shared / control-plane なら自然に evidence が増える。fast path を維持するための不自然な分割は禁止。

## PULSE

PULSE の利用者向け状態は `WORKING / READY / BLOCKED` を優先する。

- `WORKING`: GitHubで観測できる Draft、または exact-head failure により implementation ownership へ戻った対象。
- `READY`: Ready handoff 後、deterministic Integration が所有している対象。CI / Fast Lane / mechanical repair / dependency wait は technical detail。
- `BLOCKED`: 明示 hold など、人間介入が必要だと GitHub state から確認できる対象。

PULSE は見えていない worker を推測しない。Fast Lane / Rescue / CI stage は詳細画面に残し、トップレベルの mental model を増やさない。

## Production

`main` / Production はユーザーの明示許可がある場合だけ変更する。Outcome Contract は Production gate の短縮を認めない。