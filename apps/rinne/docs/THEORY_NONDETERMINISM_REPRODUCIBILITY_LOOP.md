# Nondeterminism / reproducibility falsification continuation

## Status

Start source of truth: develop `6fc205a3e631f4d962a9fbbf43bb2fd273ad92b0` on 2026-09-18.

This loop does **not** repeat the already-integrated debates about evidence minimization, capability attenuation, cross-domain commit, compiler/firewall completeness, fork detection, or rollback anchors. It attacks a different hidden premise: **that an irreversible Canon fact can be independently justified by replaying "the same inputs".**

The result is not a new network protocol. It adds a missing replayability dimension to the existing semantic architecture and narrows where independent verification is actually possible.

Evidence classes retain the existing meaning:

- **A** conditional proof/argument or delegated theorem under explicit premises.
- **B** bounded executable evidence.
- **C** required assumption.
- **D** engineering heuristic.
- **E** physical/performance measurement.
- **F** unresolved proof/refinement obligation.

Primary references are in `THEORY_NONDETERMINISM_REPRODUCIBILITY_SOURCES.md`.

Research-only executable evidence:

- `../scripts/reality-reproducibility-model.mjs`
- `../tests/reality-reproducibility.test.mjs`
- `../scripts/reality-reproducibility-proof.mjs`
- `evidence/RRP_NONDETERMINISM_REPRODUCIBILITY_20260918.json`

None is imported by runtime gameplay.

## 1. "Same commands" are insufficient when the transition is not a function of them

Write one protected transition as

```text
s' = T_v(s, c, eta)
```

where:

- `s` is prior semantic state;
- `c` is the recorded game command/input;
- `eta` is all decision-relevant nondeterminism not already in `c`;
- `v` is the execution semantics/version, including numeric behavior.

An input-only replay assumes that `T_v(s,c,eta)` is independent of `eta`, or that `eta` is uniquely derivable from the recorded history.

If two admissible executions have the same recorded `(s,c)` but `eta1 != eta2` and produce different protected outcomes, then no verifier receiving only `(s,c)` can reconstruct which historical outcome happened.

This is a direct **A indistinguishability argument**. It is the same reason replicated state machines require deterministic transitions and record/replay systems record nondeterministic events.

**B:** the branch model uses one identical input with two hidden entropy values and produces two different critical-hit outcomes. Recording the entropy closes the toy replay.

### Consequence

A Canon event must not be called "replay verified" merely because its player inputs were logged. Its **causal replay closure** must include every nondeterministic value on which the protected decision actually depended.

Typical sources include:

- entropy/randomness;
- effective simulation time-step sequence;
- external service/oracle response;
- concurrency/order choices;
- rule/kernel version;
- implementation-dependent numerical behavior if it can cross a decision boundary.

The architecture does not need to record every presentation detail. It needs closure over the causes of the protected semantic decision.

## 2. Current solo Rinne is deliberately frame-cadence dependent

At the start develop SHA:

```js
splitRuntimeFrameDelta(.100) -> { simulationDelta: .050, lifeDelta: .100 }
splitRuntimeFrameDelta(.050) -> { simulationDelta: .050, lifeDelta: .050 }
```

Therefore the same 100 ms of wall time can be partitioned as:

```text
one 100 ms frame:
    total simulation time = 50 ms
    total life time       = 100 ms

two 50 ms frames:
    total simulation time = 100 ms
    total life time       = 100 ms
```

The executable model applies a constant-speed transition and gets position `.2` versus `.4` while life time is identical.

The position calculation is only a **B explanatory witness**, not a claim that the production character necessarily travels exactly those distances in that scenario. The stronger repository observation is direct: current `runtime-clock.js` discards simulation time above 50 ms per render frame rather than accumulating the remainder, while `runtime.js` feeds that capped value to movement/combat and uncapped elapsed time to life progression.

This can be a perfectly legitimate real-time design choice to avoid catch-up spirals. But it means:

> a solo replay consisting only of player inputs plus total elapsed wall time is not an exact reproduction contract.

Exact replay would additionally need the effective step sequence, or the protected semantic computation would need to move onto a fixed logical clock.

## 3. Co-op is substantially closer to deterministic replay, but not proven portable

`CoopWorld.advance()` accepts explicit `dt <= .05`, the current host session advances by `.05`, player rows are sorted, and co-op identities are rewritten to deterministic `playerId:generation` values.

That removes several sources of replay ambiguity present in the solo path.

It does **not** establish bit-identical heterogeneous replay.

Current combat uses JavaScript `Math.sin`, `Math.cos`, `Math.atan2`, `Math.hypot` and related operations. ECMAScript classifies many of these as **implementation-approximated**: conforming engines have latitude in approximation algorithms for ordinary arguments. The combat façade is also a floating-point simulation stepped by `dt`.

Therefore:

- fixed `dt` is necessary for an input-lockstep style proof but is not sufficient;
- seeded pseudo-randomness is useful but does not make the whole numerical transition portable;
- "same JavaScript source" is not itself a bit-identical numeric machine contract.

This is a specification boundary, not evidence that Chrome and Firefox currently disagree on a particular Rinne fight. Actual cross-engine divergence frequency remains **E**.

## 4. Tiny numerical differences matter only when they cross semantic boundaries

Reject the opposite overreaction: "floating point is not bit-identical, therefore replay is useless."

Suppose an approximate verifier computes scalar `x_hat` with a proved error bound `epsilon` relative to the true semantic quantity `x`.

For decision `x >= theta`:

```text
if x_hat - epsilon >= theta:
    TRUE is certified

if x_hat + epsilon < theta:
    FALSE is certified

otherwise:
    UNKNOWN
```

This is a simple **A interval argument**. The true `x` lies inside `[x_hat-epsilon, x_hat+epsilon]`. If that whole interval is on one side of the threshold, every admissible true value gives the same Boolean result.

If the interval crosses the threshold, returning either Boolean would exceed the proof.

**B:** the executable model verifies the three cases and kills the mutation that treats the point estimate as exact.

This is analogous in spirit to robust numerical predicates: spend more precision/work only near a boundary.

### Important limit

The argument is only as strong as `epsilon`.

For a long chaotic combat simulation, proving a useful end-to-end error bound may be harder than simply using an exact discrete kernel for the irreversible predicate. Therefore bounded replay is an optional class, not an excuse to attach an arbitrary tolerance.

## 5. Exact replay does not require bit-identical rendering or whole-world state

The strongest practical repair is narrower:

```text
presentation / camera / particles / interpolated movement
    may remain ordinary floating-point and device-dependent

protected semantic transition
    uses a versioned deterministic kernel
    over explicit ordered semantic inputs
```

The branch toy kernel uses integer HP, millimetre position and stamina plus ordered ticked events. Two independent executions produce the same trace root exactly.

This is **B**, not a proposal to convert the whole Rinne game to fixed point.

The point is placement:

- life identity, rebirth lineage, unique-resource consumption, reward grant, final death, or other irreversible facts may justify exact discrete semantics;
- camera interpolation, animation pose, particles, audio, and most transient movement do not.

This preserves the earlier Semantic Frontier idea while adding a new condition: a fact advertised as **independently derivable** needs deterministic derivation semantics, not merely durable consensus.

## 6. External results are historical inputs, not re-query instructions

If a protected decision depends on an external service, replaying the old **request** against the current service is not historical replay.

Toy witness:

```text
epoch 8 oracle: allowed = true
epoch 9 oracle: allowed = false
```

Re-querying at epoch 9 rewrites history. The historical response, or an authoritative receipt for it, is a causal input to the original decision.

**A:** if two service states map the same recorded request to different outputs, the request alone does not determine the historical output.

**B:** the branch retains this counterexample.

This matters for future AI/LLM-generated world facts, remote anti-cheat decisions, weather/economy services, platform identity, or any other external semantic dependency. It is not limited to randomness.

## 7. Three replay contracts are enough; do not force one mechanism everywhere

The previous architecture needs one additional declared field:

```text
replayability =
    exact-deterministic
  | bounded-robust
  | authority-only
  | unclassified
```

### exact-deterministic

Use when an independent verifier can re-execute a versioned transition from:

- a stable initial semantic state/root;
- ordered semantic inputs;
- all decision-relevant entropy/oracle results;
- declared deterministic machine/numeric semantics.

This is the strongest independent derivability class.

### bounded-robust

Use when exact state differs but the protected predicate has:

- a justified numerical/error interval;
- a decision margin that does not intersect the boundary.

Boundary cases become `UNKNOWN`, not guessed truth.

### authority-only

Use when the historical fact depends on a trusted source or computation that cannot be independently re-derived under the product's cost/threat model.

Replay can still verify:

- receipt authenticity;
- ordering;
- binding to the correct operation/state;
- non-replay and other structural properties.

It cannot honestly claim to prove the underlying historical gameplay fact independently.

### unclassified

Fail closed for claims of replay verification. The runtime may still function under its explicitly declared authority model.

## 8. Rinne mapping at the current source

### Solo life runtime

Current status: **not exact-replay classified**.

Reasons:

- initial seed derives from `Date.now()`;
- life id uses `Math.random`;
- simulation step sequence is render-frame dependent;
- combat contains floating-point/transcendental operations.

This is not a product defect for local single-player. It is a reason not to reuse an input-only solo replay as proof of a future shared irreversible Canon fact.

### Friend-hosted co-op simulation

Current status: **candidate for a narrower deterministic semantic kernel, not proven exact cross-engine replay**.

Positive properties:

- fixed `.05` logical advances;
- deterministic player iteration order;
- deterministic co-op life identities;
- deterministic game-derived seeds in several places.

Remaining issue:

- actual protected combat outcomes still transit floating-point/Tidebreak semantics whose heterogeneous determinism has not been certified.

### Lineage/rebirth structural history

Current status: **already intentionally structural rather than gameplay-proof**.

`coop/history.js` explicitly states that host-attested progress is not proof of honest gameplay. That is the correct distinction.

It can validate deterministic structural invariants such as:

- monotone generation;
- sealed prior life before rebirth;
- expected life id;
- immutable lineage relationship.

It need not retrospectively prove every combat frame that led to the life ending unless the product later requires that threat model.

## 9. Counterexamples rejected in this loop

### "Seed the RNG and replay is solved"

Rejected. A seeded RNG closes only one `eta` source. Frame partition, external inputs, scheduling and implementation-approximated numerical operations remain.

### "Fixed timestep means exact cross-device replay"

Rejected. It removes one time source but does not constrain every numeric function/runtime behavior.

### "Consensus on the outcome proves the outcome was correctly simulated"

Rejected as a category error already visible in SMR theory. Consensus can agree on a command/result while deterministic execution correctness is a separate premise.

### "Store the final state hash and replay against it"

A hash detects mismatch; it does not identify which hidden nondeterministic input was missing or which execution was semantically correct.

### "Use epsilon equality on the final state"

Rejected for protected threshold decisions unless the error bound and decision margin are proved. An arbitrary epsilon can hide exactly the boundary flip the replay is meant to validate.

### "Record every render frame forever"

This can make a particular execution more reproducible but defeats the semantic-compression goal and still binds verification to current engine semantics. Prefer explicit semantic inputs or an exact small kernel for protected decisions.

## 10. Architectural reconstruction

The RRP/Semantic Frontier architecture now has a cleaner distinction:

```text
Consensus / Canon
    answers: which irreversible fact was accepted?

Semantic commit firewall
    answers: was this operation currently authorized?

Replayability contract
    answers: can an independent verifier derive the fact,
             only derive its predicate robustly,
             or only authenticate the authority that asserted it?

Realtime/presentation
    answers: what should this observer render now?
```

Those are separate questions.

For future protected effects, the development rule should be:

1. declare the semantic predicate;
2. classify its replayability;
3. if `exact`, isolate a deterministic discrete kernel and explicit causal inputs;
4. if `robust`, supply a real error bound and reject boundary uncertainty;
5. if `authority-only`, state the trusted authority instead of pretending replay proves truth;
6. never promote `unclassified` to "verified" by adding more hashes.

No new protocol name is warranted. Deterministic state machines, record/replay, robust predicates and fixed-step simulation retain prior-art priority.

## Executed B evidence

Authoring workspace: Node v22.16.0 / Linux x64.

- focused tests: **12 passed / 0 failed**;
- `node --check` passes for model, test and proof runner;
- witness checks: **9/9 passed**;
- retained counterexamples:
  - frame partition with equal wall time and unequal simulation advance;
  - hidden entropy under identical recorded input;
  - implementation-approximation threshold flip;
  - current-oracle-vs-historical-oracle mismatch;
  - causal replay closure missing `dt` and entropy;
- reconstructed exact integer event kernel replays to an identical trace root;
- source SHA-256 hashes are recorded in `evidence/RRP_NONDETERMINISM_REPRODUCIBILITY_20260918.json`.

This is bounded evidence, not a cross-browser determinism certification.

## Stop boundary

### A / reduced

- input-only replay cannot reconstruct an outcome that also depends on an unrecorded nondeterministic value;
- a threshold result is robust under bounded numerical error only if the whole error interval lies on one side of the boundary;
- fixed logical timestep solves frame-partition nondeterminism, not every form of implementation nondeterminism;
- agreement on an output and independent derivability of that output are distinct properties.

### B

The finite witnesses and integer replay kernel in this branch.

### C

- completeness of declared semantic causal inputs;
- validity of any claimed numerical error bound;
- stability of the selected deterministic kernel semantics;
- authenticity of recorded external results when used.

### D

- which gameplay facts are worth exact replay;
- fixed-point scale/quantization choices;
- when to use bounded robust verification versus authority-only.

### E

- Chrome/Firefox/Safari and device cross-engine replay divergence;
- CPU/battery cost of a deterministic Canon kernel;
- trace/certificate bytes;
- replay latency;
- practical frequency of near-boundary uncertain predicates.

### F

- identify every current/future Rinne Canon fact that needs independent derivability;
- isolate actual Tidebreak decision variables from presentation state without changing combat feel;
- prove deterministic or bounded-robust semantics for those variables across supported clients;
- define the exact semantic input stream for multiplayer protected decisions;
- decide whether hostile-host modes require independent combat derivation at all.

The next useful loop should not debate timestep or seeded RNG again. It should move to another unresolved dimension unless implementation of this exact deterministic kernel becomes the explicit task.
