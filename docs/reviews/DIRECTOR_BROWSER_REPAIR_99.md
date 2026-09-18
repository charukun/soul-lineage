# Director deployment browser repair #99

Auto-Repair-Issue: #99

Source: develop 568ae450c02bf5c66ab0582a38a5b09293a68818. Issue was re-read pending/open/attempt0 and claimed working/attempt1 before remote repair. Claim timestamp is GitHub update time 2026-09-12T10:29:45Z (the initial claim text's 10:32 placeholder was not a measured time).

Evidence:
- run34688055447 / artifact10296291398: new native UI cases pass. Rinne's old12-second duel has0hits/0damage,127received,2opening techniques,2receptions,4.41travel. Not a paused engine; attacks are interrupted during the opening.
- run34687285498 / artifact10295619511: raw audio-range aborts were misclassified in the added UI cases; mixed environment targets tested intentionally unavailable prod music. Old monolithic Demon movement/save/audio scenario exhausted60 seconds.
- PR98 run34688335667: before Village case, Rinne PR UI assertions pass but raw blob media abort was counted as a failure.

Repair preserves actual gameplay and main/Production. Existing canonical media predicate is reused, not broadened: successful decoded playback with progress + same-origin blob + GET/media +206/audio +ERR_ABORTED are all required. Other failures retain diagnostics and fail.

The original audio assertions (150 tracks, decoding, progress, no error, stop) move to independent fresh-context60-second cases. DEV versus Production selection follows the existing workflow ref; the main blocking Production path remains covered and prod music absence is verified, not enabled. The separate observed prod SHINO asset404 is outside this DEV-only request and is not modified here.

The duel uses a fixed3600 simulation frames (60 seconds), with the original720-frame opening separately recorded. This changes the observation window, not game rules, browser timeout, damage or hit assertions; it is not retry-until-success. Original positive hit/damage assertions remain after the fixed complete encounter. Browser deadlines remain180/60 seconds, retries remain0.

Native pause/resume, prior pause preservation, balance display, music layout, guide, movement, visit history and model/WebGL checks are retained. Village first-build PR98 inherits the repair without duplicating its feature here.

Local verification:68 infrastructure tests pass, including7 new contract tests. Syntax and whitespace checks pass. Browser success and final DEV success must be verified from exact-head Actions; do not manually mark Issue99 verified.
