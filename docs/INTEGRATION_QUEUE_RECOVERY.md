# Integration / PULSE queue recovery

## Acceptance contract

- PULSE feature-branch verification must not publish the shared public board or write a public deployment failure to a PR head when cancelled.
- Public PULSE delivery is develop-only and is separate from code-quality merge gates. Required fast/browser/review/hold gates remain enforced.
- Same-head metadata events must not supersede a required browser run with a skipped browser job.
- Trusted Integration and the existing watchdog/Rescue scan recover cancelled current-head CI and missed Integration requests with bounded retries. Old heads, explicit holds, review objections and real failures are not waived.
- Verify recovery against the current Ready queue and the published DEV source. Keep main/Production and additional paid API services outside this change.

Implementation and observed results are recorded here after verification.
