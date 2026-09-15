# DEV publication fast path

DEV is the fast visual-review environment. Publication must not wait for heavy browser or full-regression verification.

This document is the focused contract for normal DEV publication. Where older Integration or browser-repair wording describes focused DEV browser checks as part of the publication gate, this fast-path contract governs: publication is build/snapshot/public-source gated, while browser diagnostics remain asynchronous repair evidence.

## Required DEV publication path

`develop -> assemble/build affected apps -> exact source/snapshot checks -> GitHub Pages promotion -> public HTTP/source verification -> DEV_DEPLOYED`

Blocking DEV publication checks are limited to work needed to prove that the generated snapshot is structurally valid and that the published public files belong to the intended develop SHA. Browser/WebGL/gameplay scenarios are not a prerequisite for DEV visibility.

The shared `verify-browser.mjs` keeps its assertions for PR, repair, optional full verification, and Production use. The `publish` job on `refs/heads/develop` takes the fast path and does not execute those heavy scenarios.

## Browser verification and repair

Normal DEV publication does not launch a second all-app browser sweep. Browser failures normally originate from the existing asynchronous PR affected-browser smoke. If such a result arrives after merge, the recorder promotes the failure to the current develop repair generation instead of discarding it.

A separate DEV browser run is reserved for an active develop repair ticket after its repair PR browser result reaches `ready-for-integration` and the repaired develop SHA is already public. That final repair verification may be heavy because it is outside publication latency. Its result must not roll back or hide an otherwise valid DEV snapshot.

A repair failure is recorded on the same machine-readable `browser-repair:v1` ticket so a separate repair worker can claim it, fix latest develop through a repair PR, return it to Integration, and repeat until verified or the configured finite attempt limit is reached. A successful final repair browser run closes the same ticket.

The repair path must keep assertion quality, exact-head evidence, hold/review/dependency rules, and `maxAttempts`. It must not weaken Production gates or modify `main`.

## PULSE semantics

PULSE distinguishes publication from quality repair:

- publication pending: the exact develop snapshot is not public yet
- published: public HTTP/source identity is verified
- repair pending/working: DEV is already visible, but asynchronous browser diagnostics found a defect and self-repair is in progress
- repair exhausted: configured automatic attempts are exhausted and the ticket requires explicit follow-up

A failed asynchronous browser diagnostic must never be presented merely as an indefinitely growing `DEV 公開待ち` state.

## Production

Production remains unchanged. Blocking browser/full-regression/public-source gates continue to apply to `main` / Production according to the existing Production policy.
