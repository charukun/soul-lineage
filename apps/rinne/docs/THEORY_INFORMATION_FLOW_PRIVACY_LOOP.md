# RRP information-flow / privacy falsification continuation

## Acceptance contract

Start source of truth: develop `2b966745cb48c27593711b008d74709dec65a609` on 2026-09-18.

This loop is intentionally orthogonal to the already integrated reconstruction, obligation/compiler, accountability/rollback and nondeterminism/reproducibility work. It tests a different claim: whether RRP can minimize replicated state and still accidentally disclose more game information than an observer is entitled to learn.

The loop must distinguish at least:

1. semantic sufficiency from confidentiality: evidence can be sufficient for correctness yet over-disclose secrets;
2. explicit payload leakage from metadata/timing/length leakage and from adaptive accept/reject oracles;
3. permitted declassification from accidental transitive release;
4. confidentiality against guests/observers from confidentiality against an authoritative host that necessarily computes the state;
5. qualitative noninterference from quantitative leakage budgets.

No new protocol name is introduced. Classical noninterference, intransitive information-flow, declassification, quantitative information-flow and traffic-analysis results retain priority. Research-only model/tests may be added under `apps/rinne`; no runtime gameplay, save schema, protocol, main or Production changes are in scope.

Evidence classes remain A conditional theorem/argument, B bounded executable evidence, C assumptions, D heuristics, E measurements and F unresolved obligations.
