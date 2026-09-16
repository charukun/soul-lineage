# Browser self-healing

Browser failures are first-class repair events. The source of truth is GitHub: failing run, artifacts, machine-readable repair state, source PR/develop and final browser result. main / Production are never modified by this flow.

Browser verification is **asynchronous to Integration Fast Lane** on develop. A browser failure never globally freezes independent Ready PRs.

## Work-free flow

### PR failure while the PR is still open

`PR -> browser smoke -> failure evidence -> GitHub mechanical retry/diagnosis -> semantic source repair needed -> owner-notified Chat Repair Issue -> user starts normal Chat -> same PR repair -> CI/browser rerun`

The browser job stores screenshots, Playwright trace, JSON console/network diagnostics and preview logs in `pr-browser-<pr>-<sha>`.

GitHub Actions owns deterministic rerun/evidence handling. A source-level semantic repair must not start ChatGPT Work/Codex/API. It is converted to the same normal-Chat handoff defined by [`INTEGRATION_DEEP_REPAIR.md`](INTEGRATION_DEEP_REPAIR.md).

### PR browser failure arriving after merge

If the failed PR head was merged and remains an ancestor of current develop, promote the failure to a current-develop repair generation instead of discarding it as stale. Mechanical verification remains in GitHub. If code meaning must change, create an owner-notified normal-Chat handoff.

### develop / DEV failure

`develop -> DEV publish/browser -> failure -> GitHub evidence/retry -> semantic source repair needed -> owner-notified Chat Repair Issue -> normal Chat repair PR -> Fast Lane -> DEV browser verification`

A develop repair PR continues to include the originating repair Issue reference so final public verification can close the same recovery record.

## Machine-readable state and dedupe

Existing `browser-repair:v1` records may remain for browser-specific evidence and attempt bookkeeping. They are not a trigger for ChatGPT Work.

For source semantic repair, create or reuse the exact-head `integration-deep-repair:v1` + `chat-repair:v1` Issue. Deduplicate by failure source/exact head and never start a second source repair while the same current repair record already owns it.

Explicit hold, Changes requested, unresolved threads, external/untrusted PRs, main and Production remain non-repairable automatically.

## Normal Chat repair contract

The owner notification Issue contains a copy/paste prompt. The user manually starts a normal Chat; there is no background Work task.

The Chat must:

- re-read current GitHub state before changing code;
- inspect JSON report, console/page errors, failed requests, screenshot and trace first, and only the necessary job-log range after that;
- identify the smallest root-cause fix without weakening browser assertions, forcing input, increasing deadlines to hide defects, or disabling production animation;
- for an open PR, repair the existing PR branch only;
- for a develop-scope defect, create the normal short-lived repair branch/Draft PR from latest develop before code edits;
- use normal git -> connected GitHub API -> existing Codespaces + normal git only as transport fallback;
- never use ChatGPT Work, Codex, OpenAI API or additional paid model APIs;
- run focused checks/fast validation, push, Ready -> `READY_FOR_INTEGRATION`, then stop without polling CI/browser/DEV;
- leave a true unresolved product/schema/save/protocol decision as `human-required` with the exact decision needed.

## Evidence and retry handling

On browser failure inspect in this order: JSON report, console/page errors, failed requests, screenshot, trace, then necessary Actions log excerpts. Network-only/transient failure may receive a bounded GitHub-side retry when evidence supports that diagnosis. Repeated failure must be fixed, not hidden with retries or relaxed assertions.

Normal success has no repair handoff. Source repair is complete only when the repaired head passes the normal repository gates and the appropriate browser verification records success.

## Native input during animated UI transitions

A visible control may still be moving or briefly covered while a drawer opens. Browser helpers must wait within the existing input timeout for a positive-size native hit target, then send real pointer input. Permanent occlusion must still fail; do not force-click, inject DOM clicks, disable production animation, or extend scenario deadlines to hide it. Cover transient and persistent occlusion in regression tests.

An Integration run that requires public DEV verification must run browser cases even if deployment reuses every app artifact. An empty build delta does not certify a previously failed browser result. Production target selection and Production blocking gates remain unchanged.

## Legacy Work trigger

Any previous ChatGPT Work browser-repair trigger is retired. Do not recreate, re-enable or use it as fallback. Historical `browser-repair:v1` Issues remain valid evidence/recovery records, but source repair now routes through GitHub notification -> manually started normal Chat.
