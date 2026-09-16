# Invariant-Compiled Networking

## Purpose

Semantic Frontier already chooses among consistency/network policies after an operation declares its requirements. This proof loop removes one more manual step for a bounded application model: derive the minimum **coordination conflict kernel** from declared game invariants/effects, then feed that result into Semantic Frontier.

This is not a claim that arbitrary program semantics can be compiled automatically. The current compiler is exact only for four declared resource models:

- finite bounded integer counters;
- grow-only sets;
- unique registers;
- single-use tokens.

Anything outside those models remains an application proof obligation.

## Coordination witness

For every pair of operations touching the same bounded invariant, the compiler asks whether both branches can be individually valid from the same base state while their merged effects violate the invariant.

For a bounded counter `L <= x <= U`, the check exhausts every integer base state in the declared finite interval. Example, stock `0..2` with two independent reservations `-1`:

```text
base = 1
branch A = 0      valid
branch B = 0      valid
merged   = -1     invalid
```

That concrete base/branch/merge tuple is retained in the certificate. Removing the coordination edge therefore re-admits a known invalid execution.

Grow-only set additions have no destructive merge in this model, so they remain coordination-free. Two different assignments to a unique register conflict. Two distinct consumers of one single-use token conflict.

## Conservative compilation

Every operation participating in a witnessed conflict is conservatively escalated to `requiresTotalOrder=true` and `rollbackAllowed=false`. Operations with no witnessed conflict stay weak when their own semantics permit it.

This is deliberately a safety compiler, not a claim that total order is the cheapest possible coordination mechanism. A future richer compiler may synthesize escrow, reservations, partitioned ownership or other narrower protocols. Until such a protocol has its own proof, the current compiler chooses the stronger safe requirement.

## Proof-carrying plan

`synthesizeProofCarryingPlan()` performs:

```text
declared resources/effects
  -> invariant conflict kernel
  -> Semantic Frontier requirements
  -> feasible Pareto plans
  -> deterministic objective selection
  -> proof-carrying bundle
```

The bundle contains the normalized resource/effect model, invariant certificate, environment, objective, selected policies and cost. Both the invariant certificate and the complete selected bundle have deterministic roots.

`verifyProofCarryingPlan()` recomputes the kernel and Semantic Frontier from the bundle inputs. A changed conflict set, policy sequence or cost invalidates verification. This prevents a planner result from being detached from the invariant assumptions that justified it.

The certificate proves consistency between the declared model and selected plan. It cannot prove that a developer forgot to declare a real game invariant. Omitted semantics remain omitted semantics.

## Current proof claims

The deterministic test suite proves:

1. each required edge in the canonical bounded model has an explicit invariant-violation witness;
2. grow-only merge remains weak while stock reservation / unique assignment / one-use token conflicts escalate;
3. compiled Semantic Frontier plans do not route witnessed conflicts through CRDT/gossip/causal/presence/state-sync/rollback paths;
4. at least one safe mergeable operation can remain on a weak path in the same mixed workload;
5. proof-carrying plan verification rejects policy, cost and invariant-certificate tampering.

This advances the architecture from **manual policy selection** toward **game-invariant -> coordination requirement -> policy synthesis**.

## What is still not proved

- arbitrary JavaScript/game logic synthesis;
- cross-resource invariants not represented by the declared effect model;
- optimality among every possible coordination primitive;
- Byzantine correctness of the compiler inputs;
- physical WebRTC/device/network performance;
- that an omitted invariant is harmless.

Those boundaries are intentional. The compiler should refuse or conservatively escalate semantics it cannot prove rather than inventing coordination freedom.

## Focused verification

```sh
node --test apps/rinne/tests/reality-invariant-compiler.test.mjs
```

The result is also composed into `runRrpTheoryVerificationSuite()` and the combined architecture proof.
