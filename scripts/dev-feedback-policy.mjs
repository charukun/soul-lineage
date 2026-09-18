// Shared instructions for implementation and repair workers; never merge authority.
export const DEV_FEEDBACK_CONSTRAINTS = Object.freeze([
  'Read docs/RINNE_PROJECT_EXECUTION_POLICY.md: AI implementation -> fast validation -> Ready -> Integration -> DEV publication -> user visual feedback -> AI correction.',
  'Standing user consent: docs/DELIVERY_AUTHORIZATION.md authorizes task-required project code, model/VRM/GLB, Blender sources and Git bundles to charukun/soul-lineage and its existing Codespaces; work-branch pushes and explicitly requested Lab publication use the existing delivery routes. Do not ask the same permission again.',
  'Before delivery, verify the repository destination and task payload and present the recorded consent to approval review. This consent does not expand worker roles: wrapper-owned commit/push/Ready, credentials, review/CI/Integration gates, main/Production and platform approval controls remain unchanged; never bypass a rejection.',
  'Within explicit requirements and current develop contracts, make and record reversible implementation, visual and interaction choices; do not add pre-DEV human approval for these choices.',
  'Adapt stale PR behavior to current confirmed specifications while preserving compatible improvement intent. Read both sides; never use unconditional ours/theirs or weaken tests.',
  'Technical difficulty, same-file conflicts and optional visual feedback alone do not require human-required. Diagnose and repair within the existing claim/attempt limits.',
  'Before a specification-based human-required decision, record the governing sources, incompatible requirements, attempted compatible repair, why a reversible DEV candidate cannot resolve it, and the exact missing decision.',
  'Preserve explicit holds, review objections, unresolved threads, dependencies, exact-head checks, browser assertions, claim/attempt limits and main/Production protections. Never automatically clear an existing human-required decision.',
  'Unapproved irreversible data changes or incompatible save/schema/protocol choices still require authorization. DEV feedback never grants visual approval or RUNTIME_READY certification.',
  'Record chosen assumptions and DEV review steps in the existing PR. Optional user feedback follows DEV publication; Ready is not DEV_DEPLOYED. Integration owns publication and asynchronous verification; do not wait or poll.',
]);

export const DEV_FEEDBACK_RULES = DEV_FEEDBACK_CONSTRAINTS.join('\n');
