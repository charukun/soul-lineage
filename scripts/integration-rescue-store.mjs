import { client } from './integration.mjs';
import { REPOSITORY, STATE_BRANCH, STATE_FILE, newState } from './integration-rescue-policy.mjs';
import { publishObservation } from './integration-rescue-pulse.mjs';
import { parseRepairState, linkedIssueNumber } from './browser-repair-state.mjs';
import { createHash } from 'node:crypto';

export const contractFingerprint = pr => createHash('sha256').update(JSON.stringify({ title: pr.title, body: pr.body,
  labels: (pr.labels || []).map(l => l.name).sort(), base: pr.base?.ref, branch: pr.head?.ref })).digest('hex');

export function rescueClient(token, config, request = fetch) {
  let requests = 0;
  const started = Date.now();
  return client(REPOSITORY, token, (...args) => {
    if (++requests > config.maxRequests) throw new Error('RESCUE_API_BUDGET_EXHAUSTED');
    if (process.env.RESCUE_COORDINATOR === 'true' && Date.now() - started > 180000) throw new Error('RESCUE_TIME_BUDGET_EXHAUSTED');
    return request(...args);
  }, { diagnosticsPath: process.env.RESCUE_DIAGNOSTICS_PATH });
}
export function browserRepairFor(pr, issues) {
  const linked = linkedIssueNumber(pr.body || '');
  for (const issue of issues.filter(i => !i.pull_request)) {
    const s = parseRepairState(issue.body || '');
    if (!s || (s.sourcePr !== pr.number && issue.number !== linked)) continue;
    if (s.state === 'human-required') return { manual: 'BROWSER_REPAIR_HUMAN_REQUIRED', issue: issue.number };
    if (['pending', 'working'].includes(s.state)) return { blocked: true, issue: issue.number };
  }
  return null;
}
export class RescueStore {
  constructor(c, config, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) { this.c = c; this.config = config; this.wait = wait; }
  async read() {
    try {
      const file = await this.c.api('GET', `${this.c.root}/contents/${STATE_FILE}?ref=${encodeURIComponent(STATE_BRANCH)}`);
      if (file.encoding !== 'base64' || !file.content) throw new Error('RESCUE_STATE_TOO_LARGE_OR_INVALID');
      const state = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      if (state.schema !== 1 || state.repository !== REPOSITORY || !state.records || !Array.isArray(state.activity)) throw new Error('RESCUE_STATE_INVALID');
      return { state, sha: file.sha };
    } catch (error) {
      if (/HTTP 404\b/.test(error.message)) return { state: null, sha: null };
      throw error;
    }
  }
  async initialize() {
    const existing = await this.read();
    if (existing.state) return existing;
    // An isolated orphan state branch; no game code, no main/develop write.
    const tree = await this.c.api('POST', `${this.c.root}/git/trees`, { tree: [{ path: STATE_FILE, mode: '100644', type: 'blob', content: JSON.stringify(newState(this.config)) }] });
    const commit = await this.c.api('POST', `${this.c.root}/git/commits`, { message: 'chore(integration-rescue): initialize durable queue', tree: tree.sha, parents: [] });
    try { await this.c.api('POST', `${this.c.root}/git/refs`, { ref: `refs/heads/${STATE_BRANCH}`, sha: commit.sha }); }
    catch (error) { if (!/HTTP 422\b/.test(error.message)) throw error; }
    const result = await this.read();
    if (!result.state) throw new Error('RESCUE_STATE_INITIALIZATION_FAILED');
    return result;
  }
  async mutate(operation) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { state, sha } = await this.read();
      if (!state) throw new Error('RESCUE_STATE_NOT_INITIALIZED');
      const before = JSON.stringify(state);
      const result = operation(state);
      if (result && typeof result.then === 'function') throw new Error('CAS operation must be synchronous and side-effect free');
      if (JSON.stringify(state) === before) return { state, result };
      state.revision++; state.updatedAt = new Date().toISOString();
      const encoded = Buffer.from(JSON.stringify(state));
      if (encoded.length > 900000) throw new Error('RESCUE_STATE_SIZE_BUDGET');
      try {
        await this.c.api('PUT', `${this.c.root}/contents/${STATE_FILE}`, { branch: STATE_BRANCH, sha,
          message: `chore(integration-rescue): state revision ${state.revision}`, content: encoded.toString('base64') });
        // PULSE is a best-effort observation sink, never a claim or execution dependency.
        await publishObservation(state).catch(error => console.warn(error.message));
        return { state, result };
      } catch (error) {
        if (!/HTTP (409|422)\b/.test(error.message) || attempt === 7) throw error;
        await this.wait(100 + attempt * 100);
      }
    }
    throw new Error('RESCUE_CAS_RETRY_EXHAUSTED');
  }
}

export async function pullEvidence(c, prNumber, { detailed = false } = {}) {
  const pr = await c.api('GET', `${c.root}/pulls/${prNumber}`);
  const reviews = await c.pages(`/pulls/${prNumber}/reviews`, undefined, { maxPages: 3 });
  const [owner, name] = REPOSITORY.split('/');
  let cursor = null, unresolved = false;
  for (let page = 0; page < 5; page++) {
    const data = await c.api('POST', '/graphql', { query: 'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved}pageInfo{hasNextPage endCursor}}}}}', variables: { owner, name, number: prNumber, cursor } });
    const threads = data.data?.repository?.pullRequest?.reviewThreads;
    if (data.errors || !threads || !Array.isArray(threads.nodes)) throw new Error('INCOMPLETE_REVIEW_THREADS');
    unresolved ||= threads.nodes.some(t => !t.isResolved);
    if (!threads.pageInfo.hasNextPage) break;
    if (page === 4) throw new Error('REVIEW_THREAD_BUDGET');
    cursor = threads.pageInfo.endCursor;
  }
  const result = { pr, reviews, unresolved, complete: true };
  if (detailed) {
    result.files = await c.pages(`/pulls/${prNumber}/files`, undefined, { maxPages: 10 });
    if (result.files.length !== pr.changed_files) throw new Error('INCOMPLETE_CHANGED_FILES');
  }
  return result;
}
export async function comparison(c, base, head) {
  if (base === head) return { files: [], mergeBase: base, ahead: 0, status: 'identical' };
  const data = await c.api('GET', `${c.root}/compare/${base}...${head}`);
  if (!data.merge_base_commit?.sha || !Array.isArray(data.files) || data.files.length >= 300) throw new Error('INCOMPLETE_BASE_COMPARISON');
  return { files: data.files.flatMap(f => [f.filename, f.previous_filename].filter(Boolean)), mergeBase: data.merge_base_commit.sha, ahead: data.ahead_by, status: data.status };
}
