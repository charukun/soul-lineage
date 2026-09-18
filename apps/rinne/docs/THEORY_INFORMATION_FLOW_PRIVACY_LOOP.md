# RRP information-flow / privacy falsification continuation

## Status and scope

Start source of truth: develop `2b966745cb48c27593711b008d74709dec65a609` on 2026-09-18.

This loop is intentionally orthogonal to the already integrated reconstruction, obligation/compiler, accountability/rollback and nondeterminism/reproducibility work. The question is not whether RRP sends fewer bytes or whether a proof object is semantically sufficient. The question is:

> **Can a representation be fully sufficient for correctness and still reveal more information than the receiving observer is entitled to learn?**

The answer is yes. That creates a separate obligation class for RRP. A correctness-minimal capsule and a confidentiality-minimal transcript are not the same object.

No new protocol name is introduced. Classical noninterference, intransitive information-flow, declassification, quantitative information-flow, traffic analysis, zero-knowledge and secure-computation theory retain priority. Primary references are in `THEORY_INFORMATION_FLOW_PRIVACY_SOURCES.md`.

Evidence classes retain the existing meanings:

- **A**: conditional mathematical argument or delegated theorem;
- **B**: bounded executable evidence;
- **C**: assumptions / trust or threat-model premises;
- **D**: heuristic engineering policy;
- **E**: real measurement required;
- **F**: unresolved obligation.

Research-only evidence in this branch:

- `../scripts/reality-information-flow-model.mjs`
- `../tests/reality-information-flow.test.mjs`
- `../scripts/reality-information-flow-proof.mjs`
- `evidence/RRP_INFORMATION_FLOW_PRIVACY_20260918.json`

None is imported by gameplay runtime.

## 1. Semantic sufficiency and confidentiality are orthogonal

The previous work correctly asks whether a replica or validator has enough causal evidence to validate an irreversible operation. That is an **integrity / semantic sufficiency** question. It does not answer who is allowed to learn that evidence.

Let a secret witness be `S`, public context be `P`, and the protected semantic decision be:

```text
D = f(S, P)
```

A validator transcript `T` is sufficient when it lets the validator determine `D`. But many sufficient transcripts exist:

```text
T1 = S                         // raw witness
T2 = (S, D)                    // raw witness plus decision
T3 = signed_authority(D)       // trust signer, hide S from validator
T4 = privacy-preserving proof  // under an appropriate cryptographic construction
```

`T1` and `T2` may be perfectly correct and maximally revealing. A hash of `S` can also be semantically inadequate while leaking `S` when the secret domain is small enough for dictionary search.

Therefore an RRP compiler cannot treat:

```text
smallest sufficient correctness evidence
```

as automatically equivalent to:

```text
least information disclosed to this observer
```

This is not another bandwidth-minimization claim. A one-byte yes/no response can leak the entire fact the attacker wants, while a larger padded ciphertext can disclose much less about the witness.

### A: release-relative noninterference contract

For observer `o`, define the **authorized release function** `D_o(S, P)`. Two secret states `s0` and `s1` are equivalent for `o` when their authorized releases are equal:

```text
s0 ~=o s1  iff  D_o(s0, P) = D_o(s1, P)
```

Let `Transcript_o(s)` include every observer-visible consequence in the declared channel model. The confidentiality target is:

```text
D_o(s0, P) = D_o(s1, P)
  =>
Transcript_o(s0) indistinguishable from Transcript_o(s1)
```

For the finite deterministic research model, `indistinguishable` is exact equality. A real cryptographic construction may use computational indistinguishability instead. This is an ordinary noninterference/declassification shape, not a new RRP theorem [NI1][IF1][DC1].

**A:** if the permitted decision itself differs across two secrets, an observer that must learn the decision necessarily distinguishes those secrets at least to the decision partition. Privacy cannot hide information that product semantics explicitly declassifies.

The practical target is therefore not `zero information`, but **no information beyond declared release plus explicitly accepted side channels**.

## 2. The transcript is larger than the JSON payload

A confidentiality analysis that inspects only serialized fields is unsound. The observer transcript can include:

- payload values;
- accept/reject and error class;
- whether a response occurs at all;
- message length / chunk count;
- response timing and retry count;
- connection creation / closure;
- subscription changes;
- cache hit/miss or recovery behavior;
- repeated adaptive queries;
- which replicas are contacted;
- later declassification that composes with earlier outputs.

TLS 1.3 itself includes record padding specifically because encrypted traffic length is observable, and its security considerations still discuss traffic analysis from packet length/timing [TLS1]. WebRTC encryption therefore does not by itself prove Rinne transcript confidentiality.

### B: bounded side-channel witnesses

The executable model retains four small witnesses:

1. A branch changes serialized length. An observer learns one secret bit from length alone.
2. A fixed 512-byte bucket removes that bit in the bounded two-message model.
3. A branch changes response tick. An observer learns one bit even when payload content is otherwise hidden.
4. Constant scheduling removes that bit in the bounded model.

These are **not** production prescriptions. Padding and constant-time policies trade bandwidth/latency/battery for reduced leakage, and real packetization, browser scheduling, congestion control and SCTP behavior are not modeled. Choosing bucket size or cover-traffic rate is **D/E**, not A.

## 3. Oracles can reconstruct secrets without ever sending the secret

Suppose a server hides a value `S` but exposes a validation endpoint. If the attacker can adapt inputs and observe yes/no outcomes, the validation boundary itself becomes an oracle.

The bounded model uses an 8-value secret. Three adaptive binary questions reconstruct the full 3-bit value even though no response contains the raw witness.

This matters directly to semantic firewalls. A firewall that says only `valid/invalid` can protect integrity while becoming a confidentiality oracle if:

- the requester controls candidate inputs;
- the response predicate partitions a secret;
- the requester can query repeatedly;
- query history is not part of the privacy contract.

Rate limits can reduce practical extraction but do not change the qualitative information-flow relation. They are **D/E**, not a proof of noninterference.

### Composition rule

Leakage must be evaluated over a transcript horizon, not message-by-message. Three individually one-bit-looking predicates can compose to identify one of eight secrets exactly. Therefore per-field labels such as `safe-to-send` are insufficient if later outputs correlate with the same secret.

**F:** RRP still lacks a general composition rule for declassification budgets across retries, observers, reconnects, recovery artifacts and generations.

## 4. Hashes and signatures do not automatically give confidentiality

A digest proves only a relationship to input bytes under cryptographic assumptions; it is not encryption. If the committed value comes from a small or predictable domain, an observer can hash all candidates and recover the value.

**B:** every value in the model's 8-element secret domain is recovered uniquely from its SHA-256 digest by exhaustive dictionary search.

The conclusion is deliberately narrow:

```text
low-entropy hash commitment != confidentiality
```

It does not attack SHA-256 collision/preimage security on high-entropy random values.

Similarly, signatures authenticate statements. They do not hide signed plaintext. A signed semantic capsule replicated to four validators can increase the number of principals that learn its contents while improving Byzantine safety. Safety and confidentiality can therefore move in opposite directions.

## 5. Stronger consistency can make confidentiality worse

The Semantic Frontier currently asks which policy satisfies ordering, survival, Byzantine, partition and latency requirements. Confidentiality introduces an independent dimension.

Consider a secret-dependent irreversible operation. Plaintext validation by `n` replicas gives `n` readers of the witness. Moving from one trusted authority to 3 crash replicas or 4 Byzantine replicas can improve fault tolerance while widening disclosure.

The bounded `disclosureCount` witness is intentionally simple, but it exposes the placement error:

```text
more replicas + plaintext witness
  => more principals learn the witness
```

There is no contradiction. Consensus answers agreement; confidentiality answers knowledge.

This means the planner's feasibility gate is incomplete for privacy-sensitive facts unless it also knows:

- secret owner / classification;
- allowed readers;
- authorized release function;
- validator trust class;
- whether plaintext witness is permitted at that validator;
- which transcript metadata counts as observable;
- cryptographic / hardware assumptions available.

A policy can be **consistency-feasible but confidentiality-infeasible**.

### Candidate placement choices, without inventing a new family

| Placement | Integrity / availability shape | Confidentiality consequence |
| --- | --- | --- |
| Raw witness to quorum | Validators can directly execute predicate | Every quorum member learns witness |
| Hash/commitment only | Useful binding primitive | Often cannot evaluate arbitrary predicate; low-entropy dictionary leakage remains |
| Trusted authority signs verdict | Replicas can order verdict without witness | Moves confidentiality and correctness trust to authority |
| Zero-knowledge proof for suitable relation | Can prove a statement while hiding witness under construction assumptions [ZK1][NIST1] | Circuit/prover cost, public inputs and metadata still matter |
| MPC / threshold computation | Can compute functions of private inputs under explicit adversary assumptions [MPC1] | Higher complexity/latency; not a free game-network primitive |
| TEE/attested service | Can reduce plaintext readers under hardware/platform trust | Side channels, attestation and vendor trust become C/F |

RRP should choose among known mechanisms according to the threat model. It must not call a raw hash or a consensus certificate a privacy proof.

## 6. Validation has a disclosure lower bound

There is a useful negative result before reaching for cryptography.

Suppose the only transcript available to a plain deterministic verifier is identical for secrets from both the `valid` and `invalid` classes. Then the verifier receives identical input in worlds requiring different verdicts and cannot correctly decide the predicate in both.

**A (local indistinguishability):** a secret-dependent predicate requires either:

1. information that distinguishes the predicate classes;
2. trust in another principal's assertion;
3. or a cryptographic/secure-computation mechanism whose transcript proves the relation under additional assumptions.

There is no protocol wrapper that simultaneously gives a plain verifier zero predicate-relevant information, zero trust, and the ability to decide an arbitrary secret-dependent predicate.

The branch models an **ideal predicate-proof abstraction** only to preserve this distinction. It leaks one bit, the authorized boolean verdict, instead of the full three-bit witness. It is explicitly not a ZK implementation or performance claim.

## 7. Declassification is directional, not transitive forwarding

A common intended policy is:

```text
Host knows secret witness S
Host/validator may derive verdict D
Guest may learn D
Guest must not learn S
```

That is an intransitive release shape [NI2]. If the validator's internal object `{witness, verdict}` is then serialized wholesale to the guest, the policy collapses into transitive disclosure.

**B:** the model has both paths. The permitted release sends only `verdict`; a naive object-spread forwarding path leaks the witness.

This gives a concrete compiler rule: **intermediate authorization is not downstream authorization**. An object safe inside a validator is not automatically safe to reuse as a network DTO.

This also sharpens the previous "all sinks" obligation. Capability fencing asks who may cause effects. Information-flow fencing separately asks who may learn intermediate inputs and derived evidence.

## 8. Current Rinne inspection

This branch does not declare a production privacy vulnerability. It identifies places where the new obligation is currently unspecified.

### Guest projection

`CoopWorld.view(id)` restricts peers by zone/front and 60m distance, which is a meaningful observation boundary. However, `visibleLife` currently includes fields such as `seed` and `birthVillageId` in every nearby peer projection in addition to visible movement/combat/equipment state.

The model uses an 8-value toy `seed` domain only to demonstrate a general fact: if an internal secret field is transmitted verbatim, all entropy in that field is disclosed to the receiver. The real Rinne seed is not asserted here to be secret, exploitable or removable without checking every consumer.

**F:** classify every peer-view field by actual gameplay purpose and observer audience. A candidate internal field should be removed from the wire only after proving no permitted guest behavior/rendering requires it.

### Authoritative host

Current friend-hosted co-op stores and computes the full world at the host. Confidentiality of a player's secret state **from that host** is impossible under this execution model: the host receives the witness as part of its authority state.

This is not a bug if the product threat model trusts the friend host. If future modes require host-blind secrets, the architecture itself must change to a trusted service, secure computation, client-held secret with proof, or another explicit trust mechanism. Encryption on the same host that must decrypt/process the value is not a solution.

### Lineage / decision capsules

`lineageRecord` contains rich experiences, skills, equipment and other life information. Current guests are not shown the full durable history merely because it exists on the host. The future risk appears when the reconstruction's unresolved "decision capsule" is distributed to validators: sufficient causal evidence must not automatically become universally readable evidence.

### Wire metadata

`createRoomWire` serializes JSON and chunks it by message size. The branch makes **no claim** that a real network observer can infer a specific Rinne secret from current SCTP/WebRTC traffic. Packet length/timing leakage remains **E** until captured and measured on real browser/device/network paths.

## 9. Confidentiality placement contract for RRP

Before choosing replication policy for a secret-dependent operation, the compiler/planner needs a declaration at least this strong:

```text
secret/classification:
  owner
  value domain / entropy assumptions
  allowed plaintext readers
  persistence readers

authorized release:
  function or predicate allowed to become public to each audience
  who may trigger release
  where release may occur
  when release becomes legal

validation:
  predicate that must be checked
  validator trust class
  whether raw witness may be disclosed to validators
  cryptographic/hardware facilities allowed

observable transcript:
  payload fields
  error/verdict classes
  length/chunking
  timing/retry/connection behavior
  adaptive-query horizon
  recovery/log/debug artifacts

composition:
  prior releases tied to the same secret
  reconnect/generation identity
  retention/GC boundary
```

This is directly aligned with established declassification dimensions (`what`, `who`, `where`, `when`) rather than a novel policy language [DC1].

If the declaration is missing, the conservative result is `privacy-unclassified`, not `safe because payload is small`.

## 10. Quantitative leakage is a budget, not a replacement for policy

Qualitative noninterference is intentionally strict. Real gameplay necessarily reveals some information: seeing another player, receiving damage, learning a trade succeeded, or being told `eligible=true` are intentional outputs.

Quantitative information flow can measure how much a modeled observation partitions a secret distribution [QI1]. The executable helper uses uniform finite secrets and Shannon entropy:

```text
leak = H(S) - H(S | transcript)
```

This is **B for those finite distributions**, not a universal privacy metric. Real attack utility depends on prior knowledge, skewed distributions, repeated sessions and the exact adversary. Min-entropy, guessing entropy, differential privacy or cryptographic indistinguishability may be more appropriate for other contracts.

The useful discipline is:

1. first declare what information is allowed to flow;
2. reject accidental flows qualitatively where possible;
3. measure residual/intentional channels quantitatively;
4. aggregate across the whole transcript rather than declaring each message harmless alone.

## 11. Executed bounded evidence

Run from repository root:

```sh
node apps/rinne/scripts/reality-information-flow-proof.mjs \
  apps/rinne/docs/evidence/RRP_INFORMATION_FLOW_PRIVACY_20260918.json
```

Authoring/replay environment: Node v22.16.0 / Linux x64.

- focused tests: **15 passed / 0 failed**;
- model/runner/test: `node --check` pass;
- toy current-style peer projection: **3 leaked bits** from an 8-value secret seed;
- minimized projection: **0 leaked bits** for that toy secret while preserving the modeled public fields;
- adaptive boolean oracle: **3 leaked bits**, reconstructing the 8-value secret;
- variable length: **1 bit**; 512-byte bucket: **0 bits in the bounded witness**;
- variable timing: **1 bit**; constant response tick: **0 bits in the bounded witness**;
- raw validator witness: **3 bits**; ideal predicate-proof abstraction: **1 bit**, the authorized predicate partition;
- low-entropy SHA-256 commitment: all 8 candidates dictionary-recovered;
- source SHA-256 values are recorded in the evidence JSON.

These are intentionally small falsification witnesses. They are not WebRTC measurements, production cryptography, a JIF/IFC implementation, a ZK circuit, MPC, differential privacy or a proof about arbitrary JavaScript.

## 12. Evidence classification after this loop

### A

- semantic sufficiency does not imply confidentiality minimality;
- if an authorized decision differs across secrets, revealing the decision necessarily declassifies at least that partition;
- a deterministic plain verifier given identical transcripts for both predicate classes cannot decide a secret-dependent predicate correctly in both worlds;
- information-flow policy must be defined over the observer's transcript, not only payload fields.

### B

- 15 focused finite-model tests;
- explicit field leakage, adaptive-oracle composition, low-entropy digest recovery, length/timing witnesses;
- raw-witness vs ideal-predicate-proof leakage distinction;
- directional declassification vs naive transitive forwarding.

### C

- declared secret classification and adversary/observer set;
- correct authorized-release functions;
- cryptographic assumptions for commitments/proofs/MPC;
- trust in host, validator, TEE or external service according to selected mode;
- entropy/distribution assumptions for quantitative claims.

### D

- padding buckets;
- cover traffic / fixed response windows;
- query rate limits and privacy budgets;
- when to prefer trusted authority versus proof/MPC/TEE based on performance.

### E

- actual WebRTC/SCTP packet-size and timing leakage across browser/device/network combinations;
- battery/CPU/latency cost of padding, cover traffic, ZK/MPC/TEE candidates;
- real query distributions and attacker priors;
- logging/crash-report/telemetry leakage;
- effect of mobile sleep/resume and reconnection patterns on metadata.

### F

- automatic derivation/checking of confidentiality labels from arbitrary game code;
- composed declassification across retries, generations, recovery and multiple observers;
- exact privacy-aware decision capsule for Tidebreak/lineage;
- privacy-aware policy feasibility in Semantic Frontier;
- host-blind mode and its trust root, if product requirements ever demand it;
- cryptographic proof/circuit generation and rule-version binding;
- privacy-preserving cross-domain transactions;
- key lifecycle, revocation and evidence/log garbage collection without privacy regressions;
- browser/rendering side channels outside the modeled message transcript.

## 13. Reconstructed architecture consequence

The previous reconstruction should not be replaced. It needs one additional independent gate:

```text
operation / irreversible decision
  -> causal + invariant obligations
  -> authority / consistency placement
  -> observer + declassification contract
  -> confidentiality feasibility check
  -> transcript-channel obligations
  -> only then choose evidence/proof/replication encoding
```

The strongest conclusion of this loop is negative but useful:

> **RRP cannot infer privacy from semantic minimality, encryption in transit, hashing, signatures, or consensus. Confidentiality requires its own observer-relative end-to-end contract.**

The residual architectural opportunity is game-specific: compile semantic dependencies and information-release declarations together so the system can choose where raw state, derived verdicts and privacy-preserving proofs belong. The underlying theory and cryptographic mechanisms are known; any novelty claim remains **F** until that composition is formalized and compared against established information-flow systems and privacy-preserving distributed protocols.
