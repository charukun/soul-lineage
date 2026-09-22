# develop merge

The normal develop lane is:

```text
implementation on Draft PR
  -> final work-head commit contains [astra-validate]
  -> routine: exact final bytes are checked before blob/tree/commit creation
     heavy: exact work head passes hosted Astra validation
  -> connector-native mergeability + dependency-impact freshness verification
  -> Ready
  -> same-task merge to develop
  -> asynchronous DEV publication
```

## Merge conditions

Immediately before merge, confirm:

- PR is open, same repository, base=`develop`
- no explicit hold / manual-merge marker / unresolved blocking dependency
- routine: PR head equals the commit built from the exact checked blob SHAs; heavy: the exact PR head has one successful hosted execution of the declared plan
- PR head still equals the `[astra-validate]` commit that owns the merge proof
- current `develop` was re-read and the PR is mergeable with no conflicting/overlapping affected-scope drift
- if `develop` advanced, the validated head and current develop merge cleanly and their affected app/package/build/control-plane scopes are independent

If the PR head moved, validate the new head. If only `develop` moved, do not revalidate solely because the SHA changed. Independent mergeable drift keeps the existing validation; conflict or impact overlap requires reconciliation and one new `[astra-validate]` head.

## Explicit validation arming

Routine final commits contain `[astra-validate]` plus `Astra-Validation: none` or targeted `Astra-Check:` directives, but they do **not** start a runner. The author validates the exact final bytes, writes those bytes as GitHub blobs, and uses the resulting immutable tree/commit as merge-owning proof.

Hosted `Astra Work Validation` is armed only when the same final commit also contains:

```text
[astra-heavy-validation]
```

Use that lane for tests, builds, browser/DCC/asset processing, specialist validation, and explicit Fast DEV contract changes.

After the final proof is established, mark Ready and merge immediately. Ready is transient, not a stopping point.

### Ready-to-merge race guard

Ready化そのものとmergeの間にも `develop` は進み得る。GitHubの通常PR mergeは、直前に確認したbase SHAではなく、その瞬間の最新baseを自動的に採用できるため、検証済みheadだけを固定してもshared-control driftを取り込む競合窓が残る。

そのためReady化**後**、routineではConnectorの1 orchestration内でPR head・最新develop・mergeabilityを読み、そのまま `expected_head_sha` 付きmergeを実行する。heavyでは既存 `actions:summary` のmerge-window tokenを使う。どちらも読み取りとmergeの間に不要な会話・待機を挟まない。

- PR headがvalidated headと違えば停止して新headを検証する。
- developが前回観測から動いていれば、そのdriftをfreshness分類へ戻す。independent driftだけがproof reuse可能で、control-plane/impact overlapはreconcile + new proof。
- merge後は作成されたmerge commitを1回だけ取得し、head parentがvalidated headであることを確認する。正常時はそれ以上のdevelop/PR/status再取得をしない。

この再読は品質gateを増やすものではなく、既存freshness判定と実際のmerge対象baseの間にあるrace windowを閉じるための座標確認である。

Ordinary CI, browser verification not explicitly requested, and DEV publication are not waiting stages after merge. The `develop` push starts DEV publication asynchronously.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
