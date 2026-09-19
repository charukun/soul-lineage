# develop merge

The normal develop lane is:

```text
implementation on Draft PR
  -> current develop reconciliation
  -> final reconciled commit message contains [astra-validate]
  -> final reconciled head passes
  -> freshness verification
  -> Ready
  -> same-task merge to develop
  -> asynchronous DEV publication
```

## Merge conditions

Immediately before merge, confirm:

- PR is open, same repository, base=`develop`
- no explicit hold / manual-merge marker / unresolved blocking dependency
- current `develop` is included in the work head
- the final reconciled PR head has one successful merge-owning validation from a real repository checkout
- PR head still equals the `[astra-validate]` commit that passed merge-owning validation
- `develop` did not advance after freshness verification

If head or `develop` moved, reconcile first, make the new reconciled head a new `[astra-validate]` commit, and validate that head once. Never wait on, retry, or report superseded runs unless they expose a real defect that still exists in the current head.

## Explicit validation arming

`Astra Work Validation` creates no runner job for ordinary intermediate branch pushes.

Keep the PR Draft while implementing and reconciling. The commit that becomes the final reconciled branch head must contain:

```text
[astra-validate]
```

in its commit message. That push is the trigger for the one merge-owning validation run. This prevents small implementation commits from repeatedly cancelling and restarting the merge gate.

After the exact final head succeeds, mark Ready and merge immediately. Ready is transient, not a stopping point.

Ordinary CI, browser verification not explicitly requested, and DEV publication are not waiting stages after merge. The `develop` push starts DEV publication asynchronously.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
