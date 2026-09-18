# Information-flow / privacy source register

Primary and authoritative sources used by `THEORY_INFORMATION_FLOW_PRIVACY_LOOP.md`. These references retain prior-art priority; the loop does not rename their results.

- **[NI1]** J. A. Goguen and J. Meseguer, *Security Policies and Security Models*, IEEE Symposium on Security and Privacy, 1982. Introduces noninterference as a security-policy formulation in which one group's actions must not affect what another group can observe. https://www.cs.purdue.edu/homes/ninghui/readings/AccessControl/goguen_meseguer_82.pdf
- **[NI2]** John Rushby, *Noninterference, Transitivity, and Channel-Control Security Policies*, SRI CSL-92-02, 1992. Formalizes intransitive noninterference and unwinding, relevant to Host → validator → guest release where an intermediate reader is not permission to forward the witness downstream. https://www.csl.sri.com/papers/csl-92-2/
- **[IF1]** Andrei Sabelfeld and Andrew C. Myers, *Language-Based Information-Flow Security*, IEEE JSAC 21(1), 2003. Surveys end-to-end confidentiality and why access control/encryption alone do not directly enforce information-flow policy. https://www.cs.cornell.edu/andru/papers/jsac/sm-jsac03.pdf
- **[DC1]** Andrei Sabelfeld and David Sands, *Declassification: Dimensions and Principles*, Journal of Computer Security 17(5), 2009. Classifies declassification by what, who, where and when information is released. https://doi.org/10.3233/JCS-2009-0352
- **[QI1]** David Clark, Sebastian Hunt and Pasquale Malacaria, *A Static Analysis for Quantifying Information Flow in a Simple Imperative Language*, Journal of Computer Security 15(3), 2007. Uses Shannon information to quantify leakage and relates it to qualitative interference. https://doi.org/10.3233/JCS-2007-15302
- **[TLS1]** E. Rescorla, *The Transport Layer Security (TLS) Protocol Version 1.3*, RFC 8446, 2018. Section 5.4 provides record padding to obscure size; the security discussion notes traffic analysis from encrypted packet lengths/timing and that TLS does not itself eliminate it. https://www.rfc-editor.org/rfc/rfc8446
- **[ZK1]** Shafi Goldwasser, Silvio Micali and Charles Rackoff, *The Knowledge Complexity of Interactive Proof Systems*, SIAM Journal on Computing 18(1), 1989. Foundational definition/examples of zero-knowledge proofs: proving a proposition without conveying additional knowledge beyond its correctness under the formal definition. https://doi.org/10.1137/0218012
- **[MPC1]** Oded Goldreich, Silvio Micali and Avi Wigderson, *How to Play ANY Mental Game*, STOC 1987. Foundational secure multiparty-computation result under its stated adversary/cryptographic assumptions. https://doi.org/10.1145/28395.28420
- **[NIST1]** NIST Privacy-Enhancing Cryptography, *Zero-Knowledge Proof (ZKP)*. Contemporary standards/research overview: prove truth of a mathematical statement without revealing additional witness information; also notes use alongside MPC. https://csrc.nist.gov/projects/pec/zkproof

## Boundary notes

- The executable branch uses an **ideal predicate-proof abstraction**. It is not an implementation of [ZK1]/[NIST1].
- A finite Shannon-leakage result from [QI1]-style reasoning is not a claim of differential privacy, cryptographic semantic security, or arbitrary-program noninterference.
- TLS/WebRTC encryption is not criticized as broken. [TLS1] is cited specifically to separate payload confidentiality from observable traffic metadata.
- Secure computation and zero knowledge are candidate known mechanisms for some placement contracts. Their applicability, circuit/rule binding, setup/trust assumptions, latency, CPU and battery cost for Rinne are unresolved F/E.
