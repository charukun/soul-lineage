# Schema evolution / semantic migration falsification continuation

## Acceptance contract

Start source of truth: develop `40976636d145e5f465a9a5fd5973b9edc3e3307a` on 2026-09-18.

This loop is orthogonal to the integrated attestation, temporal, causal-provenance, randomness, replayability, privacy, firewall, transaction and rollback axes. It attacks how protected Canon/save/history semantics survive schema and rule evolution.

Required attacks:

1. A higher schema version plus a deterministic migration automatically preserves semantics.
2. Adding a field with a default is backward compatible regardless of the old implicit meaning.
3. Unknown fields can be dropped and later re-saved safely.
4. If v1->v2 and v2->v3 migrations are valid, any direct v1->v3 migration is equivalent automatically.
5. Upgrade then downgrade can be treated as harmless even when migration is lossy.
6. Hash/signature identity can be recomputed on migrated bytes without retaining the original event/schema root.
7. Mixed-version peers can interoperate whenever JSON/parsing succeeds.
8. Schema version alone is enough even when rule/policy meaning changes independently.
9. Non-injective migrations preserve all future audit and lineage queries.
10. Current strict rejection of incompatible saves should be weakened merely to improve availability.

Known bidirectional-transformation/lens, database schema-evolution and serialization compatibility theory retains priority. Any surviving result must be a semantic migration contract/placement rule, not a renamed migration framework.

Evidence classes remain A/B/C/D/E/F. Research-only docs/model/tests may be added under `apps/rinne`; no runtime import, gameplay/save-schema/protocol change, quality-gate weakening, main or Production change is in scope.