# develop merge

The normal develop lane is:

```text
implemented + focused validation
  -> current develop merge-forward
  -> focused revalidation
  -> push + freshness verify
  -> Ready
  -> same-task exact-head merge to develop
  -> asynchronous DEV publication
```

## Merge conditions

Immediately before merge, confirm:

- PR is open, non-Draft, same repository, base=`develop`
- no explicit hold / manual-merge marker / unresolved blocking dependency
- current `develop` is included in the validated work head
- affected focused validation passed on that reconciled head
- PR head still equals the validated exact head
- `develop` did not advance after freshness verification

If head or `develop` moved, reconcile and revalidate instead of merging stale work.

Develop PR CI is not a waiting stage. DEV publication starts from the merged `develop` push and is asynchronous.

`main` / Production keeps its existing blocking quality gates and requires explicit permission.
