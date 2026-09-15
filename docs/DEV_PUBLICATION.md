# DEV publication fast path

DEV is the fast visual-review environment. Publication must not wait for heavy browser or full-regression verification.

## Required DEV publication path

`develop -> assemble/build affected apps -> exact source/snapshot checks -> GitHub Pages promotion -> public HTTP/source verification -> DEV_DEPLOYED`

Blocking DEV publication checks are limited to work needed to prove that the generated snapshot is structurally valid and that the published public files belong to the intended develop SHA. Browser/WebGL/gameplay scenarios are not a prerequisite for DEV visibility.

## Browser verification and repair

Browser verification may run after DEV publication as an asynchronous diagnostic. Its result must not roll back or hide an otherwise valid DEV snapshot. A browser failure must be recorded as the existing machine-readable `browser-repair:v1` develop ticket so a separate repair worker can claim it, fix latest develop through a repair PR, return it to Integration, and repeat until verified or the configured finite attempt limit is reached.

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
