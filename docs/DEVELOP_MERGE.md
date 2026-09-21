# develop merge

The normal develop lane is:

```text
implementation on Draft PR
  -> final work-head commit contains [astra-validate]
  -> exact work head passes Astra-selected focused validation
  -> mergeability + dependency-impact freshness verification
  -> Ready
  -> same-task merge to develop
  -> asynchronous DEV publication
```

## Merge conditions

Immediately before merge, confirm:

- PR is open, same repository, base=`develop`
- no explicit hold / manual-merge marker / unresolved blocking dependency
- the exact PR head has one successful hosted execution of the Astra-declared focused validation plan from a real repository checkout
- PR head still equals the `[astra-validate]` commit that passed merge-owning validation
- `astra/merge-freshness=success` for that head against the latest observed `develop`
- if `develop` advanced, the validated head and current develop merge cleanly and their affected app/package/build/control-plane scopes are independent

If the PR head moved, validate the new head. If only `develop` moved, do not revalidate solely because the SHA changed. Independent mergeable drift keeps the existing validation; conflict or impact overlap requires reconciliation and one new `[astra-validate]` head.

## Explicit validation arming

`Astra Work Validation` creates no runner job for ordinary intermediate branch pushes.

Keep the PR Draft while implementing. The commit that becomes the final validated branch head must contain:

```text
[astra-validate]
```

in its commit message. That push is the trigger for the one merge-owning validation run. This prevents small implementation commits from repeatedly cancelling and restarting the merge gate.

After the exact final head succeeds, mark Ready and merge immediately. Ready is transient, not a stopping point.

### Ready-to-merge race guard

Ready化そのものとmergeの間にも `develop` は進み得る。GitHubの通常PR mergeは、直前に確認したbase SHAではなく、その瞬間の最新baseを自動的に採用できるため、検証済みheadだけを固定してもshared-control driftを取り込む競合窓が残る。

そのためReady化**後**、merge APIを呼ぶ直前にもう一度 `npm run actions:summary -- --repo <owner/repo> --sha <validated-head> --pr <number>` を取得し、`merge_window.token` の `validated_head:observed_develop_sha` をmerge座標として扱う。

- PR headがtokenのvalidated headと違えば停止して新headを検証する。
- develop SHAがtoken生成後に変わったことを検知したら、そのdriftをfreshness分類へ戻す。independent driftだけがvalidation reuse可能で、control-plane/impact overlapはreconcile + revalidation。
- merge後はmerge commitのbase parentが直前に観測したdevelop SHAだったことをreceiptで確認する。異なる場合は「検証済みmerge完了」と扱わない。

この再読は品質gateを増やすものではなく、既存freshness判定と実際のmerge対象baseの間にあるrace windowを閉じるための座標確認である。

Ordinary CI, browser verification not explicitly requested, and DEV publication are not waiting stages after merge. The `develop` push starts DEV publication asynchronously.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
