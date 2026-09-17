# Browser verification and repair

Browser automation is **opt-in for normal develop work**. The source of truth for normal Integration is the exact-head DEV checks/build result and current GitHub state. main / Production browser gates remain unchanged.

Normal PRs targeting `develop` and normal DEV publication do not automatically launch gameplay/WebGL browser scenarios, create browser evidence artifacts, or create browser-repair tickets. A stale UI selector or presentation-only browser assertion must not turn an otherwise valid develop change red.

## Default develop route

`PR -> test-free DEV checks/build -> Integration Fast Lane -> develop -> DEV publication -> HTTP/source verification`

The default route deliberately excludes automatic unit/integration test execution, PR browser smoke, DEV candidate browser verification, post-publication DEV browser verification, and browser self-healing dispatch. Diff/syntax/static checks, code-health, affected builds when game inputs changed, exact-head evidence, deployment identity and HTTP/source verification remain active. Implementation sessions still run the focused tests they need before Ready.

## When browser verification runs

Browser automation is still available when it is actually requested or release-critical:

- the user explicitly asks to play, operate, or verify the app in a browser, following [`BROWSER_PLAYTEST_ROUTING.md`](BROWSER_PLAYTEST_ROUTING.md);
- `deploy.yml` is explicitly dispatched with `full_verification=true`, which runs the separate public browser/WebGL/P2P diagnostic suite;
- a specialist workflow explicitly requires browser evidence for its own artifact contract;
- main / Production publication, where the blocking browser gate is preserved.

An explicit browser run is diagnostic evidence unless the governing main / Production contract makes it blocking. It does not retroactively become a default develop merge gate.

## Browser failure handling

When an explicit browser run fails, inspect evidence in this order: JSON report, console/page errors, failed requests, screenshot, trace, then only the necessary Actions log excerpts. Network-only/transient failures may receive a bounded GitHub-side retry when the evidence supports that diagnosis. Repeated failures must be fixed, not hidden with retries or relaxed assertions.

If an explicit browser failure proves a source-level semantic defect, route it through the normal Chat Repair handoff described by [`INTEGRATION_DEEP_REPAIR.md`](INTEGRATION_DEEP_REPAIR.md). Do not start ChatGPT Work, Codex, OpenAI API, or an additional paid-model repair loop.

The repair Chat must:

- re-read current GitHub state before changing code;
- identify the smallest root-cause fix without weakening browser assertions, forcing input, or increasing deadlines to hide defects;
- repair the existing PR branch when the source PR is still open;
- create a normal short-lived repair branch/Draft PR from latest develop for a develop-scope defect;
- run focused checks/tests/build as appropriate, push, Ready -> `READY_FOR_INTEGRATION`, then stop without polling CI/browser/DEV;
- leave a true unresolved product/schema/save/protocol decision as `human-required` with the exact decision needed.

## Native input during animated UI transitions

When browser verification is explicitly run, a visible control may still be moving or briefly covered while a drawer opens. Browser helpers must wait within the existing input timeout for a positive-size native hit target, then send real pointer input. Permanent occlusion must still fail; do not force-click, inject DOM clicks, disable production animation, or extend scenario deadlines to hide it. Cover transient and persistent occlusion in regression tests.

## Legacy browser-repair records

Existing `browser-repair:v1` Issues and old `pr-browser-*` / `dev-browser-*` artifacts remain historical evidence only. The legacy `deploy.yml` repair recorder inputs/job and `scripts/browser-repair-ticket.mjs` execution entrypoint are retired; no normal or manual develop workflow recreates those tickets. Historical state parsing may remain solely for reading old evidence. Do not recreate the retired ChatGPT Work browser-repair trigger.

Explicit holds, Changes requested, unresolved threads, external/untrusted PRs, main and Production remain protected by their existing gates. Production target selection and blocking browser verification remain unchanged.
