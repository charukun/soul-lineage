# Integration Control Plane v2

Status: implementation started
Base: develop
Purpose: reduce Integration / Rescue / PULSE self-contention while preserving exact-head, review, browser, hold, dependency, and publication safety gates.

Scope:
- trusted control-plane fast lane
- dispatch coalescing
- Integration / DEV publication separation
- repair ticket supersession
- PULSE throughput and notification health
- Pages artifact deduplication
- control-plane canary

main / Production are out of scope.
