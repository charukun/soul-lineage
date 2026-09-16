# Village retired enhancement shim refactor

Owner requested removal of meaningless/redundant code and structural excess while preserving behavior. Base: dbee76eb057a3bebdebe9f1a0cca3c49063fdd13. Branch: refactor/village-retired-enhancement-shims-20260917.
Scope: remove side-effect-free retired Village compatibility modules from the enhancement graph, point regression tests at the current responsibility owners, and preserve effective enhancement order, gameplay, save/network authority, render/input timing, browser assertions and Production gates.
No local checkout is available in this session because direct GitHub network access from the execution container is unavailable; the connected GitHub text route is used per repository policy. Ready handoff goes to Integration for exact-head CI/develop/DEV publication.
