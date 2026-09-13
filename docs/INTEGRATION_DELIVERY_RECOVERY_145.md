# Integration delivery follow-up #145

After #144 merged through normal Integration, the new scan recovered #133/#136
and automatically retried #138's cancelled browser job (run 34738711082, attempt 2).
#126's separate missing reference-image extension was corrected on its existing PR;
its exact-head fast/build and browser gates passed.

The next DEV gate exposed independent evidence faults (run 34745291487):

- Demon reloaded after playing audio but collected playback evidence only after
  reload. The old document's valid 206 audio blob abort had no retained playback
  proof. Capture successful playback before reload; retain the strict audio,
  status, origin, playback and error predicates and all unexpected failures.
- Village's three intermediate diagnostic screenshots consumed 16.8 seconds of
  a 60-second interaction/persistence test. The trace completed construction,
  furnishing and exit, then exhausted the total budget during reload. Focused
  public verification omits those intermediate pictures while preserving every
  interaction/save/reload assertion, the 60-second deadline, final screenshot,
  automatic failure screenshot and trace. PR diagnostics retain all milestones.
- A second pending Pages publisher (run 34745557775) was cancelled when another
  arrived, and its result job wrote a false failure for the same SHA. A live
  develop verifier now owns its pending result. Observers do not duplicate its
  publication or start a continuation loop; the owner's successful result wakes
  the queue. Cancelled/skipped publication cannot write a failed quality result.

Issue #145 was claimed at attempt 1 before edits. Main/Production, review/hold
rules, real failed browser assertions and additional paid API services remain
outside this repair. Final live evidence is recorded in PR #147 and #144.
