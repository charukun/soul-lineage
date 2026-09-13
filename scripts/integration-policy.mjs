// Pure policy: API/permission failures are handled by the caller as blockers.
export const contextName = 'integration/develop';
export const sensitive = path => /^(\.github\/|scripts\/|AGENTS\.md$|docs\/(DEVELOPMENT|INTEGRATION|RINNE_PROJECT_EXECUTION_POLICY)\.md$)/.test(path);
export const scope = path => path.startsWith('packages/') ? path.split('/').slice(0, 2).join('/') : path;
const trustedReview = review => review.user?.login === 'github-actions[bot]' && /^Trusted Integration Review: exact head [0-9a-f]{40}\b/.test(review.body || '');
export function dependencies(body = '') {
  const result = [];
  for (const line of body.split('\n').filter(line => /^Depends-On:/i.test(line))) {
    const value = line.replace(/^Depends-On:\s*/i, '').trim();
    if (/^(none|なし)$/i.test(value)) continue;
    if (!/^#\d+(?:\s*,\s*#\d+)*$/.test(value)) throw new Error('Invalid Depends-On; use #12, #13 or none');
    result.push(...[...value.matchAll(/#(\d+)/g)].map(match => Number(match[1])));
  }
  return [...new Set(result)];
}
export function reviewDecision(reviews, head) {
  const latest = new Map();
  for (const r of [...reviews].sort((a, b) => a.id - b.id)) {
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) latest.set(r.user.login, r);
  }
  const values = [...latest.values()];
  return { rejected: values.some(r => r.state === 'CHANGES_REQUESTED'), approved: values.some(r =>
    r.state === 'APPROVED' && r.commit_id === head &&
    (['OWNER', 'MEMBER', 'COLLABORATOR'].includes(r.author_association) || trustedReview(r))) };
}
export function eligibility({ pr, repository, files, reviews, unresolved, dependenciesMerged, checksPassed, baseChanges = [], recovery = false }) {
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'develop') return 'not a Ready develop PR';
  if (pr.head.repo?.full_name !== repository || !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association)) return 'external contribution requires Integration review';
  const labels = pr.labels.map(x => x.name);
  if (labels.some(x => ['integration:hold', 'integration:manual', 'do-not-merge'].includes(x)) || /^Integration-Hold:\s*\S+/im.test(pr.body || '')) return 'explicit Integration hold';
  if (recovery && !labels.includes('integration:repair')) return 'previous final develop gate failed; repair first';
  if (pr.mergeable !== true || !['clean', 'unstable', 'has_hooks'].includes(pr.mergeable_state)) return 'mergeability/protection requires attention';
  const review = reviewDecision(reviews, pr.head.sha);
  if (review.rejected || unresolved) return 'unresolved review or requested changes';
  if (!dependenciesMerged) return 'dependency PR is not merged into develop';
  if (!checksPassed) return 'current head fast gate or another check is not successful';
  if (files.some(sensitive) && !review.approved) return 'automation/deployment change requires approval of this head by a maintainer';
  const changedScopes = new Set(baseChanges.map(scope));
  if (files.some(path => changedScopes.has(scope(path))) && !review.approved) return 'overlapping changes since PR base require Integration review';
  return null;
}
