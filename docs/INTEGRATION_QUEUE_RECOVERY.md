# Integration / PULSE queue recovery

## Acceptance contract

- PULSE feature-branch verification must not publish the shared public board or write a public deployment failure to a PR head when cancelled.
- Public PULSE delivery is develop-only and is separate from code-quality merge gates. Required fast/browser/review/hold gates remain enforced.
- Same-head metadata events must not supersede a required browser run with a skipped browser job.
- Trusted Integration and the existing watchdog/Rescue scan recover cancelled current-head CI and missed Integration requests with bounded retries. Old heads, explicit holds, review objections and real failures are not waived.
- Verify recovery against the current Ready queue and the published DEV source. Keep main/Production and additional paid API services outside this change.

## Implementation verification

- PR #144 / initial implementation tree `e1e50924359fb6da5cdedc1df5d899ed83f4a646`: fast validation 587 pass, 1 optional skip, all three game builds passed.
- Live #133 and #136: successful CI and cancelled PULSE `deploy` check/public failure verified from jobs and statuses.
- Live #138: build succeeded, browser cancelled, Integration request skipped.
- Live #126: actual fast failure is a nonexistent `.webp` reference; the repository asset is `.png`. A minimal reference correction passes the existing four tests without modifying assertions.
- The first #144 Ready run (34744670090) ran only Draft lightweight validation despite the current PR being Ready. CI now resolves current PR state/head through the read-only API before selecting Draft or Ready jobs. A green Draft run is never used as fast/browser evidence.
- Real merge, queue rescan and DEV delivery evidence will be added after completion.
