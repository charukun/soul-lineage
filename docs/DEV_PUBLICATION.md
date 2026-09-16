# DEV publication fast path

DEV is the fast visual-review environment. Publication must not wait for heavy browser or full-regression verification.

This document is the focused contract for normal DEV publication. Where older Integration or browser-repair wording describes focused DEV browser checks as part of the publication gate, this fast-path contract governs: publication is build/snapshot/public-source gated, while browser diagnostics remain asynchronous repair evidence.

## Required DEV publication path

`develop -> assemble/build affected apps -> exact source/snapshot checks -> GitHub Pages promotion -> public HTTP/source verification -> DEV_DEPLOYED`

Blocking DEV publication checks are limited to work needed to prove that the generated snapshot is structurally valid and that the published public files belong to the intended develop SHA. Browser/WebGL/gameplay scenarios are not a prerequisite for DEV visibility.

The shared `verify-browser.mjs` keeps its assertions for PR, optional full verification, and Production use. The `publish` job on `refs/heads/develop` takes the fast path and does not execute those heavy scenarios.

## Browser verification and repair

Normal DEV publication does not launch a second all-app browser sweep. Browser failures originate from the existing asynchronous PR affected-browser smoke. If a failed PR browser result arrives after merge, the recorder promotes it to the current develop repair generation instead of discarding it.

A `browser-repair:v1` ticket is claimed by a separate repair worker. The worker fixes latest develop through a repair PR and returns it to Integration. The repair PR must obtain real browser success through the existing PR browser path. For a develop-scoped repair, that browser success moves the same ticket to `ready-for-integration`.

Final repair completion requires both pieces of evidence, without adding another heavy DEV browser pass:

1. the repair PR's browser verification is green; and
2. the repaired head is contained in a successfully published DEV SHA whose public HTTP/source identity is verified.

When both are true the same ticket becomes `verified`. If PR browser verification fails again, the same ticket returns to `pending` until the configured finite attempt limit is reached. This preserves the existing self-healing loop without putting browser latency back into DEV publication.

The repair path must keep assertion quality, exact-head evidence, hold/review/dependency rules, and `maxAttempts`. It must not weaken Production gates or modify `main`.

## Visual Review publication liveness

The fixed Visual Review URL is a non-blocking observation surface for the latest `develop`. Its publisher must have a trigger that can fire from the existing develop publication path without requiring the workflow file to exist on the repository default branch (`main`). Default-branch-only event types such as `workflow_run` or `workflow_dispatch` must not be the sole liveness path while the Visual Review workflow is intentionally develop-only. A `push` event is also insufficient as the sole path because Integration can update `develop` with `GITHUB_TOKEN`, whose resulting events do not create another workflow run.

The existing develop publisher already invokes the reusable PULSE/control-plane workflow with the exact publication SHA. That reusable workflow fans out an independent Visual Review reusable publisher with the same exact SHA. This fan-out is routing only: Visual Review build/deploy/public-check failure is recorded on `visual-review/public` but must not fail PULSE, normal Integration, or DEV publication.

Before deploying, Visual Review confirms that its source SHA is still the current `develop` head. Newer publication runs coalesce through the fixed `visual-review-develop` concurrency group. The optional `REVIEW_PREVIEW_ENABLED` repository variable is an opt-out switch: an unset value must not silently disable publication, while an explicit `false` may disable it.

Visual Review must not report public success from root HTML markers alone. A successful publication requires the fixed URL to expose `version.json` for the exact source SHA and a focused Chromium interaction check to load the bundled runtime, switch Review panels, load the character/motion iframe route, and observe the built-in battle simulation advancing. JS/CSS/module/request failures or a stale source identity make `visual-review/public` fail even when Wrangler deployment itself succeeded.

The focused browser harness may construct WHATWG `URL` objects for cache-busting and source identity, but every Playwright page-navigation target must be serialized to an HTTPS string before calling `page.goto`. A harness API type mismatch is a verification defect and must be covered by regression tests rather than retried or hidden.

PULSE must discover Visual Review from the exact develop `visual-review/public` commit status rather than requiring a separate top-level workflow run whose name contains `preview` or `visual review`. The publisher is intentionally a nested reusable workflow, so top-level workflow-name discovery is not a liveness contract.

## PULSE semantics

PULSE publication health follows the exact public DEV snapshot, not browser-repair state:

- publication pending: the exact develop snapshot is not public yet
- published: public HTTP/source identity is verified
- browser repair: tracked through the existing repair/Rescue diagnostics and must not keep an already published DEV snapshot in `DEV 公開待ち`

If automatic repair exhausts its configured attempts, the repair ticket remains the authoritative escalation record. PULSE may surface that existing diagnostic state, but it must not rewrite it as publication latency.

## Production

Production remains unchanged. Blocking browser/full-regression/public-source gates continue to apply to `main` / Production according to the existing Production policy.
