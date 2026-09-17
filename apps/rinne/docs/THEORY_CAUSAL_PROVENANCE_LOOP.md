# Causal provenance falsification continuation

## Status

Start source of truth: develop `f55d0d77fa891d019ac8463da81ac62ad9a6c764` on 2026-09-18.

This loop is orthogonal to the integrated evidence-minimization, capability, transaction, compiler/firewall, accountability/rollback, replayability, privacy, and randomness-fairness loops. It asks a different question: **when Rinne records an irreversible Canon fact, what can legitimately be claimed about why that fact happened?**

The loop distinguishes five relations that are often collapsed in logs:

1. physical/wall-clock order;
2. serialization/commit order;
3. Lamport happened-before / possible causal influence;
4. semantic dependency used by the rule that produced the fact;
5. provenance explanation retained for audit/revalidation.

No new causal-consistency or provenance formalism is introduced. Lamport/vector clocks, causal-debugging, W3C PROV, database provenance, and partial-order reasoning retain priority. Primary references are in `THEORY_CAUSAL_PROVENANCE_SOURCES.md`.

Evidence classes remain A/B/C/D/E/F. Research-only executable evidence is in the corresponding script/test/evidence files and is not imported by runtime gameplay.

## 1. Total order is not causality

Lamport's happened-before relation is a partial order. A total order can extend that partial order for coordination, but it must order concurrent events too [C1].

Toy execution:

```text
P1: weather update W
P2: rebirth request R
```

No message or semantic dependency connects W and R. A sequencer may nevertheless store `W` at sequence 1 and `R` at sequence 2.

The statement `sequence(W) < sequence(R)` proves only serialization order. It does **not** prove `W caused R`.

**B:** `linearSequenceDoesNotImplyDependency()` retains exactly this witness.

### Current Rinne placement

`coop/history.js` assigns a monotonically increasing `sequence` to structural history records. That is useful and correct for an append-only host history. The file itself explicitly says host-attested progress is not proof of honest gameplay. The research conclusion is only that this linear sequence should not be reinterpreted later as a complete semantic causal explanation.

## 2. Happened-before is still not semantic causation

Suppose process A sends message `m`; B receives it; B later commits fact F. Lamport happened-before yields:

```text
send(m) -> receive(m) -> F
```

Yet B's rule may not use the payload or semantic content of `m` at all. Logical causality captures **possible influence induced by execution/communication structure**, not the application-specific proposition “F depended on m's value.” Schwarz/Mattern emphasize that identifying application-significant causal relationships is subtler than merely carrying logical time [C4].

**B:** the branch constructs a send/receive/commit chain where happened-before says the send precedes the commit, while the semantic dependency graph for the decision contains only the local receive/processing fact.

Therefore vector clocks are useful for ruling out impossible influence and detecting concurrency, but they are not a replacement for semantic dependency declarations/derivations.

## 3. Equal final snapshots can hide different histories

Two histories:

```text
A: HP 100 -> damage 20 -> heal 20 -> HP 100
B: HP 100 -> no events -> HP 100
```

have the same final snapshot but answer different audit questions:

- was damage ever taken?
- did a rescue/heal occur?
- should an achievement or lineage scar exist?
- did an irreversible notification fire?

**B:** the executable model checks exact final-state equality while retaining distinct traces.

Thus state equivalence and history/provenance equivalence are separate contracts. A snapshot is sufficient only for future observations whose semantics quotient away the omitted history, consistent with the earlier observational-equivalence result.

## 4. Wall-clock timestamps cannot stand in for causal edges without clock premises

A causally ordered send at physical time 100 and receive at time 101 can be observed as:

```text
sender clock:   120
receiver clock: 81
```

under offsets +20 and -20.

**B:** the branch preserves this exact reversal.

This is the ordinary logical-time lesson, not a claim that real clocks are useless. If gameplay semantics genuinely uses deadlines/physical time, the clock accuracy/skew premise belongs in the contract. But an unqualified timestamp comparison cannot prove message causality.

## 5. Independent actions should not gain fake dependencies

Partial-order reasoning matters because many linearizations represent the same semantic execution when independent operations commute. Modeling every earlier log record as a parent of every later record inflates provenance, revalidation work, and conflict scope.

**B:** moving an actor and changing independent weather state commute in the toy model; either order yields the same semantic state.

Conversely, two first-claim operations on the same unique resource do **not** commute:

```text
claim(Alice); claim(Bob) -> Alice owns
claim(Bob); claim(Alice) -> Bob owns
```

**B:** both orders are executed and differ.

A simple read/write-set independence test is retained as a conservative finite example:

```text
independent if
  writes(A) disjoint writes(B)
  writes(A) disjoint reads(B)
  writes(B) disjoint reads(A)
```

This is not a complete commutativity analysis for arbitrary JavaScript. It demonstrates what the contract must preserve: **semantic independence, not mere temporal proximity**.

Partial-order reduction and trace theory already exploit commuting independent transitions; no RRP novelty is claimed there [C5].

## 6. Provenance is naturally a DAG, not necessarily a chain

A protected decision can depend simultaneously on several facts:

```text
fatality decision
  <- damage state
  <- armor/mitigation state
  <- active policy version
  <- randomness receipt (if random-dependent)
```

A single `previousEventId` cannot express these as first-class direct dependencies without introducing arbitrary intermediate serialization artifacts.

**B:** the branch constructs a decision with three direct semantic parents and computes its ancestor closure.

W3C PROV similarly models entities, activities, usage, generation and derivation rather than reducing all provenance to one chronological predecessor [P2]. Database provenance work formalizes compositional derivation information for queries [P1].

### Surviving shape

For a protected semantic fact, the research candidate becomes:

```text
Explanation(effect) = {
  effectId / operationId,
  semanticType,
  policyRoot + authorityGeneration,
  semanticParents[],
  parentSetRoot when multi-parent,
  randomnessReceipt? when used,
  sinkReceipt? for external irreversible output,
  optional logical-time / observer metadata,
  resulting fact root
}
```

This is an explanation/provenance object, not an authorization object and not a replacement for the semantic firewall.

## 7. Cryptographic provenance proves integrity of the described graph, not completeness or truth

The branch constructs content-addressed provenance nodes whose ids commit to payload + parent ids. It also signs the decision node.

Then it deliberately omits a real rule dependency:

```text
actual rule needs: stock > 0 AND curse == false
provenance records: stock > 0 only
```

The graph is internally valid and the signature verifies. It is still semantically incomplete.

**B:** `signedIncompleteProvenanceWitness` returns `cryptographicallyValid=true`, `complete=false`.

This repeats no new proof-carrying argument; it places the prior compiler-completeness boundary specifically inside explanation semantics. Provenance can show what the system claims it used. It cannot by itself prove that the source-to-dependency extraction was complete or that a signed source fact was true.

## 8. Semantic causal closure enables targeted revalidation, conditionally

If a fact's declared semantic dependencies are complete and the rule is pure/deterministic relative to them, a verifier need not replay unrelated world history.

Toy graph:

```text
fatal <- damage
fatal <- armor
fatal <- policy

unrelated: weather, NPC movement
```

Causal closure for `fatal` is `{fatal, damage, armor, policy}` rather than all six events.

**B:** the branch computes this closure exactly.

This suggests a useful implementation direction: repair/audit packages can carry the protected fact plus its semantic ancestor closure, rather than a global history dump.

But this is conditional:

- dependency extraction must be conservative/complete;
- external oracles/randomness receipts used by the decision must be represented;
- hidden mutable state and ambient I/O invalidate the closure;
- dynamic rule versions need the exact policy/compiler root.

Therefore targeted closure is an optimization/refinement target, not an unconditional theorem about current runtime.

## 9. Ordering can become semantic only when the rule observes it

An arbitrary total order is harmless for commuting transitions whose future protected observations are order-insensitive. It becomes semantic when rules inspect concepts such as:

- first claimant;
- first hit / last hit;
- cooldown or deadline precedence;
- counter increments with caps;
- ownership transfer;
- generation/version advancement;
- “latest” policy or snapshot selection.

Thus the architecture should not classify an entire event stream as either “ordered” or “unordered.” The required ordering is per semantic conflict domain.

This aligns with the earlier transaction and fairness results without repeating them: the new point is that **the provenance graph must distinguish dependency edges from incidental serialization edges**.

## 10. Provenance is useful for explanation without pretending to answer philosophical causation

The word “cause” is overloaded. This branch intentionally uses narrower machine-checkable relations:

- `hb-parent`: execution/communication happened-before evidence;
- `semantic-parent`: rule/input dependency declared or conservatively derived;
- `authority-parent`: prior Canon/generation required by authority rules;
- `policy-parent`: policy/compiler version used;
- `random-parent`: randomness/fairness receipt used;
- `sink-parent`: irreversible sink receipt/output;
- `presentation-parent`: normally excluded from Canon explanation unless protected semantics depends on it.

This avoids claiming counterfactual, moral, or philosophical causation. If a future feature needs true counterfactual explanation (“would the player have died without hit X?”), that is a separate causal-inference problem and should not be smuggled into distributed logical clocks.

## 11. Current Rinne history already contains useful semantic hints

`coop/history.js` is not merely a timestamp log:

- `reborn` records `previousLifeId` and the rebirth `intent`;
- rebirth is allowed only after the old life is ended and committed;
- lineage is checked against the prior life record;
- previously committed rebirth operations cannot be changed.

Those checks are closer to semantic provenance than the numeric `sequence` field alone. A future provenance layer can build from these explicit relations rather than deriving “why” from chronology.

No runtime change is justified in this research PR. The current co-op remains a trusted-host structural history under its existing threat model.

## 12. Surviving placement rule

For each protected fact, retain only relations needed for the claims the product wants to make:

```text
serialization order     -> coordination / deterministic publication
happened-before         -> potential distributed influence / concurrency
semantic provenance     -> why this rule result used these inputs
policy/authority lineage-> why this version/principal could decide
randomness receipt      -> how a fairness-sensitive draw was fixed
sink receipt            -> what irreversible external effect actually committed
```

Do not infer a stronger row from a weaker row.

This is the main improvement from the loop.

## 13. Evidence status

### A / delegated known theory

- happened-before is a partial order and total logical-clock order is an extension, not proof of causation [C1];
- vector/logical time can represent potential causality/concurrency under their model [C2/C3];
- provenance formalisms model derivation/usage/generation and compositional derivation [P1/P2];
- partial-order reasoning can exploit independence/commutation [C5].

### B

16 focused tests retain nine distinct witness classes:

1. total-order false causality;
2. happened-before without semantic dependency;
3. equal final state / different history;
4. order-sensitive concurrent claims;
5. wall-clock skew reversal;
6. multi-parent derivation;
7. signed but incomplete provenance;
8. targeted causal closure;
9. linear sequence without dependency.

### C

- semantic dependency declarations/extraction are conservative and complete;
- policy/randomness/oracle versions referenced by provenance are authentic;
- principal/authority identities mean what the contract assumes;
- any physical-time claim states explicit clock bounds.

### D

- which protected facts deserve retained explanation after commit;
- provenance retention duration / GC strategy;
- human-facing explanation rendering.

### E

- provenance bytes per Canon fact;
- targeted revalidation speedup versus checkpoint/full-log replay;
- storage and network overhead;
- audit latency and developer debugging value.

### F

- real Rinne semantic dependency extraction for life-end/rebirth/lineage/ownership effects;
- proof that all protected decision inputs appear in explanation closure;
- versioned provenance schema and compatibility rules;
- secure pruning/compaction without breaking retained explanation claims;
- machine-checked refinement between runtime transition and explanation DAG;
- composition across external services and cross-domain facts;
- any counterfactual explanation beyond recorded semantic derivation.

## Stop boundary

This loop stops before “more timestamps,” “bigger logs,” or “store every prior event.” Those are not advances. The residual implementation idea is smaller: explicit semantic-parent edges plus authority/policy/randomness/sink roots for protected facts, while preserving concurrency for unrelated operations.

A genuinely orthogonal next loop should examine temporal/deadline semantics, heterogeneous platform/attestation trust, incentive-compatible authority selection, or another unexamined axis.
