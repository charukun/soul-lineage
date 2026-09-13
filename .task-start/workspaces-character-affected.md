# Workspace affected-app repair

Develop baseline `8cee626e66f8ed64703a6b8c42e7f842474f6d00` fails `tests/workspaces.test.mjs` because the expectation still assumes `@soul/characters` only affects Rinne, while current app package dependencies include `@soul/characters` in Rinne, demon and village.

Scope: update the stale test expectation only, verify the focused test and repository fast validation, then hand the repair PR back to Integration. No gameplay, package graph, main or Production changes.
