# Documentation map

Current truth is, in order:

1. latest `develop` and current GitHub state
2. `AGENTS.md`
3. the one canonical/specialist document needed for the task
4. historical material only when history is the task

Do not load all docs at session start.

## Canonical documents

| Purpose | Document |
| --- | --- |
| Routine implementation | `DEVELOPMENT.md` |
| Context budget | `CONTEXT_EFFICIENCY.md` |
| Completion / evidence / no-wait boundary | `RINNE_PROJECT_EXECUTION_POLICY.md` |
| develop merge / DEV publication | `DEVELOP_MERGE.md` |
| Micro Patch | `MICRO_PATCH_FAST_LANE.md` |
| Browser repair | `BROWSER_SELF_HEALING.md` |
| Explicit browser playtest | `BROWSER_PLAYTEST_ROUTING.md` |
| Workspace / Codespaces recovery | `MOBILE_HYBRID_DEVELOPMENT.md` |
| Delivery authorization | `DELIVERY_AUTHORIZATION.md` |
| Monorepo / platform boundaries | `MONOREPO.md`, `PLATFORMS.md` |
| Distribution | `DISTRIBUTION_ARCHITECTURE.md` |
| Character / DCC / motion | `art/README.md`, `characters/` |
| Dedicated worker dispatch | `DISPATCHER.md` |

## Astra fast flow

```text
implement + focused validation
  -> latest develop sync + revalidation + same-task merge
  -> asynchronous DEV publication
```

Ready is not a terminal state. DEV publication is not waited on or polled. `main` / Production changes require explicit permission.

Keep each rule in one canonical place. Historical documents may preserve old states, but they do not override current `develop`.
