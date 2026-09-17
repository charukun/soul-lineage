# Causal provenance loop: primary-source register

These references prevent established logical-time, causal-debugging, partial-order and provenance mechanisms from being relabeled as RRP novelty.

## Logical and causal time

- **C1 — Leslie Lamport, 1978, _Time, Clocks, and the Ordering of Events in a Distributed System_.** Communications of the ACM 21(7), 558–565. Author PDF: https://lamport.azurewebsites.net/pubs/time-clocks.pdf
  - Defines happened-before as a partial order and shows logical clocks / a total extension useful for coordination. A total extension orders concurrent events too.
- **C2 — Friedemann Mattern, 1989, _Virtual Time and Global States of Distributed Systems_.** Proc. Workshop on Parallel and Distributed Algorithms, pp. 215–226. ETH record: https://vs.inf.ethz.ch/publ/bibtex.html?file=papers%2FVirtTimeGlobStates
  - Vector-clock style virtual time represents partial-order causal structure without assuming one global linear time.
- **C3 — Colin Fidge, 1988, _Timestamps in Message-Passing Systems that Preserve the Partial Ordering_.** Australian Computer Science Communications 10(1). See references/record in later vector-time literature.
- **C4 — Reinhard Schwarz and Friedemann Mattern, 1994, _Detecting Causal Relationships in Distributed Computations: In Search of the Holy Grail_.** Distributed Computing 7, 149–174. DOI 10.1007/BF02277859. Accessible copy: https://homes.cs.washington.edu/~arvind/cs425/doc/schwarz94detecting.pdf
  - Surveys the difficulty of identifying causality significant to applications and distinguishes causal observation/debugging concerns from naïve timestamp order.

## Partial-order reasoning

- **C5 — Girish Bhat and Doron Peled, 1998, _Adding Partial Orders to Linear Temporal Logic_.** Fundamenta Informaticae 36(1). DOI: https://doi.org/10.3233/FI-1998-3611
  - Explicitly reasons about equivalent execution sequences and partial-order execution structure. This branch's toy commutativity/read-write examples are explanatory only and do not reproduce a full POR theorem.

## Provenance

- **P1 — Todd J. Green, Grigoris Karvounarakis, Val Tannen, 2007, _Provenance Semirings_.** PODS 2007, 31–40. DOI: https://doi.org/10.1145/1265530.1265535 ; accessible PDF: https://courses.cs.washington.edu/courses/cse544/11wi/lectures/tannen-semirings.pdf
  - Gives compositional provenance annotations for relational algebra/datalog and unifies several provenance notions. It is prior art for algebraic derivation tracking, not a game protocol.
- **P2 — W3C, 2013, _PROV-DM: The PROV Data Model_.** https://www.w3.org/TR/prov-dm/
  - Models entities, activities, generation, usage, derivation and related provenance relations. W3C PROV is a general representation model, not a distributed authorization or causal-completeness proof.

## Scope rule

Logical happened-before, vector clocks, partial-order reduction, and provenance DAG/algebra mechanisms retain their established names. The residual Rinne-specific problem is mapping actual protected game semantics to conservative semantic-parent edges and deciding which explanation closure must be retained with each Canon fact.
