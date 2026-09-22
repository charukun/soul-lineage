import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { client, fastGate } from './integration.mjs';
import { dependencies } from './integration-policy.mjs';

export const REPOSITORY = 'charukun/soul-lineage';

export async function stackNativeEvidence(c, prNumber, expectedHead) {
  const child = await c.api('GET', `${c.root}/pulls/${prNumber}`);
  if (child.state !== 'open' || child.draft || child.base?.ref !== 'develop' || child.base?.repo?.full_name !== REPOSITORY || child.head?.repo?.full_name !== REPOSITORY || child.head?.sha !== expectedHead) {
    return { reuse: false, reason: 'CHILD_NOT_CURRENT_READY_HEAD' };
  }

  let direct;
  try { direct = dependencies(child.body || ''); }
  catch { return { reuse: false, reason: 'DEPENDENCY_PARSE_FAILED' }; }
  if (direct.length !== 1) return { reuse: false, reason: direct.length ? 'MULTI_DEPENDENCY_FALLBACK' : 'NO_DIRECT_DEPENDENCY' };

  const parent = await c.api('GET', `${c.root}/pulls/${direct[0]}`);
  if (parent.base?.ref !== 'develop' || parent.base?.repo?.full_name !== REPOSITORY || parent.head?.repo?.full_name !== REPOSITORY || parent.state === 'closed' && !parent.merged_at && !parent.merged) {
    return { reuse: false, reason: 'PARENT_NOT_TRUSTED_DEVELOP_PR' };
  }
  if (!await fastGate(c, parent, { cache: true })) return { reuse: false, reason: 'PARENT_EXACT_FAST_EVIDENCE_MISSING', parent: parent.number, parentHead: parent.head.sha };

  const comparison = await c.api('GET', `${c.root}/compare/${parent.head.sha}...${child.head.sha}`, null, { cache: true });
  const ancestor = comparison?.base_commit?.sha === parent.head.sha && comparison?.merge_base_commit?.sha === parent.head.sha && comparison?.head_commit?.sha === child.head.sha && ['ahead', 'identical'].includes(comparison?.status);
  if (!ancestor) return { reuse: false, reason: 'PARENT_HEAD_NOT_EXACT_ANCESTOR', parent: parent.number, parentHead: parent.head.sha };

  return {
    reuse: true,
    reason: 'STACK_PARENT_EXACT_EVIDENCE_REUSED',
    baseSha: parent.head.sha,
    parent: parent.number,
    parentHead: parent.head.sha,
    parentMerged: Boolean(parent.merged_at || parent.merged),
    aheadBy: comparison.ahead_by,
  };
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
  assert.ok(process.env.GH_TOKEN, 'Missing scoped Actions token');
  const pr = Number(process.env.PR_NUMBER);
  const head = process.env.HEAD_SHA;
  assert.ok(Number.isSafeInteger(pr) && pr > 0);
  assert.match(head || '', /^[0-9a-f]{40}$/);
  const c = client(REPOSITORY, process.env.GH_TOKEN);
  const result = await stackNativeEvidence(c, pr, head);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `reuse=${result.reuse}\nbase_sha=${result.baseSha || ''}\nparent=${result.parent || ''}\nparent_head=${result.parentHead || ''}\nreason=${result.reason}\n`);
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
