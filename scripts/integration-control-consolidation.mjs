import { controlPlaneScopeForPr } from './integration-control-plane.mjs';
import { REPOSITORY, manualReason } from './integration-rescue-policy.mjs';

const SHA = /^[0-9a-f]{40}$/;

export function supersededNumbers(body = '') {
  const values = [];
  for (const match of String(body).matchAll(/^Supersedes:\s*(.+)$/gim)) {
    for (const token of match[1].split(/[\s,]+/)) {
      const m = token.match(/^#(\d+)$/);
      if (m) values.push(Number(m[1]));
    }
  }
  return [...new Set(values)];
}

async function treeEntries(c, commitSha) {
  if (!SHA.test(commitSha || '')) throw new Error('CONTROL_CONSOLIDATION_SHA_REQUIRED');
  const commit = await c.api('GET', `${c.root}/git/commits/${commitSha}`);
  if (commit?.sha !== commitSha || !SHA.test(commit.tree?.sha || '')) throw new Error('CONTROL_CONSOLIDATION_COMMIT_INVALID');
  const tree = await c.api('GET', `${c.root}/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree?.sha !== commit.tree.sha || tree.truncated !== false || !Array.isArray(tree.tree)) throw new Error('CONTROL_CONSOLIDATION_TREE_INCOMPLETE');
  const entries = new Map();
  for (const item of tree.tree) if (item.type !== 'tree') entries.set(item.path, `${item.mode}:${item.type}:${item.sha}`);
  return entries;
}

export async function exactControlPlaneInclusion(c, oldPr, replacementPr) {
  const scope = await controlPlaneScopeForPr(c, oldPr.number, { cache: true });
  if (!scope.trusted || !scope.files.length || scope.files.length > 160) return { included: false, reason: 'OLD_SCOPE_NOT_TRUSTED_OR_TOO_LARGE' };
  const [oldTree, replacementTree] = await Promise.all([treeEntries(c, oldPr.head.sha), treeEntries(c, replacementPr.head.sha)]);
  for (const path of scope.files) {
    if ((oldTree.get(path) ?? null) !== (replacementTree.get(path) ?? null)) return { included: false, reason: `CONTENT_DIFF:${path}` };
  }
  return { included: true, files: scope.files.length };
}

export async function consolidateControlPlanePrs(c, { maxReplacements = 4 } = {}) {
  const open = await c.pages('/pulls?state=open&base=develop&sort=updated&direction=desc', undefined, { maxPages: 6, cache: true });
  const replacements = open.filter(pr => !pr.draft && pr.head?.repo?.full_name === REPOSITORY && supersededNumbers(pr.body).length).slice(0, maxReplacements);
  const closed = [], held = [];
  for (const replacementSnapshot of replacements) {
    const replacement = await c.api('GET', `${c.root}/pulls/${replacementSnapshot.number}`);
    if (manualReason(replacement) || !['OWNER','MEMBER','COLLABORATOR'].includes(replacement.author_association)) continue;
    const replacementScope = await controlPlaneScopeForPr(c, replacement.number, { cache: true });
    if (!replacementScope.trusted) continue;
    for (const number of supersededNumbers(replacement.body)) {
      if (number === replacement.number) continue;
      const old = await c.api('GET', `${c.root}/pulls/${number}`);
      if (old.state !== 'open' || old.draft || old.base?.ref !== 'develop' || old.head?.repo?.full_name !== REPOSITORY) continue;
      const proof = await exactControlPlaneInclusion(c, old, replacement);
      if (!proof.included) { held.push({ old: number, replacement: replacement.number, reason: proof.reason }); continue; }
      const freshOld = await c.api('GET', `${c.root}/pulls/${number}`);
      const freshReplacement = await c.api('GET', `${c.root}/pulls/${replacement.number}`);
      if (freshOld.head.sha !== old.head.sha || freshReplacement.head.sha !== replacement.head.sha || freshOld.state !== 'open' || freshReplacement.state !== 'open' || freshReplacement.draft) continue;
      await c.api('POST', `${c.root}/statuses/${old.head.sha}`, {
        state: 'success', context: 'integration/queue',
        description: `SUPERSEDED by #${replacement.number}: exact control-plane content included`,
        target_url: freshReplacement.html_url,
      });
      await c.api('POST', `${c.root}/issues/${number}/comments`, {
        body: `SUPERSEDED by #${replacement.number}. Exact touched control-plane file identities are included in replacement head \`${replacement.head.sha}\`. No semantic-similarity guess was used.`,
      });
      await c.api('PATCH', `${c.root}/pulls/${number}`, { state: 'closed' });
      closed.push({ old: number, replacement: replacement.number, head: old.head.sha, files: proof.files });
    }
  }
  return { closed, held };
}
