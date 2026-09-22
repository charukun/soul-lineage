# Git workspace / Codespaces recovery

Implementation always happens in a git workspace.

- Use the current checkout when available.
- Otherwise create a clone / worktree, or open the same branch in an existing Codespace.
- Keep the same branch and diff when switching workspaces.
- GitHub API / Connector may manage SHA, PR, review/status, and merge, but must not edit source/config/tests/docs.

A single git/network/auth failure is not a capability verdict. Move the same branch to another git workspace route and continue.

Useful recovery sequence:

```sh
git fetch origin
git switch <work-branch>
git pull --ff-only
npm ci
npm run pre-ready:sync
# affected focused validation
git push -u origin HEAD
npm run pre-ready:verify
```

Do not split or Base64-retry large binaries through Connector. Files over normal Git hosting limits require the repository's asset/LFS route.

Codespaces is only a remote git workspace; it does not change the PR, validation, Ready, merge, or DEV-publication contract.

Never change `main` / Production without explicit permission.
