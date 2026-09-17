# Heterogeneous attestation / trust falsification continuation

## Status

Start source of truth: develop `53d3b6c2ab8f8a221cfd6ae9891fd27edb1603dd` on 2026-09-18.

This loop is orthogonal to the integrated temporal, causal-provenance, randomness, replayability, privacy, firewall, transaction and rollback axes. It asks one narrow question: **what may a protected Rinne decision legitimately infer from platform/device/authenticator attestation across heterogeneous clients?**

The main prior-art frame is IETF RATS: Evidence is appraised by a Verifier under an appraisal policy to produce Attestation Results for a Relying Party. Trust is still a relying-party decision, not a magic property produced by one signature [A1].

No new attestation protocol or TEE is proposed. Primary references are in `THEORY_ATTESTATION_TRUST_SOURCES.md`.

## 1. One boolean `trusted` destroys the semantics of evidence

Two successful attestations can mean completely different things.

Toy profiles:

```text
WebAuthn-like:
  credential-origin
  user-verification
  authenticator-properties

Play-Integrity-like:
  recognized-app
  device-integrity
```

Collapsing each to `trusted=true` creates a false type equivalence.

**B:** `booleanTrustCollapseWitness` preserves two different claim sets that both become boolean true.

**A1** gives the correct conceptual shape: evidence and attestation results have claims/appraisal semantics; the Relying Party decides whether those claims satisfy its policy.

### Placement rule

Protected effects declare **required claims**, not “attestation required = true”.

## 2. Fresh challenge does not automatically bind the attestation to the action

Suppose evidence freshly answers nonce `N` and proves a device-integrity claim. If `N` is not cryptographically/semantically bound to the protected action, the same fresh evidence can be presented while asking for:

```text
A: rebirth life:a
B: claim unique sword
```

**B:** both pass a nonce-only toy policy. When the expected action digest is added, evidence bound to A is rejected for B.

Freshness closes replay of old evidence under its model. **Action binding is a different relation.**

The contract therefore carries `actionDigest` when the protected action must be bound to the attested request.

## 3. Measuring the app binary is not enough if unmeasured inputs change protected semantics

Toy case:

```text
same measured app binary
config A: fatalThreshold = 0.78
config B: fatalThreshold = 0.20
```

Binary measurement is identical while the semantic outcome policy differs.

**B:** the branch retains this exact witness.

A measurement claim is only as broad as its measurement set. If protected semantics depend on binary + policy config + dynamic rule asset, a claim that covers only the binary cannot be silently interpreted as covering all three.

This is not an argument to measure every asset in the game. It is a rule to name the **semantic measurement schema** for effects that actually rely on measured-client integrity.

## 4. WebAuthn attestation is not webpage/game-runtime attestation

WebAuthn Level 3 defines strong RP-scoped credentials, user verification, authenticator assertions and authenticator attestation [A2].

Its attestation is about authenticator/credential provenance and properties. It does not claim:

```text
the JavaScript game bundle is untampered
the entire browser runtime is measured
this game state was computed honestly
```

**B:** a toy WebAuthn claim set contains RP binding/user verification/authenticator properties and intentionally fails `app-runtime-integrity` and `game-state-integrity`.

Therefore WebAuthn can be excellent for **principal authentication/user-presence questions** without being misused as general anti-cheat attestation.

## 5. Android app/device integrity is evidence, not semantic truth

Current Play Integrity documentation distinguishes app-recognition/licensing and device-integrity/environment verdicts and includes explicit `UNEVALUATED` outcomes [A3].

A successful app/device integrity result still does not logically imply:

```text
one unique human
one account
correct game-state transition
complete protection against all cheating
```

**B:** the model keeps these claims separate. One attested device can host two modeled account principals.

The result is useful only for effects whose appraisal policy actually needs those platform claims.

## 6. `UNEVALUATED` is not the same proposition as “evaluated and bad”

A platform service may be unavailable/unsupported or decline to evaluate a field. That is different from successfully evaluating the evidence and finding that a required claim is absent.

**B:**

```text
evaluated + missing device-integrity -> DENY
not evaluated                     -> UNEVALUATED
```

This matters because availability policy is a product choice:

- deny;
- escalate;
- enter an explicitly weaker mode;
- disable only sensitive effect(s).

Treating every unsupported client as malicious confuses lack of evidence with negative evidence.

## 7. Strong-mode fallback must be explicit

If an effect requires:

```text
recognized-app + device-integrity
```

then WebAuthn user verification cannot silently substitute for it. Those are different claims.

**B:** the stronger policy denies the weaker evidence.

A fallback may be entirely reasonable, but then it is a **different mode/guarantee**, not “same security, different provider.”

This mirrors the randomness no-downgrade result without repeating that mechanism: the cross-platform trust layer has to make guarantee changes observable in policy.

## 8. One global platform trust floor is usually the wrong abstraction

Toy effects:

```text
local chat:
  required claims = []

ranked unique claim:
  required claims = [recognized-app, device-integrity]
```

A web client with no platform attestation can safely use local chat in the model but cannot satisfy the ranked unique-claim policy. Android evidence can satisfy both.

**B:** exactly this routing is checked.

If Rinne sets one global minimum to the strongest profile, low-risk features become unnecessarily unavailable on weaker/unsupported platforms. If it sets the global minimum to the weakest profile, sensitive effects silently weaken.

The better abstraction is **per-effect claim requirements**, with effect availability routed independently.

## 9. Appraisal policy version is part of the meaning

Evidence appraised under policy generation 1 may not satisfy generation 2.

**B:** evidence carrying `policy-v1/generation=1` passes the old policy and fails the new one.

Therefore protected decisions bind:

- provider/profile;
- appraisal policy root/generation;
- required claim semantics;
- freshness/action binding if required.

A durable attestation token is not a timeless proof that every future policy should accept it.

## 10. Trust roots and measurements still do not make attestation the game authority

RATS deliberately separates:

```text
Attester -> Evidence
Verifier -> appraisal -> Attestation Result
Relying Party -> trust/authorization decision
```

[A1]

For Rinne, the semantic commit firewall remains the component deciding whether an effect may happen. Platform attestation can discharge selected premises such as:

```text
this is the recognized Android app
the device meets configured integrity class
a user verified possession of an RP-scoped credential
```

It does not replace:

- semantic game-rule validation;
- resource/capability ownership;
- transaction/atomicity;
- fairness;
- causal/provenance completeness;
- deadline semantics.

This is the key architectural correction from the loop.

## 11. Attestation and identity are separate

A device-integrity statement identifies/characterizes a device/app environment under its provider's model. It is not proof that all accounts on that device represent one human, or that one human cannot use several devices.

**B:** one device with two modeled account principals retains `uniqueHumanDerived=false`.

If future competitive fairness counts one vote/ticket per principal, the principal model still needs its own policy. Attestation may strengthen one identity link, but does not solve Sybil identity by itself.

## 12. Attestation has a privacy budget too

WebAuthn explicitly discusses linkability/privacy risks of attestation material [A2].

The branch assigns toy disclosure weights only to make one structural point:

```text
user-verification
<
user-verification + authenticator model + stable device id
```

**B:** the higher-detail profile has strictly higher toy disclosure score.

This is not a privacy theorem or standardized metric. The design rule is: **request only claims needed by the protected effect**, consistent with the earlier privacy work.

Per-effect appraisal simultaneously reduces unnecessary exclusion and unnecessary information collection.

## 13. Surviving trust-evidence contract

```text
TrustEvidence(effect) = {
  effectId,

  platformProfile,
  provider / evidenceClass,

  requiredClaims[],

  appraisalPolicyRoot,
  appraisalGeneration,

  freshnessMode,
  challenge?,

  requireActionBinding?,
  actionDigest?,

  requiredMeasurements[]?,
  measurementSchema?,
  measurementRoot?,

  principalBinding?,

  unsupportedPolicy:
    deny
    | unevaluated
    | explicit-weaker-mode
    | escalate,

  privacyDisclosureClass,

  attestationResult / provider receipt
}
```

A verifier/appraisal adapter may normalize provider-specific evidence into named claim semantics. The semantic firewall consumes those claims according to the protected effect's policy.

This is a **claim-placement contract**, not a universal attestation format or security protocol.

## 14. Current Rinne placement

Current `packages/platform-web` deliberately exposes basic web platform capabilities and `identity.current()` returns `null`; it does not pretend to provide authenticated server identity or device attestation.

That is a good boundary for the current product. Lack of an attestation port is **not a bug** while current gameplay does not promise hostile-client platform integrity.

If future native/mobile/competitive Canon requires stronger trust evidence, add platform-specific evidence adapters only at those protected effects. Do not force the browser implementation to fabricate equivalent device guarantees it cannot actually provide.

## 15. Evidence boundary

### A / delegated known theory

- RATS separates Evidence, Verifier appraisal, Attestation Results and Relying Party trust decisions [A1];
- WebAuthn attestation concerns authenticator/credential properties and includes privacy considerations [A2];
- Play Integrity exposes specific app/device/account/environment verdicts, including unevaluated states [A3].

### B

18 focused tests / 10 distinct witnesses cover:

1. boolean trust semantic collapse;
2. fresh nonce without action binding;
3. binary measurement missing semantic config;
4. WebAuthn not app-runtime attestation;
5. device integrity not unique human/game-state proof;
6. unevaluated vs evaluated-negative;
7. silent fallback downgrade;
8. global profile cross-platform tradeoff;
9. appraisal generation binding;
10. privacy overcollection.

### C

Deployed claims depend on provider trust roots, verifier correctness, secure challenge/freshness, measurement coverage, principal model and platform threat model.

### D

Which effects deserve platform integrity, unsupported-platform UX/mode routing, privacy disclosure class and device-risk thresholds.

### E

Attestation latency/quota/availability, false-positive/unevaluated rates, device coverage, battery/network cost, user exclusion and privacy impact.

### F

- map real future Rinne protected effects to exact platform claims;
- define provider-specific adapters and normalized claim semantics;
- action-binding for real attestation APIs;
- dynamic config/asset measurement coverage when semantically required;
- provider/appraisal-root rotation;
- cross-platform save/migration semantics when trust class changes;
- principal identity policy;
- prove no sensitive effect silently falls back to a weaker profile;
- end-to-end production validation.

## Stop boundary

The loop stops before “add more attestation fields,” “require the strongest device verdict everywhere,” or “make WebAuthn prove the app.” Those repeat category errors.

The material placement rule is:

> **Attestation is evidence about named claims under an appraisal policy. Protected game semantics decide which claims matter; no platform's success verdict is a universal `trusted=true`.**

The next orthogonal loop should examine incentive-compatible authority selection/economic attack cost or another as-yet unexamined axis rather than another attestation provider.
