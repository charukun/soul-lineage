// Independent recovery clock: PULSE availability never controls Integration progress.
// Normal Ready/CI/merge events own the fast path; this worker only repairs a missed wake.
const REPO = 'charukun/soul-lineage';
const API = `https://api.github.com/repos/${REPO}`;
const PAGE_SIZE = 100;
const MAX_READY_PAGES = 2;

function headers(token, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'User-Agent': 'integration-rescue-watchdog',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function isReadyDevelopPull(pr) {
  return pr?.state === 'open' && !pr.draft && pr.base?.ref === 'develop';
}

export async function readyDevelopPulls(env, request = fetch) {
  if (!env.RESCUE_GITHUB_TOKEN) throw new Error('RESCUE_GITHUB_TOKEN is not configured');
  const ready = [];
  for (let page = 1; page <= MAX_READY_PAGES; page++) {
    const response = await request(`${API}/pulls?state=open&base=develop&per_page=${PAGE_SIZE}&page=${page}`, {
      headers: headers(env.RESCUE_GITHUB_TOKEN), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Rescue watchdog ready scan: HTTP ${response.status}`);
    const pulls = await response.json();
    if (!Array.isArray(pulls)) throw new Error('Rescue watchdog ready scan: invalid response');
    ready.push(...pulls.filter(isReadyDevelopPull));
    if (pulls.length < PAGE_SIZE) break;
  }
  return ready;
}

export async function wakeRescue(env, request = fetch) {
  const ready = await readyDevelopPulls(env, request);
  if (!ready.length) return { dispatched: false, ready: 0 };
  const response = await request(`${API}/actions/workflows/deploy.yml/dispatches`, {
    method: 'POST', headers: headers(env.RESCUE_GITHUB_TOKEN, true),
    body: JSON.stringify({ ref: 'develop', inputs: { rescue_mode: 'scan' } }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Rescue watchdog dispatch: HTTP ${response.status}`);
  return { dispatched: true, ready: ready.length };
}

export default {
  fetch() { return new Response('Integration recovery watchdog: hourly missed-wake safety net', { headers: { 'content-type': 'text/plain' } }); },
  async scheduled(_controller, env, ctx) { ctx.waitUntil(wakeRescue(env)); },
};
