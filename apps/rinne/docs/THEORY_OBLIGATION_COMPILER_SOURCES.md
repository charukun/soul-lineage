# Obligation compiler loop: primary-source register

These sources prevent known mechanisms and lower bounds from being renamed as RRP novelty. They are references for the claims in `THEORY_OBLIGATION_COMPILER_LOOP.md`, not evidence that this branch reproduced each full system or theorem.

## Information and computational complexity

- **I1 — Yao, 1979, _Some Complexity Questions Related to Distributive Computing (Preliminary Report)_**. Introduces the two-party communication-complexity problem as minimizing communicated bits needed to compute a Boolean function of private inputs. ACM STOC 1979: https://doi.org/10.1145/800135.804414
- **I2 — Karp, 1972, _Reducibility Among Combinatorial Problems_**. Classic NP-completeness/reducibility paper including set covering. DOI: https://doi.org/10.1007/978-1-4684-2001-2_9

The branch's n-bit one-way Equality lower bound is a direct pigeonhole proof for its narrow model. The branch's evidence-minimization hardness result is an explicit reduction from Set Cover; Karp supplies the known complexity classification of Set Cover.

## Authorization, capabilities and freshness

- **A1 — Appel & Felten, 1999, _Proof-Carrying Authentication_**. Distributed authorization framework in higher-order logic where requesters submit proofs and checking is simple relative to the logic/policy. Princeton record: https://collaborate.princeton.edu/en/publications/proof-carrying-authentication/ ; DOI: https://doi.org/10.1145/319709.319718
- **A2 — Birgisson et al., 2014, _Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud_**. Chained-MAC bearer credentials, attenuation, delegation, contextual caveats, and discussion of revocation via short lifetimes, freshness constraints, external state, epoch counters and related methods. Google Research: https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/ ; paper: https://theory.stanford.edu/~ataly/Papers/macaroons.pdf
- **A3 — Gray & Cheriton, 1989, _Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency_**. Time-based lease mechanism for distributed cache consistency under stated timing/failure assumptions. DOI: https://doi.org/10.1145/74850.74870

The branch's chained-HMAC capability object is only a test model inspired by these patterns. It is not a production Macaroon implementation and does not inherit the paper's security proof/engineering evaluation.

## Transactions and multi-domain visibility

- **T1 — Skeen, 1981, _Nonblocking Commit Protocols_**. Necessary/sufficient conditions and designs for nonblocking commit protocols. ACM: https://doi.org/10.1145/582318.582339 ; accessible copy: https://web.eecs.umich.edu/~manosk/assets/papers/Ske81.pdf
- **T2 — Gray & Lamport, 2006, _Consensus on Transaction Commit_**. Relates Two-Phase Commit to Paxos Commit and separates commit safety/liveness from a single coordinator's availability. Microsoft Research: https://www.microsoft.com/en-us/research/publication/consensus-on-transaction-commit/ ; arXiv: https://arxiv.org/abs/cs/0408036
- **T3 — Bailis et al., 2014, _Scalable Atomic Visibility with RAMP Transactions_**. Read-atomic multi-partition visibility with limited multiversioning and partition/synchronization independence under its model. UC Berkeley: https://amplab.cs.berkeley.edu/publication/scalable-atomic-visibility-with-ramp-transactions/
- **T4 — Garcia-Molina & Salem, 1987, _Sagas_**. Long-lived transactions decomposed into transactions with compensating actions. Princeton technical report: https://www.cs.princeton.edu/techreports/1987/070.pdf ; ACM DOI: https://doi.org/10.1145/38713.38742
- **T5 — Shasha, Llirbat, Simon & Valduriez, 1995, _Transaction Chopping: Algorithms and Performance Studies_**. Safely chops known transaction sets while preserving serializability under the paper's conflict conditions. DOI: https://doi.org/10.1145/211414.211427

RAMP read-atomic visibility, atomic commit, Saga compensation, and serializable chopping solve different contracts. The branch must not cite one as proof of the others.
