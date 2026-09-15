# Browser self-healing

Browser failures are first-class repair events. The source of truth is GitHub: the failing run, its artifacts, a machine-readable repair issue, the repair branch/PR, and the final browser result. main / Production are never modified by this flow.

Browser verification is **asynchronous to Integration Fast Lane** on develop. Current exact-head fast validation may allow a Ready PR to merge before its affected browser smoke finishes. Browser failure never globally freezes independent Ready PRs.

The [DEV feedback policy](RINNE_PROJECT_EXECUTION_POLICY.md#devで実物を確認する標準開発) applies to repair workers: make reversible choices within confirmed requirements, deliver through the existing gates, and use post-publication user feedback for further improvement. Optional visual feedback is not a new pre-DEV approval gate. Browser assertions, evidence requirements and finite repair attempts remain mandatory.

## Flow

### PR failure while the PR is still open

`PR -> Validate and build -> Fast Lane may merge independently -> Affected browser smoke -> failure -> repair issue(state=pending) -> ChatGPT Work -> same PR branch repair -> CI/browser rerun -> success`

The PR browser job only checks affected apps (or all apps for infrastructure changes). It stores screenshots, Playwright trace, JSON console/network diagnostics and preview logs in the `pr-browser-<pr>-<sha>` artifact.

If the PR is still open when browser failure arrives, the failure is owned by that PR's repair ticket. The Work worker repairs the same PR branch and normal CI/Fast Lane re-evaluates the new exact head.

### PR browser failure arriving after the PR already merged

A browser result may finish after Fast Lane has already merged the exact PR head. A failed result is **not discarded as stale** when that merged PR is still an ancestor of current develop.

The recorder promotes that failure into the current develop repair generation:

`merged PR browser failure -> current develop contains merge -> browser-repair:v1(scope=develop) -> ChatGPT Work -> repair PR -> Fast Lane -> DEV/public browser verification`

The promoted ticket records `promotedFromPrHead` so the original artifact remains traceable. If the PR is no longer current and was not merged into the current develop ancestry, the stale result is ignored.

### develop/DEV failure

`Ready PR -> Fast Lane -> develop -> DEV publish/HTTP verification -> focused public browser verification -> failure -> repair issue(state=pending) -> ChatGPT Work -> repair/browser-issue-<N>-a<attempt> -> Ready PR -> Fast Lane -> DEV browser success -> issue verified/closed`

The public DEV browser artifact is `dev-browser-<develop-sha>`. A repair PR created for a develop ticket MUST contain `Auto-Repair-Issue: #N` in its body so the post-merge DEV verification reconnects to the same ticket.

DEV/browser repair runs independently from the merge lane. New independently eligible Ready PRs can continue through Fast Lane while an older browser/DEV repair is pending. DEV publication coalesces toward latest develop; an older published candidate must not become authority after develop advances.

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

Read AGENTS.md, docs/DEVELOPMENT.md, docs/RINNE_PROJECT_EXECUTION_POLICY.md, docs/INTEGRATION.md and docs/BROWSER_SELF_HEALING.md. Treat latest develop and GitHub state as canonical.

The triggering GitHub issue contains a browser-repair:v1 JSON block. Re-read the issue before acting. Continue only if state=pending and attempt<maxAttempts. Claim it first by updating that same block to state=working, incrementing attempt by one, and setting claimedBy/claimedAt. If it is no longer eligible, stop without changing code.

Inspect the linked failing Actions run and download its browser artifact. Review Playwright trace, screenshots, JSON reports, console/page errors, failed network requests and relevant job logs. Find the smallest root-cause fix without weakening assertions or browser gates.

Follow AI implementation -> fast validation -> Ready -> Integration -> DEV publication -> user visual feedback -> AI correction. Within explicit requirements and current develop contracts, make and record reversible visual/interaction/implementation choices. Do not stop for technical difficulty or optional visual feedback alone. Before a specification-based human-required decision, record governing sources, attempted compatible repair, why a reversible DEV candidate cannot resolve it, and the exact missing decision. Preserve explicit holds, reviews, unresolved threads, approval/certification rules and claim/attempt limits.

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

An Integration run that requires public DEV verification must run browser cases even if deployment reuses every app artifact. An empty build delta does not certify a previously failed browser result: select all current DEV targets when no changed DEV target exists, and reject a manifest without DEV targets. Production target selection remains unchanged. The GitHub Actions repair-state dispatch is an operational handoff, separate from the mandatory exact-head fast/browser jobs; an API outage cannot manufacture a quality failure or success.

## DEV candidate timeout recovery (#279)

Run `34933929180` exhausted the existing 60-second demon scenarios during native input release and the first-hunt guide. Diagnose the elapsed work before treating the last assertion as a gameplay defect. Preserve pointer release, tap immobility, exclusive visit storage, guide/music pause, source identity, WebGL2 and console/network checks. Remove redundant diagnostic work only when equivalent failure evidence remains; do not extend deadlines, force inputs, or skip a failed scenario. The repair PR links `Auto-Repair-Issue: #279`, and only successful GitHub browser verification completes the repair.
