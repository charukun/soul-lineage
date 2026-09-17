# Temporal semantics falsification continuation

## Status

Start source of truth: develop `604339a59cf7eea8a5011545fce72dce54b2651b` on 2026-09-18.

This loop is orthogonal to the integrated causal-provenance, randomness, replayability, privacy, firewall, transaction and rollback axes. It asks a narrower question: **what does “before/after/deadline/expired” mean for a protected action?**

Four time domains must not be silently substituted:

- **game/world time:** simulation/life progression that can be scaled or paused;
- **monotonic elapsed time:** local duration measurement for stalls/timeouts;
- **authority wall time:** the authority's physical-clock interpretation of arrival/expiry;
- **attested action time:** a stronger claim that a particular action occurred during a trusted physical-time interval.

No new clock protocol is introduced. Lamport physical/logical time, TrueTime-style uncertainty, and NTS retain priority. Sources are in `THEORY_TEMPORAL_SEMANTICS_SOURCES.md`.

Evidence classes remain A/B/C/D/E/F. Research-only executable evidence is in the corresponding script/test/evidence files and is not imported by runtime gameplay.

## 1. “Client says I acted before the deadline” is not locally verifiable from the claim alone

Let deadline `D=100`. The authority later receives one request at time 200 containing `claimedActionTime=99`.

Two executions are locally identical at the authority:

```text
honest:    actual action 99,  claim 99, arrival 200
dishonest: actual action 101, claim 99, arrival 200
```

If the claimed timestamp is not bound to a trusted event attestation, the authority sees the same request/arrival in both executions but the desired semantic answer differs.

**A:** no deterministic authority-local rule over that identical observation can both accept the first execution and reject the second.

**B:** `unauthenticatedClientTimestampWitness` preserves the pair.

Therefore an adversarially meaningful **action-time** deadline needs one of:

- a trusted mechanism that binds the action itself to time;
- a protocol that closes the action before a future authority event;
- or a different semantic contract such as authority-receive-time.

Authenticated clock synchronization alone does not create action attestation.

## 2. Authority receive-time is enforceable, but it is a different product rule

The authority can safely implement:

```text
accept iff authoritativeReceiveTime <= D
```

This avoids trusting the client's action timestamp. But an honest client that acts at 99 and whose message arrives at 120 is rejected.

**B:** the branch retains this witness.

So:

```text
“user acted before D”
!=
“authority received the operation before D”
```

Neither definition is universally correct. The game/product semantics must select one.

## 3. No finite grace window solves unbounded delay

Suppose the contract says:

1. every honest action performed before `D` must be accepted;
2. all arrivals after `D + G` must be rejected;
3. network delay has no finite upper bound.

For any finite `G`, choose an honest action at `D - ε` and delay it until `D + G + 1`. Conditions 1 and 2 conflict.

**A:** under unbounded delay, no finite grace window can simultaneously provide those two guarantees.

**B:** `finiteGraceCounterexample` instantiates `D=100`, `G=10`.

A finite grace period is therefore an engineering policy under a latency/failure assumption, not a proof that “action-time” and “receive-time” have become equivalent.

## 4. Explicit uncertainty is safer than false timestamp precision

If a physical-time source yields interval `[earliest, latest]` for the event and deadline `D`:

```text
latest < D    => definitely before
earliest >= D => definitely after
otherwise     => ambiguous
```

The boundary convention (`<` versus `<=`) is part of the policy.

**B:** the model returns `ALLOW`, `DENY`, or `AMBIGUOUS`. A wide interval around `D` is ambiguous; a later/refined narrower interval can become definitely-before.

This uses the same general design lesson as TrueTime: expose uncertainty instead of manufacturing one exact global instant [T2]. It does not imply that a browser has TrueTime-quality bounds.

For an irreversible protected action, `AMBIGUOUS` should be an explicit semantic branch such as delay/escalate/late-result rather than silently rounding toward the desired answer.

## 5. Secure time synchronization is not secure event timestamping

RFC 8915 NTS authenticates time-synchronization exchanges [T3]. That lets a client authenticate the source of time information under the protocol.

It does **not** by itself prove:

```text
this game action X was executed at timestamp t
```

by an adversarial client.

**B:** the structural witness distinguishes:

```text
secureTimeSync.authenticatedClockSample = true
secureTimeSync.bindsGameAction          = false

eventAttestation.bindsGameAction        = true
```

A future hostile-client action-time contract therefore needs an event-binding mechanism in addition to trusted time, or it must use authority-observed semantics instead.

## 6. Game time, wall time and monotonic elapsed time are intentionally different

Current Rinne already demonstrates the distinction rather than contradicting it:

- `rebuild/domain.js` exposes `CLOCK_RATES = [1,5,10,20]`; game/life progression is scaled.
- co-op invitation expiry compares `Date.now()` against a real-time `expiresAt`.
- co-op save stall/broadcast scheduling uses an injected `now()` defaulting to `performance.now()`.

These are different semantic clocks for different jobs.

**B:** the toy model shows ten real seconds can equal 10 or 200 game seconds depending on clock rate, while paused simulation advances zero game time. A separate witness shows wall time can jump backward while monotonic elapsed time remains positive.

Therefore:

```text
100 years of life  -> game/world time
15-minute invite   -> wall/authority time
3-second IO stall  -> monotonic elapsed time
competitive action -> declared receive/action-time contract
```

Converting them all to UTC would not simplify the semantics; it would change them.

## 7. Retry timeliness belongs to operation identity, not every packet delivery

Consider operation `op1`:

```text
arrival 90  -> accepted before deadline 100
commit/receipt succeeds
reply is lost
retry arrives 150
```

If the second packet is treated as a fresh deadline decision, the same already-accepted operation changes from accepted to late solely because its acknowledgement was lost.

The branch's operation store instead checks idempotency first:

```text
same operationId + same payload -> return prior receipt
same operationId + different payload -> conflict
new operation after D -> late
```

**B:** all three cases are tested.

This connects temporal semantics to the already established operation-id/replay discipline without reopening the capability/replay loop. The new point is specifically where deadline qualification attaches: **to the operation's accepted generation/decision, not each retransmission**.

## 8. Deadline policy is versioned semantics

Suppose generation 1 has deadline 100 and generation 2 changes it to 80. An operation received at 90 is:

```text
valid under generation 1
late under generation 2
```

Retaining timestamp 90 without retaining which policy generation applied is insufficient.

**B:** `deadlineGenerationWitness` preserves exactly this split; the store rejects a request declaring an obsolete generation after the policy is updated.

A protected temporal predicate therefore binds:

- deadline policy/root;
- deadline generation;
- clock domain;
- boundary convention;
- operation identity.

This is analogous to rule-root binding from prior loops, but it closes a distinct temporal ambiguity rather than adding a generic version field for its own sake.

## 9. Surviving temporal contract

```text
Temporal(action) = {
  clockDomain:
    game
    | monotonic
    | authority-wall
    | attested-wall,

  deadlineKind:
    game-time
    | authority-receive-time
    | attested-action-time
    | lease-expiry
    | none,

  deadlineValue,
  deadlinePolicyRoot,
  deadlineGeneration,

  boundaryConvention,
  uncertaintyModel?,
  ambiguousOutcomePolicy?,

  retrySemantics: operation-id-anchored,
  firstAcceptanceReceipt?,

  clockAuthorityRoot?,
  actionTimestampAttestation?,

  failureMode:
    reject
    | ambiguous-escalate
    | explicit-late
    | delay
}
```

This is a semantic contract, not a time service.

## 10. Placement rule

Use the weakest clock that expresses the actual semantic requirement:

- simulation aging/cooldowns that intentionally scale with game rate: game clock;
- local elapsed implementation health: monotonic clock;
- invitation/session expiry defined by real time at an authority: authority wall clock;
- adversarial claim “the user performed protected action before real-world deadline”: attested action-time or a protocol that avoids needing that claim.

Do not strengthen ordinary game-time mechanics into distributed physical-time problems unnecessarily.

## 11. Evidence boundary

### A / delegated theory

- physical-time specifications require explicit real-clock accuracy/synchronization assumptions [T1];
- unbounded delay defeats any finite grace guarantee that simultaneously promises acceptance of all predeadline actions and rejection after a finite cutoff;
- identical authority observations cannot distinguish honest/forged client action timestamps without additional trusted evidence;
- TrueTime-style interval exposure and NTS authentication remain their source systems' mechanisms [T2/T3].

### B

17 focused tests / 9 bounded witness classes cover:

- unauthenticated action-time indistinguishability;
- receive-time/action-time mismatch;
- finite-grace failure;
- secure-time versus event-attestation distinction;
- game/wall/monotonic domain mismatch;
- wall-clock jump;
- retry-after-deadline idempotency;
- deadline generation binding;
- uncertainty interval ambiguity.

### C

Any deployed guarantee depends on the declared delay, clock, trust, event-attestation and authority assumptions.

### D

Grace windows, ambiguous-result UX, acceptable real-time accuracy and which actions deserve physical-time semantics.

### E

Real network delay distributions, browser/device clock behavior, NTP/NTS quality, external clock-service latency/availability, ambiguity frequency.

### F

- map all real protected Rinne deadlines/leases to explicit domains;
- prove runtime paths cannot silently substitute clock domains;
- define any real trusted action-time attestation if ever required;
- compose policy-generation updates with in-flight operations;
- formalize pause/rate-change semantics for game-time deadlines;
- browser suspend/resume and device clock-change behavior;
- machine-checked runtime-to-temporal-contract refinement.

## Stop boundary

The loop stops before “use a better synchronized clock” or “increase grace.” Those are not general solutions.

The material result is the placement rule:

> **A deadline is not a timestamp field. It is a predicate over a named observer, clock domain, uncertainty model, policy generation and operation identity.**

A next orthogonal loop should move to heterogeneous platform/attestation trust or incentive-compatible authority selection rather than another clock variant.
