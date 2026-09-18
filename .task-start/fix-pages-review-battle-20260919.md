# Dispatch: fix Pages publication for review battle

Request:
- Make the current compact Visual Review battle UI at apps/rinne/review-battle.html actually publish to https://charukun.github.io/soul-lineage/dev/rinne/review-battle.html.
- Preserve the already-implemented compact HUD behavior: hide review/debug selectors, fixed loop/follow ON, compact Jinku phase UI, HP-only lower HUD, pause as the only visible action.
- Repair the current DEV Pages publication blocker without weakening any quality gate.
- Current observed blocker: scripts/develop-completion-contract.mjs expects AGENTS.md to match "Ready for review is transient, not a success terminal", while current AGENTS.md says "Ready is transient, not success."
- Use a git workspace, run affected focused validation, reconcile latest develop, and leave a Ready PR for same-task merge.
