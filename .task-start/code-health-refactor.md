# Code Health Refactor

Implement a repository-native code health pipeline that detects source-code bloat and structural debt, scores only material regressions, and can hand actionable refactor work to the existing RINNE Dispatch / Integration flow without modifying main or Production.

Implementation must preserve current app/package boundaries, avoid unsafe automatic semantic rewrites, and keep the repository as the source of truth.
