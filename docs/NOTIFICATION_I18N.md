# Notification language contract

Notifications must remain understandable without requiring repository owners or recipients to configure a language.

## Canonical transport contract

Generic lifecycle GitHub comments and the shared ntfy topic are broadcast transports. They do not expose a reliable per-recipient locale to the sender. Therefore transport payloads must not choose a human language through repository variables, secrets, environment variables, or per-user setup.

The first line is a locale-neutral lifecycle token:

- `[WAIT][READY_FOR_INTEGRATION]`
- `[INFO][INTEGRATED]`
- `[OK][DEV_DEPLOYED]`
- `[WARN][FAILED]`
- `[OK][BROWSER_VERIFIED]`

Lifecycle codes are stable machine data and are the authoritative meaning. Remaining transport fields use stable keys/codes such as `branch`, `commit`, `pr`, `verification`, `reason`, and `action`. A notification must never require a localized prose sentence to distinguish success, waiting, or failure.

No `NOTIFY_LOCALE`-style configuration is permitted for broadcast delivery. Adding a new human language must not require changing the notification producer, workflow configuration, or lifecycle protocol.

## Recipient-aware presentation

A UI that actually has recipient context may localize the canonical payload automatically from the runtime locale, for example browser language preferences. Locale detection must be automatic and must fall back to the canonical transport representation when no localized presentation is available.

Localization belongs at this presentation boundary. It must not alter lifecycle codes, delivery state, Integration gates, repair eligibility, or notification deduplication.

## Delivery semantics

`READY_FOR_INTEGRATION`, `INTEGRATED`, and `DEV_DEPLOYED` remain distinct. `FAILED` always carries a machine-readable reason/action when available. GitHub/ntfy delivery failure remains advisory and must not overwrite a verified implementation, Integration, or DEV result.

## Developer DEV change email

The current `docs/DEV_NOTIFICATION.md` contract separately requires a human-readable DEV change receipt on the associated PR, with its title, author mention and DEV URL. Preserve that Japanese developer notice and its deduplication; the locale-neutral lifecycle payload does not replace it. No repository locale variable is needed. Browser diagnostics remain asynchronous and the generic DEV receipt must not claim focused browser success.
