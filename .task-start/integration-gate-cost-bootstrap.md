# Integration gate-cost bootstrap

Status: bootstrap repair
Base: latest develop
Purpose: install the trusted cheap preflight module on develop so Autonomous Delivery v4 can validate its own exact head without weakening CI.

Scope:
- scripts/integration-gate-cost.mjs
- focused regression test

Safety:
- no CI gate removal
- no timeout/assertion weakening
- no main/Production change
