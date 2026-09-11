# Session Desk 0.1 — partial account-management foundation

## Scope and capability boundary

The requested end goal is account-wide discovery of active ChatGPT sessions and task dispatch from a phone. This release does **not** accomplish account-wide discovery, live WORK runtime monitoring, or automatic dispatch into existing ChatGPT conversations. No supported connection for those account-wide operations was available in this implementation environment. Do not describe the registry count as the account's total, a report as a liveness check, or a saved request as a running task.

Implemented: encrypted browser-local registry; URL registration; grouping/search/archive; local ChatGPT export ZIP/conversations.json metadata import; latest manual/WORK reports and stale-report warnings; WORK/Integration prompt drafting and explicit manual handoff; separate public GitHub PR/recent develop Actions indicators; encrypted backup/restore; narrow-scope static service worker and mobile layout.

No history, task text, password, token, cookie, or runtime credential is committed to this repository. The production UI starts empty. Test data is synthetic.

## Deployment without changing games or infrastructure

Source: `apps/rinne/public/session-desk/`. This is an independent static utility, not part of the game bootstrap and not a fourth game. Vite's existing public directory copy includes it in `dist/rinne/session-desk/`, and the existing per-app manifest inventories it. There are no imports from game code, new packages, workflow edits, lockfile changes, or main/Production edits. The rinne artifact changes only to carry these additional static files; existing outputs continue through normal retention rules.

Expected DEV entry after successful Integration: `https://charukun.github.io/soul-lineage/dev/rinne/session-desk/`. This document names an expected destination, not proof of publication. Verify exact commit, existing CI/Integration, HTTP assets, and the utility itself before reporting publication/functional completion.

Use the existing WORK -> affected fast verification -> Ready PR -> Integration flow. Do not bypass checks, force-push, change protection, or self-manufacture approval. No additional daemon, model calls, paid backend, scheduler, or new hosting service is introduced.

## Phone use

Open over HTTPS, choose a separate local-data passphrase (not the ChatGPT account password), then import an export ZIP/JSON or register conversation URLs. The official export flow is described at https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data . The app reads titles, IDs, explicit project metadata and timestamps, not message bodies or attachments. Missing project/type/runtime information remains unknown. An export is a snapshot, not live sync.

Task creation saves an unsent draft. Copy the resulting prompt and open the linked ChatGPT conversation to send it. Only the user's explicit sent-record button records manual transmission; it does not prove receipt, execution, or completion. The existing account subscription is not an API credential, and this implementation makes no model API requests.

WORK report import format (fill actual URL/time/status; do not invent them):

```json
{"schema":"session-desk.report/v1","session":{"url":"https://chatgpt.com/c/ACTUAL-CONVERSATION-ID","title":"Task title","project":"Project name","location":"WORK","status":"ready","reportedAt":"2026-09-12T00:00:00Z","note":"Actual verification / PR reference"}}
```

Supported statuses: unknown, queued, running, waiting, blocked, ready, completed. Running/completion are reports, never independently confirmed runtime. Future-dated report imports are rejected beyond five minutes of clock tolerance. Older reports do not overwrite newer reports; 90 minutes without an updated running/waiting/blocked/ready report adds a warning, not a failure assertion.

## Data, privacy, and limits

AES-256-GCM with fresh 96-bit IV per save, PBKDF2-SHA256 (310000 iterations, random 128-bit salt); the key/passphrase are not persisted. This protects stored data at rest, not an unlocked device or a compromised serving origin. All GitHub Pages paths on charukun.github.io share an origin: this utility is not an origin-isolated security boundary. An independently authenticated private backend/origin is required before expanding into cloud-sync or remote execution.

Local storage capacity and browser eviction still apply. Encrypted backups and their passphrase are required for recovery; no cross-device automatic sync or password recovery. Idle lock occurs after 15 minutes of no interaction. Public static assets do not contain user data. No analytics or ChatGPT cookies/API keys are requested. CSP restricts networking to self and the public GitHub API; GitHub reads omit browser credentials. The service worker controls only the utility subtree and caches only its static shell, never GitHub API responses/history.

Imports: up to 10000 registered conversations; JSON size up to 64 MiB; ZIP methods stored/deflate with CRC/size validation, no ZIP64/encrypted/split archive support. Only conversations.json is decompressed; image attachments are ignored. Unsupported exports fail explicitly. The task list displays the most recent 200 saved drafts/records; storage validation caps total at 5000.

GitHub: public repositories only, manual refresh and first-tab fetch; up to 500 open PRs (pagination/truncation labeled), latest 10 develop Actions runs. A past failed run is not necessarily unresolved. Rate limits, API errors and offline states keep the previous snapshot and show an error. There is no background polling, account-wide repository discovery, privileged GitHub write, or automatic merge.

## Validation record and remaining acceptance

Local checks: JS syntax; 20 Node data/security-boundary tests; native Node WebCrypto roundtrip/wrong-key/fresh-IV checks; offline Chromium DOM rendering/search/dialog/tab checks at 360/390/734/1280 px. Synthetic data only. Native browser navigation was blocked by the execution environment's administrator policy, so these local checks are **not** full browser-origin storage/ZIP/import/service-worker/live-network acceptance. Do not claim those were tested end to end. Integration CI and public verification must be recorded separately with actual run IDs and results.

Run data tests with `node --test apps/rinne/tests/session-desk.test.mjs` from the repository. Keep utility browser acceptance separate from unrelated game E2E; reuse existing Integration, do not rewrite it for this feature.

Remaining end-goal work: obtain an officially supported, user-authorized account/session read-and-dispatch connection; define its permissions, authentication, event-driven updates and verified runtime states; then connect it behind an isolated authenticated service. Do not use copied account cookies, reverse-engineered private endpoints, invented live status, or paid model execution without explicit configuration and cost agreement.
