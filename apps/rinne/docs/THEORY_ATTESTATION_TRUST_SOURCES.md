# Heterogeneous attestation/trust loop: primary-source register

These sources prevent established remote-attestation and authenticator mechanisms from being renamed as RRP novelty.

## General remote attestation architecture

- **A1 — RFC 9334, _Remote ATtestation procedureS (RATS) Architecture_, 2023.** https://www.rfc-editor.org/rfc/rfc9334.html
  - Separates Attester, Verifier and Relying Party. Attesters produce Evidence; Verifiers appraise it under policies and produce Attestation Results; relying parties still decide whether/how to trust the peer.
  - The RFC explicitly distinguishes trust from trustworthiness and discusses freshness/trust relationships. This is the main prior-art framing used by this loop.

## Web authentication/authenticator attestation

- **A2 — W3C Recommendation, _Web Authentication: An API for accessing Public Key Credentials — Level 3_, 25 August 2026.** https://www.w3.org/TR/webauthn-3/
  - WebAuthn provides strong, RP-scoped public-key credentials and authenticator attestation. Attestation concerns authenticator origin/properties and credential data; relying parties assess those properties.
  - The spec also documents attestation privacy/linkability concerns. This loop therefore does not reinterpret WebAuthn attestation as general webpage/game-runtime integrity attestation.

## Android application/device integrity

- **A3 — Android Developers, _Play Integrity API_ documentation.** https://developer.android.com/google/play/integrity
  - Current documented verdicts distinguish recognized app/version/licensing and device-integrity/environment signals. `UNEVALUATED` exists as a separate outcome when requirements are not met.
  - The API is useful evidence for Android app/device risk decisions; this loop does not treat those verdicts as proof of arbitrary game-state correctness or one-human identity.

## Scope rule

No new attestation protocol is introduced. The residual Rinne-specific work is a per-effect trust-evidence contract that names exactly which claims are needed, which provider/appraisal policy produced them, what action/measurement they bind, what unsupported fallback means, and what privacy disclosure is acceptable.
