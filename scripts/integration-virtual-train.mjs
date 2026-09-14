import { REPOSITORY, manualReason } from './integration-rescue-policy.mjs';
import { fastGate, recoveryReady } from './integration.mjs';
import { planIntegrationTrain, quarantineDecision } from './integration-flow-control.mjs';

const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const safeRef = value => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);

export async function virtualTrainCandidates(c, state, develop, { max = 5 } = {}) {
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const scopeByPr = new Map(Object.values(state?.records || {}).filter(r => r.scope?.files?.length).map(r => [Number(r.pr), r.scope]));
  const eligible = [];
  for (const snapshot of open) {
    if (eligible.length >= Math.max(max * 3, 12)) break;
    const record = state?.records?.[snapshot.number];
    if (snapshot.draft || snapshot.head?.repo?.full_name !== REPOSITORY || manualReason(snapshot) || quarantineDecision(record).quarantined) continue;
    const pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
    if (pr.head.sha !== snapshot.head.sha || !await recoveryReady(c, pr) || !await fastGate(c, pr, { cache:true })) continue;
    eligible.push(pr);
  }
  return planIntegrationTrain(eligible, scopeByPr, { max }).selected;
}

export async function buildVirtualTrain(c, state, develop, { runId = Date.now(), max = 5 } = {}) {
  if (!sha(develop)) throw new Error('VIRTUAL_TRAIN_DEVELOP_SHA_REQUIRED');
  const candidates = await virtualTrainCandidates(c, state, develop, { max });
  if (candidates.length < 2) return { status:'skipped', reason:'fewer than two safe independent candidates', base:develop, candidates:candidates.map(pr=>({pr:pr.number,head:pr.head.sha})) };
  const branch = `automation/integration-train-${safeRef(runId)}-${develop.slice(0,8)}`;
  const ref = `refs/heads/${branch}`;
  let current = develop, created = false;
  const merged = [];
  try {
    await c.api('POST', `${c.root}/git/refs`, { ref, sha:develop });
    created = true;
    for (const pr of candidates) {
      const fresh = await c.api('GET', `${c.root}/pulls/${pr.number}`);
      const liveDevelop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
      if (fresh.head.sha !== pr.head.sha || liveDevelop !== develop) return { status:'stale', base:develop, candidates:merged, reason:'develop or candidate head changed during virtual train' };
      try {
        const result = await c.api('POST', `${c.root}/merges`, { base:branch, head:pr.head.sha, commit_message:`Virtual Integration Train: #${pr.number} @ ${pr.head.sha}` });
        if (result?.sha) current = result.sha;
        merged.push({ pr:pr.number, head:pr.head.sha, synthetic:current });
      } catch (error) {
        if (/HTTP 409\b/.test(error.message)) return { status:'conflict', base:develop, candidates:merged, failed:{pr:pr.number,head:pr.head.sha}, reason:'virtual merge conflict' };
        throw error;
      }
    }
    const commit = await c.api('GET', `${c.root}/git/commits/${current}`);
    if (commit?.sha !== current || !sha(commit.tree?.sha)) throw new Error('VIRTUAL_TRAIN_COMMIT_INVALID');
    return { status:'proven', base:develop, candidates:merged, syntheticCommit:current, syntheticTree:commit.tree.sha, createdAt:new Date().toISOString() };
  } finally {
    if (created) await c.api('DELETE', `${c.root}/git/refs/heads/${encodeURIComponent(branch).replace(/%2F/g,'/')}`).catch(()=>{});
  }
}

export async function recordVirtualTrain(store, proof, now = Date.now()) {
  await store.mutate(state => {
    state.flowControl ||= {};
    state.flowControl.trainProof = { ...proof, recordedAt:new Date(now).toISOString() };
  });
  return proof;
}