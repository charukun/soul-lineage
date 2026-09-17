# Accountability / hyperproperty continuation

## Status

Start source of truth: develop `ccae8251e7b9c687f8e4a8cef375af465ed63124` on 2026-09-17. That develop already contains the previous obligation-refinement work. This continuation deliberately avoids another round of evidence minimization, capability attenuation or transaction splitting. It moves to an orthogonal question: **where a guarantee can actually be enforced or detected**.

The result is not a new protocol. It is a sharper placement rule for Rinne guarantees, derived from known hyperproperty, accountability, transparency, state-continuity, self-stabilization and end-to-end theory. Primary references are in `THEORY_ACCOUNTABILITY_HYPERPROPERTY_SOURCES.md`.

Evidence classes retain the prior meaning: A conditional mathematical argument or delegated theorem, B bounded executable evidence, C assumption, D heuristic, E measurement, F unresolved.

Research-only executable evidence:

- `../scripts/reality-accountability-model.mjs`
- `../tests/reality-accountability.test.mjs`
- `../scripts/reality-accountability-proof.mjs`
- `evidence/RRP_ACCOUNTABILITY_HYPERPROPERTY_20260917.json`

None is imported by runtime gameplay.

## 1. One monitor cannot enforce every kind of game truth

The previous semantic firewall is useful for a property whose violation is visible in one execution prefix: stale generation, wrong parent, replayed operation, invalid local transition. Schneider's execution-monitor model formalizes why this class is naturally enforceable by an inline monitor [P1].

But consider finalized co-op histories. For world `w`, host key `K`, sequence `n` and parent root `p`, define:

```text
NonEquivocation(H) :=
  for every two client traces pi, pi',
  if both contain a finalized checkpoint for (w, K, n, p),
  then those checkpoint roots are equal.
```

A violation needs two traces. Trace A can contain a perfectly signed, internally append-only checkpoint giving the unique sword to Alice. Trace B can contain a perfectly signed, internally append-only checkpoint from the same parent giving it to Bob. Each trace alone is valid. Their pair is not.

This is a concrete **two-trace hyperproperty** in the sense of Clarkson/Schneider [H1]. HyperLTL exists precisely to quantify over multiple traces [H2], and runtime monitoring work treats such properties differently from ordinary single-trace LTL properties [H3].

**A:** a monitor whose entire input is only one of the two traces cannot reject that trace on the basis of the unseen other trace. The local inputs are identical in worlds where the other fork exists and where it does not.

**B:** the branch creates two valid Ed25519-signed checkpoint chains. `verifyHistory(left)` and `verifyHistory(right)` both pass, while the cross-trace auditor returns an equivocation witness.

### Consequence for testing

A single-client unit suite can never establish cross-client non-equivocation merely by becoming larger. The required test shape is self-composed / paired execution: compare at least two observer histories, or instrument a trusted collector that receives both. This is a structural testing requirement, not another protocol feature.

## 2. Accountability is weaker than prevention, but sometimes useful

SUNDR demonstrates the useful middle ground: an untrusted server may fork clients, while fork consistency makes failures detectable when clients see one another's modifications [F1]. Certificate Transparency similarly gives inclusion and append-only consistency proofs inside a presented log view, while RFC 9162 explicitly warns that a malicious log can show different views to different clients unless responses are compared [T1].

That yields three distinct Rinne envelopes:

| Envelope | What it gives | What it does not give |
| --- | --- | --- |
| Trusted host | Current DEV co-op simplicity | Protection from a malicious host |
| Signed append-only history + asynchronous gossip/witness | Evidence of equivocation after conflicting views meet | One global history before detection |
| Online non-equivocating notary / threshold witness / trusted monotonic component | Can prevent a second conflicting finality under its trust/availability model | Free offline progress or zero added trust |
| BFT/known consensus service | Stronger preventive finality under its Byzantine model | The cost/trust envelope of the weaker modes |

No row should be marketed as another row. Detection-only accountability may be attractive for an optional friend-hosted mode where availability and low infrastructure cost matter more than immediate Byzantine finality. It is not an anti-cheat substitute for Canon that must never fork.

### Conditional detection argument

Assume:

1. both conflicting checkpoints are signed under one stably bound host principal;
2. at least one honest party retains each conflicting checkpoint;
3. some future communication path delivers both to one honest comparator;
4. signatures and hashes remain secure.

Then comparison is finite: same world/key/sequence/parent plus unequal roots gives independently replayable equivocation evidence. **A under C assumptions.**

Remove any of the first three assumptions and detection is not guaranteed. A permanent partition can preserve split views forever. Erasing one branch erases the evidence. Letting the host silently change keys turns one equivocating principal into two apparently unrelated principals.

**B:** for four clients split 2/2 across two forks, all 64 possible one-round undirected gossip graphs are enumerated. 60 contain at least one cross-fork edge and expose the fork; 4 contain only the two within-fork edges and do not. The count is complete only for that bounded topology.

### Detection latency is a liveness property

From a finite prefix with no cross-fork contact, one extension may connect the groups next round while another extension may remain partitioned forever. No finite observation of the prefix proves eventual detection. This is the expected safety/liveness distinction [P2], not a missing retry loop.

Therefore `fork will eventually be detected` requires **C** eventual-contact/fairness assumptions and **E** a measured detection-latency distribution if deployed.

## 3. Rollback resistance cannot live inside the state being rolled back

A signed or hashed local history protects integrity of the bytes presented to the verifier. It does not by itself establish that those bytes are the newest bytes that ever existed.

Consider a device at state `S3` after checkpoints 1,2,3. An attacker restores the entire application persistent domain, including its verifier metadata, to the previously valid `S1`. Compare that with a normal execution that simply stopped at `S1`. The local process starts from identical bits and receives no distinguishing external message.

**A indistinguishability boundary:** a deterministic purely local verifier must behave the same in both executions. Therefore a hash chain, local epoch number, `latestRoot` file or signature stored in the same rollback domain cannot prove freshness after complete rollback.

State-continuity systems such as Ariadne introduce non-rollback security primitives precisely because integrity and freshness are different requirements [R2]. TrInc attacks equivocation using a trusted non-decreasing counter plus key [F4].

### Bounded executable evidence

The model stores a three-checkpoint valid chain, lets an external witness observe sequence 3, then rolls the client plus its local verifier back to sequence 1. Local history verification still passes. The retained witness rejects it as stale.

When the witness is rolled back too, the rejection disappears. This is intentional: a `witness` in the same failure/rollback domain is not an independent freshness anchor.

### Rinne-specific implication

Current co-op persistence has strong **integrity and idempotency** features:

- `src/coop/history-store.js` hashes the envelope, validates revision/world identity, uses a per-world exclusive lock, fences epochs, binds `writeId` to `intentHash`, and read-backs after an uncertain write;
- `src/coop/history.js` enforces lineage/rebirth monotonicity and explicitly says host-attested progress is not proof of honest gameplay.

But the web adapter ultimately stores through browser `localStorage`, and the history store advertises `cloud:false` and `authenticatedAuthority:false`. An attacker able to restore an older complete valid localStorage image can restore its old envelope hash, revision and epoch together. The digest can still verify because the old envelope was valid when created.

That is not a bug in SHA-256. It is the absence of a freshness anchor outside the rollback domain.

## 4. Current guest monotonicity is session-local, not state continuity

`src/coop/guest-session.js` keeps `lastEpoch`, `lastTick` and `lastRevision` in memory and rejects regressions while the session lives. This is useful. However a new guest session initializes those values to zero. Its persisted reconnect ticket contains `playerId` and `token`, not the last signed history root/revision/host principal.

**B analogue:** the branch's session monitor rejects an older chain before restart, then a fresh monitor accepts the same older valid chain because its anchor was lost.

This means current code can detect a rollback presented during one live connection but does not claim cross-session anti-rollback. That matches the current trusted-host UI contract and should not be overstated.

An accountability mode would minimally need a persistent client anchor such as `(worldId, stableHostKey, lastCheckpointRoot, sequence)`. If the local client storage itself is in the hostile rollback model, even that is insufficient without a separate witness, account service or hardware monotonic primitive.

## 5. Stable identity is part of non-equivocation

The current invite format in `src/coop/wire.js` is bounded JSON containing protocol/world/offer/expiry. It is not a signed binding to a durable host public key. Current co-op intentionally trusts the friend host, so this is consistent with the product contract.

For accountability, however, signed checkpoints are useful only if observers agree which signing key denotes the same host principal over time.

**B:** the model creates two internally valid histories with the same display alias but two different host keys. There is no cryptographic equivocation proof between them because the cryptographic principals differ.

Therefore an accountable mode needs one of:

- a stable account-bound host key;
- an externally witnessed key-rotation chain;
- a trusted platform identity/attestation model;
- or another explicit principal-binding scheme.

A display name, world ID or invite URL alone is not that binding. Key compromise and key recovery remain separate F obligations.

## 6. Longest-chain thinking does not solve malicious-host forks

A single malicious signer controls both branches. It can append arbitrary extra checkpoints to whichever branch it wants to make longer. Chain length therefore supplies no independent authority.

**B:** the model extends the right-hand fork by one extra valid signed checkpoint. A naive longest-chain selector picks it, while the correct result under the declared trust model remains `ambiguous-fork`.

This is why blockchain metaphors do not transfer automatically. A longest-chain rule only has meaning together with the consensus/resource assumptions that make chain weight costly or externally constrained. No such mechanism exists in this peer-host model.

## 7. Self-stabilization repairs derived state, not missing authority

Dijkstra's self-stabilization asks whether local rules drive a distributed system from arbitrary state into a legitimate regime [R1]. That is useful for Rinne's replaceable projections and caches.

If a client view is corrupt but a retained trusted checkpoint is available, rebuilding the projection from that checkpoint is a genuine stabilization pattern. The branch demonstrates this.

But two conflicting, correctly signed histories can each satisfy all **local** validity predicates. Without an anchor telling the system which principal/history is authoritative, there is no unique legitimate target to converge to. `chooseAuthoritativeFork()` therefore returns `ambiguous-fork` instead of inventing a winner.

Self-healing is not a substitute for authority or freshness.

## 8. End-to-end placement becomes clearer

Saltzer/Reed/Clark's end-to-end argument [E1] helps separate layers without claiming that lower layers are useless.

For Rinne:

- SCTP framing/checksum/order helps transport bytes;
- history envelope hashing helps detect storage corruption;
- signed append-only checkpoints can establish attribution/integrity/accountability;
- only the application semantic boundary can determine whether the event actually means `this life ended`, `this lineage parent is valid` or `this rebirth is authorized`.

Lower-layer mechanisms remain worthwhile as performance and fault-containment aids. They cannot independently satisfy the semantic requirement.

This also prevents a common overreach: an append-only log can prove that a host consistently said something; it cannot prove that the underlying gameplay that produced the statement was honest.

## 9. Revised assurance-placement matrix

The research candidate is no longer one universal proof object. Each guarantee must be routed to the mechanism class that can actually observe it:

| Guarantee | Property class | Correct placement |
| --- | --- | --- |
| semantic precondition, replay, local state transition | single-trace safety | inline semantic commit firewall |
| two clients never finalize incompatible host histories | 2-trace hyperproperty in this model | cross-observer auditor/gossip, online witness, trusted anti-equivocation hardware, or consensus |
| local history was not rolled back | state continuity | non-rollback external anchor / monotonic hardware / independent witness |
| fork will eventually be exposed | liveness | eventual contact/fairness assumption + monitoring |
| corrupted replaceable view returns to valid projection | stabilization | repair from retained authoritative anchor |
| gameplay event is factually justified | end-to-end semantic validity | game-specific authority/provenance verification |

This matrix is the main advancement of this loop. It reduces accidental demands on the obligation compiler and exposes when a property needs information that its proposed monitor can never see.

## 10. Decision for Rinne

### Current friend-hosted co-op

Keep the current trust statement. Its code already says the village trusts the host, uses local persistence and does not advertise authenticated cloud authority. Do not add expensive Byzantine machinery just to make a DEV friend session resemble a different product.

### Optional accountable peer-host mode

A future mode could add stable host identity, signed append-only semantic checkpoints, retained guest anchors and gossip/witness exchange. Its contract must say **detectable equivocation after evidence meets**, not `fork impossible`. SUNDR/Depot/accountability work owns this design territory [F1/F2/F3].

### Strong Canon / hostile-host mode

If a finalized life/death/ownership fact must never fork even temporarily, use an online non-equivocating witness/quorum/known consensus service or a trusted monotonic component under an explicit hardware model. An asynchronous transparency overlay alone is insufficient.

A stateful online notary in the branch model rejects a second fork, which demonstrates both sides of the trade: prevention improves, but finality now depends on that notary being reachable and correct. Once multiple fault-tolerant witnesses are required, the design moves toward established quorum/BFT territory rather than a new RRP protocol.

## Executed B evidence

Run from repository root without dependencies:

```sh
node apps/rinne/scripts/reality-accountability-proof.mjs \
  apps/rinne/docs/evidence/RRP_ACCOUNTABILITY_HYPERPROPERTY_20260917.json
```

Authoring/replay environment: Node v22.16.0, Linux x64.

- focused tests: **15 passed / 0 failed**;
- source syntax: model/runner/test all pass `node --check`;
- 4-client one-round gossip topology: **64/64 graphs enumerated**, 60 expose the 2/2 fork and 4 remain split because no cross-fork edge exists;
- locally valid split histories, post-hoc witness evidence, online notary prevention, full local rollback, witness rollback, key splitting, irreversible observation before detection, self-repair with anchor, longest-fork failure and session-reset anchor loss are all retained as executable witnesses;
- final source SHA-256 hashes are recorded in `evidence/RRP_ACCOUNTABILITY_HYPERPROPERTY_20260917.json`.

These are B results only. The fixed toy signatures are not a PKI; the hash chain is not Certificate Transparency; the graph enumerator is not a general network proof.

## Remaining F and E

### F

- choose the actual product threat model separately for friend-hosted co-op and future strong Canon;
- define a stable host-principal/key lifecycle if accountability is desired;
- decide whether any guest history anchor must survive app reinstall/device rollback and where that anchor lives;
- prove semantic checkpoint contents are sufficient for lineage/life/death/rebirth accountability;
- decide witness topology and whether detection-only is acceptable or finality requires online cosigning;
- integrate cross-client paired/hyperproperty tests into the architecture proof without relabeling finite tests as universal verification;
- handle key compromise, witness compromise, membership changes and evidence garbage collection.

### E

- signed checkpoint bytes and crypto cost;
- gossip/witness bandwidth and battery;
- empirical time-to-fork-detection under real online/offline patterns;
- availability/latency cost if an online notary or quorum is required;
- persistence behavior across Pixel/browser lifecycle, storage eviction, backup/restore and app reinstall.

## Stop boundary

The repeated compiler/capability/transaction argument family was intentionally not revisited. The newly closed theoretical boundary is different: **properties must be placed according to what evidence their monitor can observe**.

Inline prevention, cross-trace accountability, anti-rollback continuity, eventual detection and self-stabilizing repair are not interchangeable guarantees. The next theory work should only continue if it attacks a still-unresolved class above, not by adding another certificate field to a single-trace proof object.
