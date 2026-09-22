# PR #1433: PULSE supplemental-observation recovery

This receipt concerns the failed supplemental observation infrastructure, not completion of the 70-item game review.

## Authority and failure

- Existing branch: `fix/rinne-playreview70-20260922`; existing PR: #1433. No replacement PR.
- Initial current develop: `d286df34866f887d89a9cbcf8e5d794e9e316006`.
- Failed run: https://github.com/charukun/soul-lineage/actions/runs/35692139230
- Original observation head: `5e37003db11138ed5d65d8507c6d14986428b72d`.
- Status/run/job aggregation found no superseding success and no formal exact-head validation. Individual logs were then inspected because the aggregate did not contain the native exception.
- Dependency and Chromium installation succeeded. The script's caught native exception was not printed. Its evidence directory `.review70-supplement/` was excluded by the artifact uploader, so the diagnostic receipt was lost as well.
- The original native exception cannot be reconstructed from that lost receipt. Do not invent a gameplay root cause from the old red badge.

## Repair and recovered evidence

Recovery head: `d004852b75e6038dbf6db5b801e4b854c3b530e6`.

- Use visible `review70-supplement/` output, log the original exception/stack, persist `failure.json` before attempting the failure screenshot, and log screenshot failures.
- Preserve the native input sequence, scenario steps, action deadlines, screenshot deadline, and immutable source assertion. The final version identity is additionally fail-closed.
- Run the repository `actions:summary` before specialist observation and preserve its JSON alongside evidence.
- Successful recovery run: https://github.com/charukun/soul-lineage/actions/runs/35712869219
- Artifact: `10689201709`, `rinne-review70-before-supplement-d004852b75e6038dbf6db5b801e4b854c3b530e6`.
- Artifact bytes: `32537006`; SHA-256: `5192f5e39a453047b0d45685e37e8cf3174433ce89278ecd24471adc9b07ef1d` (download verified).
- Recovered: 20 PNG captures with JSON state/DOM snapshots, one native-input video, `receipt.json`, and `actions-summary.json`. All workflow steps, including native observation and artifact upload, succeeded.
- `receipt.errors` is empty. Start/end `version.json.commit` both equal `4866eb31c7bc9da1ead5379926aa6f805b117448`; `immutableVerified` is true.
- This intentionally replayed the original immutable Before (`c6f0625d-soul-lineage-rinne-dev.c-okamoto.workers.dev`), not mutable latest DEV. It is not visual evidence for subsequent develop changes.

## Limits: do not relabel as game acceptance

The old Before emitted 216 HTTP 404 responses for `/library/audio/fatigue/d68f34ffbc9dc7c48ee89dc8a7ab86d66640d5e6/breathing-tired.wav`. The observer records HTTP failures separately from JavaScript/fatal errors; its exit success does not certify clean game networking.

Navigation did not reach a real battle: the final two snapshots have `combat: false`; the final view is obstructed. Their filenames are scenario labels, not proof of battle/death/rebirth. Items 59-70, hardware touch/performance/thermals, and standalone battle2 are not certified by this recovery. These observations remain inputs to the original broader review; no game fix or 70-item completion is claimed here.

## Finalization

Reconciliation is required because develop changed the hosted-validation/control-plane contract, not merely because its SHA advanced. The final tree preserves current develop `97a9eec9193ed4b6edfda988cee4fa906dec31f2` and the existing observation scripts. Both task-only workflows are removed before merge-owning validation; no persistent Actions expansion or gate modification remains in the PR diff.

The final commit explicitly arms the current hosted specialist lane with `[astra-validate] [astra-heavy-validation]` and the two relevant `Astra-Check` directives. Formal exact-head validation, impact-aware freshness, and expected-head merge must still succeed before this PR is reported merged. Their final coordinates belong in the PR completion comment.
