export const CONTROL_PLANE_PREFIXES = Object.freeze([
  '.github/workflows/',
  'ops-board/',
  'scripts/integration',
  'scripts/browser-repair',
  'scripts/implementation-handoff',
  'scripts/notify-delivery',
  'scripts/deploy',
  'scripts/verify-live',
  'scripts/site-dedupe',
  'scripts/control-plane',
  'scripts/integration-control',
  'tests/integration',
  'tests/browser-repair',
  'tests/ops-',
  'tests/pulse-',
  'tests/site-dedupe',
  'tests/control-plane',
  'docs/INTEGRATION',
  'docs/DEVELOPMENT.md',
  'docs/RINNE_PROJECT_EXECUTION_POLICY.md',
  'docs/BROWSER_SELF_HEALING.md',
  'docs/OPS_BOARD.md',
  '.task-start/',
]);

export function isControlPlanePath(path = '') {
  if (path === 'AGENTS.md' || path === '.github/pull_request_template.md') return true;
  return CONTROL_PLANE_PREFIXES.some(prefix => path.startsWith(prefix));
}

export function controlPlaneScope(files = []) {
  const normalized = [...new Set(files.filter(Boolean))];
  const rejected = normalized.filter(path => !isControlPlanePath(path));
  return {
    trusted: normalized.length > 0 && rejected.length === 0,
    files: normalized,
    rejected,
  };
}

export async function controlPlaneScopeForPr(client, prNumber, { cache = true } = {}) {
  const changed = await client.pages(`/pulls/${prNumber}/files`, undefined, { maxPages: 30, cache });
  const files = changed.flatMap(file => [file.filename, file.previous_filename].filter(Boolean));
  return controlPlaneScope(files);
}
