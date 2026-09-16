# Context plan source retrieval budget

Owner wants refactoring to reduce AI-driven development codebase reading cost, not merely runtime or LOC. Base: 94f61ade08029427438fe8bedc7b918852aea31d. Branch: refactor/context-plan-source-budget-20260917.
Scope: make context:plan classify large source paths as search/line-range first so workers avoid unnecessary whole-file reads while preserving existing document, diff, CI-log, validation, Integration and Production gates.
No local checkout is available in this session; connected GitHub text route is used per repository policy. Ready handoff goes to Integration for exact-head CI/develop/DEV publication.
