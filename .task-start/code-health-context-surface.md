# Code Health AI context surface

Owner requested reducing AI-driven development codebase reading cost by detecting and progressively refactoring context hotspots. Base: 57d2d5b12c7155c2408a216488268517f071ef44. Branch: refactor/code-health-context-surface-20260917.
Scope: extend Code Health so large byte-heavy or dependency-broad source files are visible/actionable even when LOC is artificially low, and carry that evidence into the existing one-hotspot refactor dispatch path without weakening gates or changing app behavior.
No local checkout is available in this session; connected GitHub text route is used per repository policy. Ready handoff goes to Integration for exact-head CI/develop/DEV publication.
