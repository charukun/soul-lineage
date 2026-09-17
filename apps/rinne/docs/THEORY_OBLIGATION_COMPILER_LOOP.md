# Obligation compiler falsification continuation

Start source of truth: develop `5526851df4ec2a75270bcf55c54667fbfeb579c6` on 2026-09-17. The merged thought-synthesis result is current repository truth to attack, not a protected conclusion.

This continuation tests whether the surviving `action precondition -> conservative evidence -> rights -> coordination escalation` structure can survive deeper attacks on:

- information lower bounds for decision evidence;
- capability delegation, attenuation, revocation and replay;
- multi-domain irreversible actions and partial commit;
- negative facts / uniqueness / absence proofs;
- rule-version drift and dynamic effect-language extensions;
- proof-object completeness versus mere authenticity;
- composition of independently valid evidence capsules.

Every result remains classified A theorem/conditional proof, B bounded executable evidence, C assumption, D heuristic, E measurement, or F unresolved. Known theory wins naming priority. No new protocol name is allowed unless a residual theorem or mechanism survives prior-art equivalence and counterexamples.

Required deliverables:

1. at least one new counterexample that breaks the current compiler candidate;
2. at least one repaired abstraction with executable mutation sensitivity;
3. primary-source comparison with communication complexity, authorization/capability, atomic-commit/transaction and proof-carrying approaches where relevant;
4. explicit lower-bound and impossibility boundaries, including cases where minimal evidence is inherently large;
5. node-local feasibility only: local persistent/volatile state, received messages, local timers, cryptographic evidence, and explicitly trusted services;
6. no runtime/main/Production changes in this research loop.

A finite passing suite remains bounded evidence, not theory completion.
