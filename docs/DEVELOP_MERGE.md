# develop merge

The normal develop lane is:

```text
implementation on Draft PR
  -> final work-head commit contains [astra-validate]
  -> exact work head passes
  -> mergeability + dependency-impact freshness verification
  -> Ready
  -> same-task merge to develop
  -> asynchronous DEV publication
```

## Merge conditions

Immediately before merge, confirm:

- PR is open, same repository, base=`develop`
- no explicit hold / manual-merge marker / unresolved blocking dependency
- the exact PR head has one successful merge-owning validation from a real repository checkout
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

Ordinary CI, browser verification not explicitly requested, and DEV publication are not waiting stages after merge. The `develop` push starts DEV publication asynchronously.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
