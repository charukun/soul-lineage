# Browser self-healing

Browser failures are first-class repair events. The source of truth is GitHub: the failing run, its artifacts, a machine-readable repair issue, the repair branch/PR, and the final browser result. main / Production are never modified by this flow.

## Flow

### PR failure

`PR -> Validate and build -> Affected browser smoke -> failure -> repair issue(state=pending) -> ChatGPT Work -> same PR branch repair -> CI/browser rerun -> success -> Integration`

The PR browser job only checks affected apps (or all apps for infrastructure changes). It stores screenshots, Playwright trace, JSON console/network diagnostics and preview logs in the `pr-browser-<pr>-<sha>` artifact. Integration is not requested until the browser job succeeds.

### develop/DEV failure

`Ready PR -> Integration -> develop -> DEV publish/HTTP verification -> focused public browser verification -> failure -> repair issue(state=pending) -> ChatGPT Work -> repair/browser-issue-<N>-a<attempt> -> Ready PR -> PR browser success -> Integration -> DEV browser success -> issue verified/closed`

The public DEV browser artifact is `dev-browser-<develop-sha>`. A repair PR created for a develop ticket MUST contain `Auto-Repair-Issue: #N` in its body so the post-merge DEV verification reconnects to the same ticket.

## Machine-readable issue block

Every ticket contains exactly one block:

```text
<!-- browser-repair:v1
{"schema":1,"scope":"pr|develop","sourceKey":"...","state":"pending|working|ready-for-integration|verified|human-required","attempt":0,"maxAttempts":3,...}
-->
```

`sourceKey` deduplicates one failure source. A Work trigger may start only when `state == pending` and `attempt < maxAttempts`. Work MUST atomically claim the ticket before changing code by changing state to `working` and incrementing `attempt`. Issue edits produced by Work do not retrigger because `working` is ineligible. A failed rerun changes the same ticket back to `pending`; when `attempt >= maxAttempts`, it becomes `human-required` and automatic repair stops.

Do not create a second repair for an issue already in `working`, `ready-for-integration`, `verified`, or `human-required`. Do not remove `integration:hold`, resolve review objections, bypass branch protections, force-push develop, or change main/Production.

## ChatGPT Work GitHub event trigger

Configure one repository event trigger for GitHub issue opened/edited events in `charukun/soul-lineage` with this condition:

- issue body contains `<!-- browser-repair:v1`
- parsed state is exactly `pending`
- `attempt < maxAttempts`
- issue is open
- repository is exactly `charukun/soul-lineage`

Use this Work prompt:

```text
You are the browser self-repair worker for charukun/soul-lineage.

Read AGENTS.md, docs/DEVELOPMENT.md, docs/INTEGRATION.md and docs/BROWSER_SELF_HEALING.md. Treat latest develop and GitHub state as canonical.

The triggering GitHub issue contains a browser-repair:v1 JSON block. Re-read the issue before acting. Continue only if state=pending and attempt<maxAttempts. Claim it first by updating that same block to state=working, incrementing attempt by one, and setting claimedBy/claimedAt. If it is no longer eligible, stop without changing code.

Inspect the linked failing Actions run and download its browser artifact. Review Playwright trace, screenshots, JSON reports, console/page errors, failed network requests and relevant job logs. Find the smallest root-cause fix without weakening assertions or browser gates.

For scope=pr, repair the existing PR head branch when it is safe and still current. Preserve the original PR and let CI/browser rerun naturally.

For scope=develop, branch from latest develop using repair/browser-issue-<issue>-a<attempt>, push and open a Draft PR before code edits, then implement and fast-verify the fix, push it, and mark the PR Ready for review to develop. Include `Auto-Repair-Issue: #<issue>` and `Depends-On: none` in the PR body. Do not merge it yourself unless the session was explicitly assigned Integration.

Use normal git from Chat/WORK/Codex first, then the connected GitHub API, then Codespaces + normal git if transport/size prevents push. Never stop merely because one GitHub route fails.

Do not modify main/Production. Do not create parallel repair branches for the same issue. Do not retrigger yourself by changing state back to pending. Only GitHub browser verification may move a repair back to pending or forward to ready-for-integration/verified. If the issue reaches maxAttempts, leave it human-required with a concise root-cause summary and the next recommended human action.

The implementation worker ends after fast verification, push and Ready, without waiting for CI/browser completion or repeatedly polling it. Integration monitors the asynchronous result and returns a repair worker only on failure. End-to-end repair verification is not complete until GitHub records browser success. For a develop ticket, PR browser success is only ready-for-integration; final completion requires the repaired change to pass Integration, DEV publication and public DEV browser verification.
```

The repository creates the machine-readable event and enforces the loop guard. The ChatGPT account/project owns registration of the Work event trigger itself; repository code cannot register an account-level ChatGPT Work trigger.

## Evidence and failure handling

On each browser failure, inspect in this order: JSON report, console/page errors, failed requests, screenshot, trace, then full Actions job log. Network-only/transient failures may be retried once by the worker when evidence supports that diagnosis; repeated failure must be fixed, not hidden with retries or relaxed assertions.

Normal success has no repair issue. Auto-repair success closes a PR-scoped ticket after PR browser success, or a develop-scoped ticket only after repaired develop passes public DEV browser verification. Automatic repair exhaustion leaves the issue open in `human-required` with the failing run/artifact preserved.

## Native input during animated UI transitions

A visible control may still be moving or briefly covered while a drawer opens. Browser helpers must wait within the existing input timeout for a positive-size native hit target, then send real pointer input. Permanent occlusion must still fail; do not force-click, inject DOM clicks, disable production animation, or extend scenario deadlines to hide it. Cover both transient and persistent occlusion in regression tests.
