# Accountability / hyperproperty primary-source register

These references bound the continuation in `THEORY_ACCOUNTABILITY_HYPERPROPERTY_LOOP.md`. They are used to avoid renaming established verification, fork-consistency, transparency, state-continuity and self-stabilization ideas as RRP novelty. This branch does not mechanically re-prove the cited systems.

## Properties, enforcement and monitoring

- **H1 - Clarkson & Schneider, _Hyperproperties_**, Journal of Computer Security 18(6), 2010. Cornell technical report / paper: https://www.cs.cornell.edu/fbs/publications/1813-9480.pdf
- **H2 - Clarkson et al., _Temporal Logics for Hyperproperties_**, CAV 2014 / arXiv: https://arxiv.org/abs/1401.4492
- **H3 - Finkbeiner, Hahn, Stenger & Tentrup, _Monitoring Hyperproperties_**, 2018: https://arxiv.org/abs/1807.00758
- **P1 - Schneider, _Enforceable Security Policies_**, ACM TISSEC 3(1), 2000: https://www.cs.cornell.edu/fbs/publications/EnfSecPols.pdf
- **P2 - Alpern & Schneider, _Defining Liveness_**, Information Processing Letters / Cornell TR: https://www.cs.cornell.edu/fbs/publications/85-650.pdf

The branch-specific non-equivocation condition has a finite two-trace counterexample. The general terminology `hyperproperty`, `monitorability`, `safety` and `liveness` belongs to the literature above.

## Untrusted hosts, forks and accountability

- **F1 - Li, Krohn, Mazières & Shasha, _Secure Untrusted Data Repository (SUNDR)_**, OSDI 2004: https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr
- **F2 - Mahajan et al., _Depot: Cloud Storage with Minimal Trust_**, OSDI 2010: https://www.usenix.org/conference/osdi10/depot-cloud-storage-minimal-trust
- **F3 - Yumerefendi & Chase, _Strong Accountability for Network Storage_**, FAST 2007: https://www.usenix.org/conference/fast-07/strong-accountability-network-storage
- **F4 - Levin, Douceur, Lorch & Moscibroda, _TrInc: Small Trusted Hardware for Large Distributed Systems_**, NSDI 2009: https://www.usenix.org/conference/nsdi-09/trinc-small-trusted-hardware-large-distributed-systems

SUNDR's fork consistency explicitly depends on clients eventually seeing one another's modifications for detection. Depot explores recovery and minimal trust under a different consistency design. TrInc prevents equivocation with trusted monotonic hardware rather than post-hoc gossip. These are distinct assurance envelopes.

## Transparency and split views

- **T1 - RFC 9162, _Certificate Transparency Version 2.0_**, IETF, 2021: https://www.rfc-editor.org/rfc/rfc9162.html

RFC 9162 defines append-only Merkle-tree consistency and inclusion proofs, while also stating that a malicious log can present inconsistent split views and that cross-entity sharing is needed to address that problem. This branch uses a simpler signed hash-chain checkpoint model only to isolate the same accountability boundary. It is not a CT implementation.

## State continuity and self-stabilization

- **R1 - Dijkstra, _Self-stabilizing systems in spite of distributed control_**, CACM 17(11), 1974; archive: https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD426.html
- **R2 - Strackx & Piessens, _Ariadne: A Minimal Approach to State Continuity_**, USENIX Security 2016: https://www.usenix.org/conference/usenixsecurity16/technical-sessions/presentation/strackx

Self-stabilization concerns convergence from arbitrary states under a protocol with a legitimate-state relation. State continuity adds freshness / anti-rollback requirements. This continuation keeps those concepts separate because an authenticated old state can still be locally legitimate after rollback.

## Function placement

- **E1 - Saltzer, Reed & Clark, _End-to-End Arguments in System Design_**, ACM TOCS 2(4), 1984: https://web.mit.edu/saltzer/www/publications/endtoend/endtoend.pdf

The application-level semantic receipt remains the place where lineage/rebirth meaning must ultimately be checked. Transport checksums, framing and local storage integrity can support this but cannot substitute for the end-to-end semantic condition.
