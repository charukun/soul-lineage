# develop merge

The normal develop lane is:

```text
implementation on Draft PR
  -> current develop reconciliation
  -> arm one final-head validation with Astra-Validate: <head SHA>
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
- PR head still equals the head named by the `Astra-Validate: <head SHA>` marker
- `develop` did not advance after freshness verification

If head or `develop` moved, reconcile first, update the marker to the new final head, and validate that head once. Never wait on, retry, or report superseded runs unless they expose a real defect that still exists in the current head.

## Explicit validation arming

`Astra Work Validation` is not started for every branch push.

Keep the PR Draft while implementing and reconciling. When the branch is ready for its merge-owning check, edit the PR body to include:

```text
Astra-Validate: <current PR head SHA>
```

The PR-body edit is the trigger. This prevents small implementation commits from repeatedly cancelling and restarting the merge gate.

After the exact final head succeeds, mark Ready and merge immediately. Ready is transient, not a stopping point.

Ordinary CI, browser verification not explicitly requested, and DEV publication are not waiting stages after merge. The `develop` push starts DEV publication asynchronously.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
