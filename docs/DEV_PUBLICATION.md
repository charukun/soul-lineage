# DEV publication fast path

DEV is the fast visual-review environment. Publication must not wait for tests, browser or full-regression verification.

This document is the focused contract for normal DEV publication. Normal develop delivery is snapshot/public-source gated. Gameplay/WebGL browser automation and full regression are opt-in rather than asynchronous default gates.

## Required DEV publication path

`develop -> plan changed app inputs -> build only changed apps when needed -> exact source/snapshot checks -> candidate manifest check -> GitHub Pages promotion -> public HTTP/source verification -> DEV_DEPLOYED`

Blocking DEV publication checks are limited to work needed to prove that the generated snapshot is structurally valid and that the published public files belong to the intended develop SHA. `node --test`, Browser/WebGL/gameplay scenarios, and unrelated app builds are not prerequisites for DEV visibility.

DEV app input hashes exclude control-plane-only `.github/**`, Integration/operational scripts, root tests and documentation. When those files change without changing game/build inputs, the publisher reuses the already published app outputs, skips `npm ci` and app validation/build preparation, and advances only the exact DEV source/snapshot identity. Build-system inputs such as root package/lock configuration and the app build coordinator remain hash inputs and may rebuild affected apps.

The normal `publish` job on `refs/heads/develop` does not invoke `verify-browser.mjs`, does not upload `dev-browser-*` evidence, and does not create a develop browser-repair ticket. Last Known Good DEV snapshots are retained after successful public HTTP/source verification.

## Browser verification is opt-in on develop

Normal develop PRs do not automatically run affected-browser smoke. Normal DEV publication does not run a candidate browser pass or a post-publication browser pass.

Browser verification still runs when explicitly requested through the browser playtest route, when `deploy.yml` is explicitly dispatched with `full_verification=true`, or when a specialist workflow owns a browser-evidence contract. These diagnostics are separate from normal DEV delivery.

A failure from an explicit browser run is evidence for diagnosis. If it proves a source-level defect, route semantic repair through the normal Chat Repair handoff without weakening assertions or turning browser automation back into the default develop gate.

Historical `browser-repair:v1` records and old `pr-browser-*` / `dev-browser-*` artifacts remain evidence only. The legacy browser repair recorder workflow/input/script are retired and do not trigger new develop browser work.

## Visual Review publication liveness

The fixed Visual Review URL is a non-blocking observation surface for the latest `develop`. Its publisher must have a trigger that can fire from the existing develop publication path without requiring the workflow file to exist on the repository default branch (`main`). Default-branch-only event types such as `workflow_run` or `workflow_dispatch` must not be the sole liveness path while the Visual Review workflow is intentionally develop-only. A `push` event is also insufficient as the sole path because Integration can update `develop` with `GITHUB_TOKEN`, whose resulting events do not create another workflow run.

The existing develop publisher already invokes the reusable PULSE/control-plane workflow with the exact publication SHA. That reusable workflow fans out an independent Visual Review reusable publisher with the same exact SHA. This fan-out is routing only: Visual Review build/deploy/public-check failure is recorded on `visual-review/public` but must not fail PULSE, normal Integration, or DEV publication.

Before deploying, Visual Review confirms that its source SHA is still the current `develop` head. Newer publication runs coalesce through the fixed `visual-review-develop` concurrency group. The optional `REVIEW_PREVIEW_ENABLED` repository variable is an opt-out switch: an unset value must not silently disable publication, while an explicit `false` may disable it.

Visual Review must not report public success from root HTML markers alone. A successful publication requires the fixed URL to expose `version.json` for the exact source SHA and a focused Chromium interaction check to load the bundled runtime, switch Review panels, load the character/motion iframe route, and observe the built-in battle simulation advancing. JS/CSS/module/request failures or a stale source identity make `visual-review/public` fail even when Wrangler deployment itself succeeded.

The same public success must cover both the desktop review surface and a smartphone touch profile representative of Pixel Fold-class portrait use. The mobile profile must use a narrow viewport around 390×844 with touch/mobile browser semantics, exercise the same Review navigation and embedded routes, and preserve separate screenshot/receipt evidence. A desktop-only pass must not certify mobile Visual Review usability.

The focused browser harness may construct WHATWG `URL` objects for cache-busting and source identity, but every Playwright page-navigation target must be serialized to an HTTPS string before calling `page.goto`. A harness API type mismatch is a verification defect and must be covered by regression tests rather than retried or hidden.

PULSE must discover Visual Review from the exact develop `visual-review/public` commit status rather than requiring a separate top-level workflow run whose name contains `preview` or `visual review`. The publisher is intentionally a nested reusable workflow, so top-level workflow-name discovery is not a liveness contract.

PULSE pre-publication browser checks that operate a dialog must scope controls to the owning dialog. Shared labels/classes such as `閉じる` / `.app-dialog-close` may exist in multiple independent dialogs; a global strict-mode locator must not prevent the updated PULSE entry surface from being published when the intended dialog is otherwise valid.

## PULSE semantics

PULSE publication health follows the exact public DEV snapshot, not historical browser-repair state:

- publication pending: the exact develop snapshot is not public yet
- published: public HTTP/source identity is verified
- explicit browser diagnostics: tracked separately and do not keep an already published DEV snapshot in `DEV 公開待ち`

PULSE may surface explicit diagnostic failures, but it must not rewrite them as publication latency or make them a normal develop merge requirement.

## Production

Production remains unchanged. Blocking browser/full-regression/public-source gates continue to apply to `main` / Production according to the existing Production policy.
