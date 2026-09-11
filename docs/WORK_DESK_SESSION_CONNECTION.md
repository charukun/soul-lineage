# Session view: integration gate

Status: DRAFT. The UI is implemented; the ChatGPT-account broker is NOT implemented or connected. Do not merge or describe this as working account-wide task management.

## Required experience

The user must never register sessions, import exports, copy prompts, manually update progress, or configure per-task destinations. The two operations are checking an existing requested task and sending a follow-up to that same existing conversation. No product heading, onboarding, setup panels, or usage instructions belong on the normal screen.

Recent upstream activity determines order. Source refresh time does not. Verified completed tasks hide after 24 hours; other tasks hide after seven days without source activity. Hidden tasks remain available in history and automatically return when the source becomes active. Missing timestamps are explicit unknowns, not silently fresh or silently discarded. Runtime state older than two minutes is not live-running evidence. The end of a generated answer is not proof that the user's task is complete.

## Actual implementation boundary

`apps/rinne/public/work-desk/index.html` replaces the rejected manual ledger with a dependency-free session feed and a single follow-up composer. It retains no manual-registry fallback. Existing v0.1 localStorage is not read, exported, or deleted. No private account data, credentials, model calls, new paid service, or fake example sessions are shipped in the page.

The page calls a proposed same-origin broker at `./api/sessions`. This is OUR contract, not an existing OpenAI API, and not an implemented server. GitHub Pages alone will not fulfill it. Until a real broker is connected the page honestly shows an unconnected state, never a zero-task count or fake progress. Do not replace the existing public page with this blocked draft.

No usable integration for listing this personal ChatGPT account's live Chat/WORK sessions and sending into an arbitrary existing session was identified among the available tools or plugin search in this implementation turn. Scheduled tasks, GitHub pull requests, history exports, model API conversations, and a newly started worker are not substitutes for that access. Do not infer that an available GitHub connector shares its authentication with a public browser page.

## Proposed broker contract (not implemented)

- `GET ./api/sessions`: authenticated account-scoped snapshot. JSON fields: `version:1`, `source:"chatgpt"`, `connected:true`, `accountId`, `coverage:"complete"|"partial"`, `capabilities:{sendToExistingSession:boolean}`, `sessions:[]`.
- Session fields: `id`, `title`, `project`, `mode:"Chat"|"WORK"`, `summary`, `activityAt`, `state`, `stateObservedAt`, `stateEvidence`, `url`, `canSend`. Times are epoch milliseconds or ISO 8601. `state` is `running`, `waiting`, `review`, `blocked`, `done`, or `unknown`; evidence is `runtime`, `verified_task`, `assistant_report`, or `unknown`. Only explicit verified-task evidence may establish `done`. No session or task status may be manufactured from polling time or an old promise to work.
- `POST ./api/sessions/:id/messages`: body `{text,clientRequestId}` plus `Idempotency-Key`. A user click explicitly authorizes one follow-up to the selected existing session. The broker must check authentication, CSRF/Origin, per-session account ownership and authorization. It must durably deduplicate requests and preserve the original destination, model/mode, Project context, attachments, and approval boundaries. Never silently create a new conversation or redirect to a different worker.
- `GET ./api/sessions/:id/requests/:clientRequestId`: resolve an ambiguous delivery WITHOUT repeating POST. Response includes `sessionId`, `clientRequestId`, `status`, `source`, and the real upstream `messageId` when delivered. `queued` is not `delivered`; mismatched or missing receipt identifiers remain unknown.

Require HTTPS, secure HttpOnly same-site authentication, no-store private responses, no broad CORS, account isolation on reads and writes, rate limits and redacted logs. The public frontend must not hold a ChatGPT session token or GitHub personal access token. A static public JSON dump of private task metadata is not acceptable. Durable receipt recovery after a page reload remains a broker/client integration requirement; this draft retains unresolved requests and drafts in page memory only.

## Verification performed

- Node 22: 21 focused unit/security/contract tests passed.
- Chromium: 27 in-memory DOM checks with entirely synthetic fetch responses passed, including widths 320/360/412/768, recent sorting, hiding/reactivation, IME-safe submission, duplicate-submit prevention, unknown receipts, draft retention during refresh, and auth-loss clearing.
- The browser navigation attempt returned `ERR_BLOCKED_BY_ADMINISTRATOR`. Policies were NOT changed. Local HTML was rendered with Playwright `set_content`, with an in-memory test-only URL/fetch environment. These are UI tests, NOT network, public deployment, authentication, or ChatGPT integration tests.
- Full repository `npm ci`, monorepo fast validation/build, GitHub CI, and real-account end-to-end validation have NOT been claimed as completed here.

## Ready gate

Before removing draft/hold: obtain a supported, authenticated account/session integration; implement and authenticate the broker; prove automatic enumeration without user registration, real-session state changes, same-session follow-up delivery, identity/approval retention, and cross-account isolation with the user's authorized account. Add durable receipt recovery for reloads. Run affected fast validation and integration review. Keep develop/main/Production unchanged while this gate is unmet. Preserve the existing selective CI/CD and all three games.
