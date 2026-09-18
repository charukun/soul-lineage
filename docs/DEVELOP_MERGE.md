# develop merge

The normal develop lane is:

```text
implemented work-branch head
  -> exact-head focused validation
  -> current develop reconciliation
  -> focused revalidation on reconciled exact head
  -> freshness verification
  -> Ready
  -> same-task exact-head merge to develop
  -> asynchronous DEV publication
```

## Merge conditions

Immediately before merge, confirm:

- PR is open, non-Draft, same repository, base=`develop`
- no explicit hold / manual-merge marker / unresolved blocking dependency
- current `develop` is included in the validated work head
- affected focused validation passed on that reconciled exact head in a real repository checkout
- PR head still equals the validated exact head
- `develop` did not advance after freshness verification

If head or `develop` moved, reconcile and revalidate instead of merging stale work.

For Chat execution, GitHub Connector may construct the work-branch commit, while the `Astra Work Validation` GitHub Actions hosted runner provides the normal exact-head checkout used for focused validation. Connector / Code Mode inspection alone is not merge evidence.

Ready is a transient state. The same-task worker merges the exact validated PR head to `develop`; normal success is `MERGED_TO_DEVELOP`.

Ordinary CI, browser verification, and DEV publication are not waiting stages after Ready. DEV publication starts from the merged `develop` push and is asynchronous.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
