# Task start

Fix the Integration Rescue liveness deadlock where a successfully returned exact repair head is re-quarantined by historical failures and the stale `integration/quarantine` pending status blocks normal Integration re-evaluation.

Canonical develop at task start: `b3fa2683f6238c8ea948bd32809e03846ca5fbea`.
