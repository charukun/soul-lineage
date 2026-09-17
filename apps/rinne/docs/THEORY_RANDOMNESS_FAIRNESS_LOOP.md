# Randomness / fairness falsification continuation

## Status

Start source of truth: develop `5b5585e0795b9279ace5d731f71431f07b1df3e4` on 2026-09-18.

This continuation is deliberately orthogonal to the already integrated evidence-minimization, capability, transaction, compiler/firewall, fork/rollback, replayability, and information-flow loops. The question is narrower: **when a protected game decision uses randomness, what must be fixed before the draw so that later reproducibility or cryptographic verification is actually evidence of fair selection rather than evidence of a faithfully replayed manipulation?**

No new randomness protocol is proposed or named. Coin flipping, VRFs, distributed/public beacons, Sybil resistance, and fair ordering retain their published priority. Primary references are in `THEORY_RANDOMNESS_FAIRNESS_SOURCES.md`.

Evidence classes retain the project convention:

- **A**: conditional proof/argument or delegated theorem under explicit premises.
- **B**: bounded executable witness from this branch.
- **C**: trust/failure/principal/timing assumption.
- **D**: engineering policy/heuristic.
- **E**: physical/performance measurement.
- **F**: unresolved proof/refinement/deployment obligation.

Research-only executable evidence:

- `../scripts/reality-randomness-model.mjs`
- `../tests/reality-randomness.test.mjs`
- `../scripts/reality-randomness-proof.mjs`
- `evidence/RRP_RANDOMNESS_FAIRNESS_20260918.json`

None is imported by runtime gameplay.

## 1. Replayable randomness can still be unfair randomness

The previous reproducibility loop showed how a recorded deterministic seed can make a result re-derivable. That says nothing about how the seed entered the system.

Let `F(seed, action)` be a deterministic outcome function. If an authority may evaluate candidate seeds `s1..sk` and publish only a favorable seed, the final transcript is perfectly replayable:

```text
published seed -> F(seed, action) -> same result forever
```

Yet the seed was selected after a search. For independent candidate success probability `p`, the idealized best-of-k success probability is:

```text
P(success after k candidates) = 1 - (1 - p)^k
```

For `0 < p < 1`, this strictly increases with `k`.

**B:** with the branch's 16-bucket SHA-256 toy draw, scanning seeds 0..63 finds a favorable bucket at seed 34. The recorded seed then reproduces the manipulated outcome exactly.

**A:** deterministic verification proves consistency with the published seed, not unbiased seed selection. Fairness therefore requires a contract about **who controls candidate selection and when that choice closes**, not merely a replay seed.

### Rinne inspection

Current solo Rinne starts a new life with `seed = Date.now() >>> 0`; life ids also include `Math.random()`. Current village-skirmish fatal/evasion decisions derive deterministic hashes from `state.seed` plus combat context. A bounded model matching those source formulas finds selectable millisecond seeds with different fatal-roll values.

This is **not reported as a current gameplay bug or exploit**. Solo is local and already controlled by the player. It becomes relevant only if a future externally trusted Canon treats such locally selected outcomes as fair/adversary-resistant facts.

Friend-hosted co-op derives player seeds deterministically from `worldId:playerId`, while new world ids are browser-generated UUIDs. Again, the current product explicitly trusts the host. The lesson for a stronger future threat model is only that deterministic derivation from a freely retryable identity does not by itself remove grinding.

## 2. Fairness is about the whole choice surface, not the RNG primitive

A fairness-sensitive decision has more degrees of freedom than `randomBytes()`:

```text
participants / admission set
principal identities and multiplicity
semantic input encoding
policy / probability distribution
randomness source and source key
source round / source input
number of retries / equivalent tickets
action ordering / conflict set
abort / timeout / fallback behavior
mapping from random bytes to game outcome
```

If any decision-relevant element remains selectable after the random value is known, that element can become a grinding surface.

The surviving contract is therefore end-to-end: **close the relevant choice set before reveal, then draw**.

## 3. Commit/reveal does not erase abort leverage

A two-party XOR illustrates the distinction without claiming a new coin-flipping result.

If honest bit `h` and malicious committed bit `m` are both revealed, `h XOR m` is balanced when `h` is uniform and hidden until the commitment is fixed.

But if the malicious last revealer sees `h` and reveals only when the XOR is favorable, completed rounds can be conditionally biased. In the toy model with desired output `1`, half the rounds complete and every completed round has result `1`.

**B:** the branch preserves both the balanced all-reveal distribution and the selective-abort completed distribution.

**A/C:** commitment and hiding assumptions close adaptive value choice, but availability/fairness under abort remains a separate contract. Classical coin-flipping literature owns the general problem [R1, R2].

### Penalties are not cryptographic fairness

A deposit or cooldown can make abort economically unattractive only relative to the attacker's external utility. In the toy model, expected abort cost is:

```text
((1-p)/p) * abortCost
```

A penalty can dominate a bounded modeled gain but cannot prove fairness if gain is unbounded/unknown.

This stays **D/C**, not A-level cryptographic protection.

## 4. A VRF proof closes one output, not application-level grinding

RFC 9381 gives precise security properties for VRFs. For a fixed public key and input, uniqueness prevents choosing among multiple valid outputs for that pair. It does not mean the surrounding application fixed the key and input at the right time.

The branch uses a deliberately tiny HMAC-based `vrfLike` function only to expose application-level selection surfaces; it is **not a VRF implementation** and inherits no VRF security proof.

### Input grinding

With one fixed toy key and inputs `input-0..input-63`, the branch finds a favorable 16-bucket output at `input-14`. A real VRF proof for the chosen input would still only prove correctness for that input.

### Key grinding

With a fixed input and toy keys `key-0..key-63`, a favorable key appears at `key-11`. If an authority can generate/evaluate many keys and register only the favorable one, later proof verification does not reveal the rejected keys.

RFC 9381 explicitly separates properties under trusted versus malicious key generation [R3].

### Retained rule

For a fairness-sensitive VRF use, the application contract needs at least:

- stable/pinned source principal or registered key;
- canonical semantic input;
- action/input/key bound before the protected reveal/commit point;
- bounded equivalent attempts/retries;
- explicit abort behavior;
- distribution/mapping policy fixed before output.

A VRF is then the known cryptographic primitive inside that contract, not the contract itself.

## 5. Public-beacon randomness can be ground through time

Public beacons provide a useful different trust envelope: timed public values can be verified after release. NIST describes signed/hash-chained public pulses [R6, R7]; drand uses threshold BLS over a common round input with a distributed public key [R4, R5].

But an application that is free to choose *which future/past round to use after seeing outputs* can scan rounds exactly as it could scan seeds.

**B:** the toy beacon finds a favorable round among 100..163 at round 104.

The repair is not “more random bytes.” The action must commit to the beacon source/key and target round before the value for that round is known.

### Multiple tickets are hidden retry budget

Even if every ticket individually commits to its own future round, a participant allowed to create many equivalent tickets and exercise only the favorable one has retained a best-of-k surface.

**B:** among 64 pre-created ticket/round pairs, the branch finds a favorable candidate and exercises it after reveal.

The fairness contract therefore carries `maxEquivalentAttempts` or an equivalent principal/resource rule. Retry semantics are part of fairness, not an implementation detail.

## 6. The source public key must itself be bound

A signed beacon response verified with the public key delivered inside the same untrusted response establishes only self-consistency with that supplied key.

**B:** the branch creates two Ed25519 authorities. An attacker-signed record verifies under the attacker's supplied key and fails under the trusted pinned key.

This is not an attack on Ed25519, drand, or NIST. It is the ordinary trust-root rule: the application must authenticate the beacon/group identity it intended to use.

For drand, the distributed group/public key and network identity are part of the beacon configuration [R4]. For any Rinne integration, the corresponding source root belongs in the versioned semantic policy rather than in attacker-controlled action input.

## 7. Uniform bytes do not imply the intended game distribution

Even a perfect byte source can be mapped badly.

For a byte source `0..255`, naive `byte % 6` yields bucket counts:

```text
43, 43, 43, 43, 42, 42
```

A simple finite rejection mapping accepts 0..251 and yields six buckets of 42 each, rejecting 4 values.

**B:** both counts are exhaustively checked.

The point is not to prescribe this mapping for every game. It is to bind and audit the **distribution policy** separately from the randomness source. A fatality probability, loot table, spawn choice, and tie-break rank can all use the same trustworthy random source while implementing different distributions.

## 8. The distribution itself must be fixed before reveal

Suppose the random unit value is `r`. If an authority may choose a threshold `t` after seeing `r`, it can often choose whether predicate `r < t` is true or false. Therefore an unbiased random value does not make an adaptively chosen probability policy fair.

**B:** the branch fixes `r = 0.417` and demonstrates an after-reveal threshold that makes either desired Boolean result, while a pre-fixed threshold has one result.

The fairness contract therefore includes a `distributionRoot` and `bindDistributionBeforeReveal` requirement. This is distinct from replayability: the final threshold and random value can both be recorded and replay perfectly after the manipulation.

## 9. Canonical semantics matter because representation can become a lottery ticket

Two JSON encodings can represent the same semantic object while having different byte sequences:

```json
{"a":1,"b":2}
{"b":2,"a":1}
```

If randomness derivation hashes arbitrary raw representation, an actor able to choose an equivalent encoding gains extra candidates. If derivation instead uses a canonical semantic encoding, those two encodings collapse to one candidate.

**B:** raw encodings produce different toy draws; canonical sorted-object encoding produces the same draw.

This is not a claim that the branch's JSON canonicalizer is production canonicalization. It is a finite witness that **semantic identity and byte identity must not accidentally diverge into grinding attempts**.

## 10. Domain separation avoids accidental cross-effect coupling

Reusing one random scalar for unrelated protected decisions creates correlation. In the branch toy, using the same low bit for `loot` and `fatality` makes the two outcomes equal in every sampled world.

Domain-separated derivation from the same root removes that forced identity in the bounded sample.

This is an established cryptographic design discipline, not RRP novelty. It also does not prove statistical independence in arbitrary constructions. The retained rule is simply that each semantic use names a versioned derivation domain.

## 11. Multi-party fairness starts before the tie-break

A perfect random tie-break among the candidates it receives says nothing about a candidate omitted before the tie-break.

**B:** when Alice and Bob are eligible but only Bob is admitted, the unbiased ranking necessarily picks Bob. Another bounded witness allows the controller to choose an admission subset after seeing the beacon and preserve a desired winner.

Thus for contested actions:

```text
eligibility / principal model
    -> admission closure
    -> conflict / ordering policy
    -> bound random source/round if needed
    -> outcome mapping
    -> commit
```

Manipulation at an earlier stage is not repaired by a later randomizer.

The fairness contract therefore binds an `admissionRoot` before reveal for multi-party effects.

## 12. Identity multiplicity is not fairness

If a lottery grants one ticket per presented identity and one adversary can create many identities, the probability mass follows identities, not humans/principals.

**B:** with one honest identity and one adversarial identity, adversarial share is 1/2; with one honest and ten adversarial identities it is 10/11.

Douceur's Sybil work owns the general identity problem [R8]. The Rinne-specific conclusion is only that a fairness contract must state what a `principal` means when attempt budgets, votes, witnesses, admissions, or tickets are counted.

This can be a product/account identity, trusted friend-host membership, platform account, proof-of-resource model, or another explicit policy. There is no universal free identity oracle.

## 13. Arrival-order fairness can be internally contradictory

It is tempting to say: “if most observers saw A before B, order A before B.” Applied pairwise, this can cycle.

The branch's bounded witness uses three observer orders:

```text
A < B < C
B < C < A
C < A < B
```

Pairwise majorities give:

```text
A < B
B < C
C < A
```

No total order satisfies all three relations.

**B:** the branch constructs the majority graph and detects the directed cycle.

This is established fair-ordering territory. Wendy analyzes impossible intuitive relative-order notions [R10]. Aequitas introduces relaxed order-fairness notions and uses grouping/blocks to avoid paradoxical strict pairwise requirements [R9].

### Rinne consequence

Randomness and ordering fairness are separate.

- If gameplay semantics already define a deterministic causal winner, random ordering is unnecessary.
- If genuinely simultaneous conflicting actions need a tie-break, first define the admitted conflict set and fairness notion.
- Only then may a fixed future random source provide one auditable tie-break ranking.

Do not hide an impossible/undefined ordering specification behind “random fairness.”

## 14. Unpredictability is principal-relative and time-relative

“Unpredictable randomness” is incomplete without answering:

```text
unpredictable to whom?
until what commitment point?
```

A VRF secret-key holder can compute its own output before verifiers can; a public beacon becomes known to everyone after release. A future beacon is useful only if the principal who could exploit the result must close its action/admission/policy choice before release.

The structural contract therefore requires:

- `unpredictableTo`: the principals whose early knowledge would create advantage;
- `commitmentPoint`: the semantic event before which those principals must be unable to choose around the value.

This is **C/F** until mapped onto a concrete threat model and protocol.

## 15. Do not silently downgrade the randomness trust model

If a protected action is configured for a public/threshold beacon but the beacon is temporarily unavailable, silently switching to host-selectable local randomness restores the exact grinding power the stronger source was intended to remove.

**B:** the branch models a beacon outage followed by host-seed best-of-k fallback and finds a favorable outcome.

The contract therefore includes `randomnessFailureMode`, for example:

- fail closed / delay the fairness-sensitive action;
- produce an explicit abort outcome;
- use a fallback that was precommitted before failure and provides an explicitly accepted equivalent/known-weaker guarantee.

There is no generic “always continue” rule. Availability and bias resistance are separate properties.

## 16. Surviving randomness/fairness contract

The previous typed Obligation can carry a **fairness sub-contract only for effects where the game semantics actually require adversary-resistant random fairness**:

```text
Fairness(action) = {
  targetDistributionRoot,
  bindDistributionBeforeReveal,

  semanticStateRoot,
  canonicalSemanticInput,
  actionId / operationId,

  principalModel,
  admissionRoot?,
  bindAdmissionBeforeReveal?,
  orderPolicy?,

  sourceType,
  sourceIdentityRoot / pinned key,
  sourceInput,
  sourceRound?,
  bindSourceKeyBeforeReveal,
  bindInputBeforeReveal,
  bindActionBeforeReveal,
  bindRoundBeforeReveal?,

  unpredictableTo,
  commitmentPoint,

  maxEquivalentAttempts,
  abortPolicy,
  randomnessFailureMode,
  derivationDomain,

  audit proof / beacon receipt / VRF proof / protocol receipt
}
```

This is a **contract schema**, not a new random-beacon or coin-flipping protocol. It selects/delegates to known mechanisms under a declared threat model.

### Structural checker

The executable model rejects fairness-sensitive contracts missing the corresponding binding fields. For multi-party contracts it additionally requires admission/principal/order semantics.

Passing this structural checker is **B only**. It does not prove that runtime code actually obeys the declared binding time, that source keys are safe, or that the chosen protocol's cryptographic assumptions hold.

## 17. What this changes in the larger architecture

The architecture now needs to classify protected actions along at least three independent dimensions already exposed by previous loops:

1. **semantic validity:** is the action allowed by current policy/invariant state?
2. **derivability/confidentiality:** can the fact be replayed or proved without disclosing too much?
3. **selection fairness:** were random/admission/order choices fixed before any principal could choose around the outcome?

A fact may succeed on one dimension and fail another.

Examples:

- a host-signed loot roll can be authentic and replayable but grindable;
- a threshold-beacon result can be unbiased at source but unfairly mapped by an after-reveal loot table;
- a perfectly random tie-break can be fair among admitted actions but unfair to censored actions;
- a fair source can become biased operationally through unlimited retries or silent fallback.

This is the main advance of this loop: fairness moves from “quality of random bytes” to a **closure property over the whole decision surface before reveal**.

## 18. Current Rinne placement

Current product modes should not be over-claimed.

### Solo

Local solo outcomes are user-controlled by design. `Date.now()` seeding and local save control are therefore not treated as adversarial-fairness vulnerabilities. If a future feature promotes a solo-derived random fact into shared competitive Canon, that promotion boundary must supply a stronger fairness contract or classify the fact as authority/local-only.

### Friend-hosted co-op

The current co-op explicitly trusts the host. Deterministic `worldId:playerId` seed derivation and fixed 50 ms simulation are valuable for structural consistency/replay, not proof that a hostile host could not retry a room identity, suppress admission, delay a contested action, or restart after unfavorable outcomes.

No runtime change is justified by this research alone.

### Future stronger Canon

Only a random-dependent effect that is both externally meaningful and adversarially contestable needs the full fairness envelope. Many ordinary presentation/procedural choices can remain local deterministic or ordinary RNG with no expensive fairness machinery.

This preserves the broader Semantic Frontier principle: pay for strong guarantees only at the semantic boundary that needs them.

## 19. Evidence status

### A / delegated theory

- deterministic replay of a selected seed does not prove unbiased seed selection;
- best-of-k increases success probability under independent-candidate assumptions;
- after-reveal policy/admission choice can defeat an otherwise unbiased draw;
- fixed-key/fixed-input VRF uniqueness/pseudorandomness properties remain RFC 9381 territory;
- coin flipping under abort/fault assumptions remains classical coin-flipping theory;
- public/threshold beacon guarantees remain NIST/drand protocol territory;
- Sybil resistance and fair-ordering impossibility/relaxations remain their cited literature.

### B

The branch contains finite executable witnesses for seed/input/key/round/ticket grinding, selective abort, modulo bias, domain coupling, self-supplied trust roots, adaptive distribution, noncanonical encoding, admission censorship, post-reveal admission, Sybil multiplicity, ordering cycles, fallback downgrade and current-source-equation timing/world-id selection.

### C

Any deployed fairness claim depends on explicit assumptions about:

- which principals are adversarial;
- identity/membership authenticity;
- whether at least one coin contributor is honest and whether abort is possible;
- beacon/VRF key provenance and cryptographic security;
- when source values become predictable to each principal;
- network/liveness assumptions;
- whether the admitted set and policy really become immutable before reveal.

### D

- choosing which game effects deserve adversary-resistant randomness;
- acceptable failure/delay behavior;
- attempt budgets and cooldowns;
- whether trusted-host fairness is sufficient for a mode.

### E

- beacon/VRF verification latency and bytes;
- threshold/randomness service availability;
- retry/failure rates;
- mobile CPU/battery/network impact;
- actual distribution of contested actions;
- real probability of near-deadline/admission races.

### F

- enumerate actual Rinne random-dependent Canon facts and their required fairness level;
- bind policy/admission/source/round at real runtime boundaries;
- select a real principal/identity model for any competitive/shared lottery;
- prove a runtime action cannot create hidden equivalent attempts;
- integrate fair ordering only for conflict domains that truly need it;
- version/rotate beacon or VRF source roots safely;
- define no-downgrade recovery across outages;
- compose fairness receipts with the existing semantic firewall, replayability and confidentiality contracts;
- production cryptographic implementation and end-to-end adversarial validation.

## Stop boundary

This loop stops when the remaining questions become deployment choices or require real cryptographic/network integration. Repeating “use a stronger RNG,” “sign the seed,” or “add another proof field” does not advance the theory.

The next orthogonal research axis should not be another randomness variant. Candidate axes include causal provenance/semantic explanation, heterogeneous platform trust/attestation, incentive-compatible authority selection, or temporal/deadline semantics.
