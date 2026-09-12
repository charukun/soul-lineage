# Director DEV browser repair #95

Auto-Repair-Issue: #95

Original implementation #91 is merged as a745a00992a575e21dcbe7c1aba347780583247f. DEV HTTP/asset/source verification passed, but run 34686638237's focused browser gate failed.

Evidence artifact: dev-browser-a745a00992a575e21dcbe7c1aba347780583247f (10296067026).

The new native UI scenarios passed music pause/resume, prior-pause preservation, display preference, balance control presence, online modal, and scent guidance assertions. Subsequent Rinne combat produced zero hits but nonzero received damage and movement. This is NOT a paused engine: stop() deliberately stops RAF while step() advances. Adding UI interactions before the existing deterministic combat scenario changes its prior elapsed/RNG state. Initial paused-state suspicion was disproven by the trace.

Demon reached its unchanged audio playback checks at about 59.7 seconds. The extra native UI scenario and screenshot had consumed about ten seconds of the original 60-second monolithic test budget. Its r01 request returned 200 and playback started before the total test deadline expired.

Repair: give the new native UI scenarios independent browser contexts/tests. Preserve every assertion, the original combat scenario, existing 60/180-second deadlines, audio checks, and zero-retry/error policies. Share the same helper with the PR smoke follow-up #94. No gameplay, collision, save, age, combat, audio implementation or main/Production changes.

Success requires exact-head PR validation, trusted Integration, DEV source verification and all public browser cases passing. Do not close #95 manually before GitHub records verified.
