// Independent clock: PULSE availability never controls Rescue progress.
const REPO = 'charukun/soul-lineage';
export async function wakeRescue(env, request = fetch) {
  if (!env.RESCUE_GITHUB_TOKEN) throw new Error('RESCUE_GITHUB_TOKEN is not configured');
  const response = await request(`https://api.github.com/repos/${REPO}/actions/workflows/deploy.yml/dispatches`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.RESCUE_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json', 'User-Agent': 'integration-rescue-watchdog', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ ref: 'develop', inputs: { rescue_mode: 'scan' } }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Rescue watchdog dispatch: HTTP ${response.status}`);
}
export default {
  fetch() { return new Response('Integration Rescue watchdog: independent scheduled observer', { headers: { 'content-type': 'text/plain' } }); },
  async scheduled(_controller, env, ctx) { ctx.waitUntil(wakeRescue(env)); },
};
