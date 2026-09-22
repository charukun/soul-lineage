# Browser repair #168

Source: develop `efe39406c7325ed6c6cb4be717b745acdb7b2114`
Failed DEV run: `34792769746`
Ticket: #168, attempt 2/3.

The public deployment and source/asset verification succeeded. Focused browser verification found two stale verification contracts:

1. Rinne music UI is intentionally paginated after the no-scroll UI change. `r01` exists but is not visible on filter page 1, while the browser test clicks it without navigating the real pager.
2. Demon currently exposes `data-world="night-hunt.v3"`; the public smoke still expects the superseded `night-hunt.v2` value.

Repair acceptance:
- reach the requested Rinne music track through visible native page controls, then keep the existing playback/currentTime/error/network assertions;
- assert Demon against the current authored world contract, without changing the Demon product just to satisfy an old test;
- no force click, DOM state injection, blanket timeout increase, request-failure suppression, main, or Production changes;
- exact-head CI/browser must pass before normal Integration retries the failed develop baseline.
