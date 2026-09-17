# Micro Patch Fast Lane

## Status

This document is retained for compatibility/history. **Micro Patch is no longer a worker-facing authoring route.**

The original purpose was to avoid paying Draft / broad-validation fixed cost for tiny safe edits. That optimization is now absorbed by the [`Astra Outcome Contract`](ASTRA_OUTCOME_CONTRACT.md) and [`DEVELOPMENT.md`](DEVELOPMENT.md): Astra chooses the smallest sufficient context and evidence from the actual risk, and a short-lived task may create a Ready PR directly once its final outcome is complete.

Do not ask an implementation worker to classify a task as `Micro Patch` versus `Normal` before it can work. Do not use file-count or line-count thresholds as a routing ceremony.

## Preserved invariants

The retirement of the authoring split does **not** retire any quality boundary.

- work still starts from current `develop` on a short-lived branch;
- the final Ready exact head must include the current `develop` ancestry;
- true semantic conflicts are resolved from task intent + current repository contracts, never blind ours/theirs;
- the final reconciled head must have necessary evidence selected from the change risk;
- pushed head must equal the validated head;
- Ready still hands off to exact-head DEV checks, serialized expected-head/CAS Integration and DEV publication;
- main / Production gates are unchanged;
- implementation workers do not wait/poll for Ready-after CI, Integration or publication.

## What replaced the old thresholds

Old guidance such as `3 files / 30 lines`, control-plane exclusions and a separate Draft fallback existed to decide whether a special route was allowed. Under the Outcome Contract those characteristics are **risk signals**, not route selectors.

Examples:

- one CSS/copy edit may need only syntax plus affected UI evidence;
- one schema/security edit may need much more evidence despite being one line;
- several isolated presentation files may still be low risk;
- shared package, auth, schema/save/protocol, infrastructure, generated/binary/DCC and control-plane work use their specialist contracts because of what they can break, not because they exceeded a Micro Patch quota.

The worker may still use `npm run affected`, `npm run pre-ready:sync`, `npm run pre-ready:verify` and other helpers when useful. They are supporting tools, not a prescribed Micro Patch sequence.

## Integration compatibility

Historical workflow/script names may still contain `fast`, `micro`, `rescue` or similar terminology. Those names do not reintroduce worker-facing lifecycle states. For users and implementation workers the active states are `WORKING / READY / BLOCKED`; Fast Lane / Repair remain deterministic Integration implementation details.
