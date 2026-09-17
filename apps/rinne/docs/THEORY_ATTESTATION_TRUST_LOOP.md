# Heterogeneous attestation / trust falsification continuation

## Acceptance contract

Start source of truth: develop `53d3b6c2ab8f8a221cfd6ae9891fd27edb1603dd` on 2026-09-18.

This loop is orthogonal to the integrated temporal, causal-provenance, randomness, replayability, privacy, firewall, transaction and rollback axes. It asks: **what may a protected Rinne decision infer from platform/device/authenticator attestation when clients span browsers, Android and future native platforms?**

Required attacks:

1. An attestation verdict proves gameplay-semantic correctness.
2. A fresh nonce proves the attested evidence is bound to the protected game action.
3. The same `trusted=true` meaning can be transported across heterogeneous attestation providers/platforms.
4. Attesting the app binary is sufficient when dynamic config/assets/plugins can change protected semantics.
5. WebAuthn authenticator attestation proves webpage/game-runtime integrity.
6. A device-integrity/app-integrity claim proves one unique human/principal or prevents Sybil identities.
7. Unsupported/unevaluated attestation should be treated as malicious rather than as a distinct availability/policy state.
8. A silent fallback from strong attestation to no attestation preserves the same guarantee.
9. One global minimum trust profile is always preferable to per-effect claim requirements.
10. Attestation freshness and appraisal-policy version need no binding after evidence verification.

Known IETF RATS, WebAuthn and platform-integrity systems retain priority. Any surviving result must be a trust-evidence placement contract, not a renamed attestation protocol.

Evidence classes remain A/B/C/D/E/F. Research-only docs/model/tests may be added under `apps/rinne`; no runtime import, gameplay/save-schema/protocol/auth change, quality-gate weakening, main or Production change is in scope.