# develop merge

The normal develop lane is:

```text
compose implementation against develop tree with no routine branch yet
  -> exact final bytes validated
  -> final commit created detached from refs
  -> branch created directly at final commit
  -> non-draft PR created once
  -> final work-head commit contains [astra-validate]
  -> routine: exact final bytes are checked before blob/tree/commit creation
     heavy: exact work head passes hosted Astra validation
  -> one current-develop read
  -> unchanged base: immediate expected-head merge
     advanced base: drift classification, then merge/reconcile
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

For routine work, create the PR non-draft after the final proof already exists, so there is no Draft -> Ready transition. Heavy/recovery work may still use Draft while multiple published heads are expected.

### Ready-to-merge race guard

PR作成とmergeの間にも `develop` は進み得る。GitHubの通常PR mergeは、その瞬間の最新baseを採用できるため、検証済みheadだけを固定してもshared-control driftを取り込む競合窓が残る。

そのためroutineでは、PR作成レスポンスのhead SHAを保持したまま、merge直前に最新 `develop` を1回だけ読む。developがfinal commitのparentから動いていなければ、別のPR-info/status/mergeability readをせず `expected_head_sha` 付きmergeを直ちに実行する。developが動いていた場合だけcompare/freshness分類へ分岐する。heavyでは既存 `actions:summary` のmerge-window tokenを使う。

- PR headがvalidated headと違えば停止して新headを検証する。
- developが前回観測から動いていれば、そのdriftをfreshness分類へ戻す。independent driftだけがproof reuse可能で、control-plane/impact overlapはreconcile + new proof。
- merge後は作成されたmerge commitを1回だけ取得し、head parentがvalidated headであることを確認する。正常時はそれ以上のdevelop/PR/status再取得をしない。

この再読は品質gateを増やすものではなく、既存freshness判定と実際のmerge対象baseの間にあるrace windowを閉じるための座標確認である。

Ordinary CI, browser verification not explicitly requested, and DEV publication are not waiting stages after merge. The `develop` push starts DEV publication asynchronously.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
