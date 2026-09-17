# Semantic evolution: primary sources and access scope

Companion to [the research report](THEORY_SEMANTIC_EVOLUTION.md). Consulted 2026-09-18. External sources establish prior art and specific format rules; the executable counterexamples and conditional arguments in this PR are our own models, not reproduced benchmarks or proofs of these implementations.

## S1. Protocol Buffers, official proto3 language guide

https://protobuf.dev/programming-guides/proto3/

Read sections Updating A Message Type, Binary Wire-safe/compatible Changes, and Unknown Fields/Retaining Unknown Fields. The guide distinguishes parse compatibility from application compatibility, warns about conditional numeric compatibility and rollout constraints, and documents loss of unknown fields through JSON or field-by-field reconstruction. The PR uses a small JSON object analogy, not an installed Protobuf runtime test.

## S2. Apache Avro 1.12.0 specification

https://avro.apache.org/docs/1.12.0/specification/

Read Schema Resolution, Parsing Canonical Form, its STRIP rule, Schema Fingerprints, and Logical Types. Parsing canonicalization preserves parsing-relevant attributes, not every interpretation attribute. Our millis/micros example illustrates the omitted logical-type distinction; its `parsingOnly` helper is explicitly NOT a complete Avro canonicalizer. The application must retain the interpretation it needs rather than confusing parsing identity with semantic identity.

## S3. Foster et al., Combinators for Bidirectional Tree Transformations

J. Nathan Foster, Michael B. Greenwald, Jonathan T. Moore, Benjamin C. Pierce and Alan Schmitt. Original authors' TOPLAS paper PDF:

https://www.cis.upenn.edu/~bcpierce/papers/lenses-toplas-final.pdf

Inspected Section 3, including the actual rendered PDF pages numbered 6 and 7: get/putback, GetPut, PutGet, optional PutPut and totality. A domain must be specified, and laws for partial functions alone are not a useful totality guarantee. We do not claim to have mechanically verified or implemented the full combinator library. Game-invariant preservation is an additional domain/operation obligation in this PR, not a refutation of the published lens laws.

## S4. Litt, van Hardenberg and Henry, Project Cambria (2020)

https://www.inkandswitch.com/cambria/

Original Ink & Switch research report. Read the translation/lens architecture, scalar/multiple-assignee example, Findings and implementation discussion. The authors explicitly analyze imperfect compatibility and the option of requiring an upgrade. This is relevant prior art for translating both data and edits. Our path-rounding and game-life examples are independent, not alleged Cambria defects.

## S5. Rae et al., Online, Asynchronous Schema Change in F1 (2013)

https://research.google/pubs/online-asynchronous-schema-change-in-f1/

Ian Rae, Eric Rollins, Jeff Shute, Sukhdeep Sodhi and Radek Vingralek. Read the authors' publication abstract. It describes online asynchronous schema changes and a safe evolution sequence under an explicit bound on schema-version skew. The complete paper/proof was not inspected here; we delegate no unexamined detail of its theorem to the JavaScript model.

## S6. Herrmann et al., Living in Parallel Realities (2016)

https://arxiv.org/abs/1608.05564

Kai Herrmann, Hannes Voigt, Andreas Behrend, Jonas Rausch and Wolfgang Lehner. Read the original authors' abstract for coexisting versions and the bidirectional evolution language BiDEL/InVerDa. Full implementation and proof were not reproduced. This establishes prior work on multiversion update translation, not a claim that this PR solves every coexistence constraint.

## Repository observations

The start commit and exact runtime blob IDs are in the main report. Those observations concern only the inspected source ranges. No current save was migrated, no gameplay behavior changed, and no actual browser/game correctness or performance result is derived from these sources.
