# Distribution Architecture

This document defines the distribution boundary for the three game apps and future consumer targets.

## Goal

One source app must be able to produce independent immutable artifacts for multiple targets without coupling DEV speed to Production or future store packaging.

The canonical shape is:

```text
app source
  -> affected dependency graph
  -> target build
  -> immutable artifact
  -> target-specific publisher / packager
```

The current apps are `rinne`, `village`, and `demon`. A change in one app must not force unrelated app builds. A shared-package change fans out only to apps whose workspace dependency closure includes that package.

## Target classes

| Target | Current status | Source branch | Purpose |
| --- | --- | --- | --- |
| `web-dev` | implemented | `develop` | fastest human review / device check |
| `web-review` | implemented foundation | `develop` | Visual Review bundle |
| `web-prod` | existing release path | `main` | current browser Production |
| `steam` | contract only | release candidate | future Steam package |
| `android` | contract only | release candidate | future Android package |
| `ios` | contract only | release candidate | future iOS package |
| `playstation` | contract only | release candidate | future PlayStation package |
| `switch` | contract only | release candidate | future Nintendo package |
| `xbox` | contract only | release candidate | future Xbox package |

A target marked contract-only must fail explicitly if asked to produce a release artifact. Do not emulate store packaging or claim readiness without the SDK/toolchain and platform adapter.

## Immutable artifact contract

Every target build has a stable identity:

```text
<app>/<target>/<source-sha>/
```

and carries an `artifact.json` receipt containing at least:

- schema version;
- app;
- target;
- source SHA;
- source branch;
- input hash;
- build timestamp;
- package/display name;
- artifact format;
- entry path when applicable;
- platform capability state.

A publisher consumes an artifact. It must not rebuild game source.

## DEV publication contract

DEV is app-scoped and latest-wins per app.

A `demon` change may publish `demon` while `rinne` or `village` work is in flight. A later `demon` source supersedes an older pending `demon` publication, but unrelated app publication must not be cancelled because another app advanced.

Until the public host is split from the legacy GitHub Pages site, the current Pages coordinator remains the compatibility publisher. The build/artifact layer introduced here is provider-neutral so a per-app Cloudflare/CDN publisher can be attached without changing game build semantics.

## Consumer packaging contract

Consumer packaging starts from the same portable game source but is a different target pipeline from `web-dev`.

Target adapters and packaging may own:

- storefront identity and entitlement;
- controller mapping;
- native lifecycle;
- cloud save;
- achievements;
- commerce;
- platform authentication;
- native asset conversion;
- signing/notarization;
- certification metadata.

These concerns must not leak into game/domain logic.

## Release safety

- `main` and Production remain unchanged unless explicitly authorized.
- Web DEV speed must not weaken Production/store quality gates.
- Contract-only targets remain unavailable until their adapter/toolchain is materialized.
- Target artifacts are immutable; promotion changes a pointer/release reference rather than mutating an old artifact.
- Cross-play and cloud-save capability claims remain false until backed by real adapters/services.
