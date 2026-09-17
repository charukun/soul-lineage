# Randomness / fairness loop: primary-source register

These sources are used to keep this loop from renaming established randomness, fair-ordering, and identity results as RRP novelty. They do not imply that the branch reproduces the full security proof or deployment assumptions of each cited system.

## Coin flipping and abort bias

- **R1 — Manuel Blum, 1981, _Coin Flipping by Telephone: A Protocol for Solving Impossible Problems_.** CRYPTO 1981, pp. 11–15. CMU copy: https://www.cs.cmu.edu/~mblum/research/pdf/coin/
- **R2 — Richard Cleve, 1986, _Limits on the Security of Coin Flips when Half the Processors Are Faulty_.** STOC 1986, pp. 364–369. DOI: https://doi.org/10.1145/12130.12168

This branch's two-bit XOR commit/reveal model is only a bounded witness for the last-revealer/selective-abort distinction. It is not a reconstruction of Blum's protocol or Cleve's theorem.

## Verifiable random functions

- **R3 — RFC 9381, _Verifiable Random Functions (VRFs)_, 2023.** https://www.rfc-editor.org/rfc/rfc9381.html

RFC 9381 separates uniqueness, collision resistance, pseudorandomness, and unpredictability under malicious key generation. In particular, uniqueness is stated for a fixed public key and fixed input, and the security considerations discuss adversarial key generation and key validation. This loop therefore does not treat a valid VRF proof as evidence that the application fixed the key, semantic input, eligibility set, or number of equivalent attempts before the output became decision-relevant.

## Public and distributed randomness beacons

- **R4 — drand protocol specification.** https://docs.drand.love/docs/specification/
- **R5 — drand repository/protocol documentation.** https://github.com/drand/drand
- **R6 — NIST IR 8213 draft, _A Reference for Randomness Beacons: Format and Protocol Version 2_, 2019.** https://doi.org/10.6028/NIST.IR.8213-draft
- **R7 — NIST Interoperable Randomness Beacons project.** https://csrc.nist.gov/projects/interoperable-randomness-beacons

The drand specification describes threshold BLS generation over a common round input and verification against the distributed public key; NIST describes timed, signed, hash-chained public pulses. They provide known mechanisms for public verifiable randomness under their own trust/liveness assumptions. This branch still requires the game action and its semantic policy to bind to a source/key/round before the value can be selected around.

## Identity and multiplicity

- **R8 — John R. Douceur, 2002, _The Sybil Attack_.** IPTPS 2002. Microsoft Research: https://www.microsoft.com/en-us/research/publication/the-sybil-attack/ ; PDF: https://www.microsoft.com/en-us/research/wp-content/uploads/2002/01/IPTPS2002.pdf

Douceur shows why redundant identities are not automatically independent principals. The branch's identity-lottery example is a toy arithmetic witness only; it delegates the general identity problem to the established Sybil literature.

## Ordering fairness

- **R9 — Mahimna Kelkar, Fan Zhang, Steven Goldfeder, Ari Juels, 2020, _Order-Fairness for Byzantine Consensus_.** CRYPTO 2020. IACR full version: https://eprint.iacr.org/2020/269 ; proceedings PDF: https://iacr.org/archive/crypto2020/12171344/12171344.pdf
- **R10 — Klaus Kursawe, 2020, _Wendy, the Good Little Fairness Widget_.** https://arxiv.org/abs/2007.08303

These works establish that transaction ordering fairness is a separate distributed-systems problem and that natural receive-order notions can be impossible or contradictory. The branch's three-observer Condorcet cycle is only a finite explanatory witness.

## Scope rule

None of R1–R10 is renamed as a new RRP primitive. The residual Rinne-specific work is limited to deciding which game effects are fairness-sensitive and compiling their already-known mechanism assumptions into explicit semantic contracts that close grinding/admission/order surfaces end to end.
