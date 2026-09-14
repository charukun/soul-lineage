import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const CANARY_CONTEXT = 'integration/canary';
export const NOTIFICATION_CONTEXT = 'notification/ntfy';

export function evaluateCanary({ sha, manifest, pulse, statuses = [] }) {
  const latest = new Map();
  for (const status of statuses) if (!latest.has(status.context)) latest.set(status.context, status);
  const checks = {
    manifest: manifest?.validatedDevelop === sha,
    pulse: pulse?.repository === 'charukun/soul-lineage' && Number.isFinite(Date.parse(pulse?.generatedAt || '')),
    develop: latest.get('integration/develop')?.state === 'success',
    pulsePublication: latest.get('ops-board/public')?.state === 'success',
    notification: latest.get(NOTIFICATION_CONTEXT)?.state === 'success',
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const sha = process.env.FINAL_SHA;
  const site = process.env.SITE_URL || 'https://charukun.github.io/soul-lineage/';
  const pulseUrl = process.env.OPS_BOARD_URL || 'https://rinne-ops.c-okamoto.workers.dev/';
  assert.equal(repository, 'charukun/soul-lineage');
  assert.ok(token && /^[0-9a-f]{40}$/.test(sha || ''));
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const statusResponse = await fetch(`https://api.github.com/repos/${repository}/commits/${sha}/statuses?per_page=100`, { headers, signal: AbortSignal.timeout(15000) });
  assert.equal(statusResponse.status, 200);
  const statuses = await statusResponse.json();
  const [manifestResponse, pulseResponse] = await Promise.all([
    fetch(new URL(`deployment-manifest.json?canary=${Date.now()}`, site), { signal: AbortSignal.timeout(15000) }),
    fetch(new URL(`api/state?canary=${Date.now()}`, pulseUrl), { signal: AbortSignal.timeout(15000) }),
  ]);
  const manifest = manifestResponse.ok ? await manifestResponse.json() : null;
  const pulse = pulseResponse.ok ? await pulseResponse.json() : null;
  const result = evaluateCanary({ sha, manifest, pulse, statuses });
  const response = await fetch(`https://api.github.com/repos/${repository}/statuses/${sha}`, {
    method: 'POST', headers, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      state: result.ok ? 'success' : 'failure',
      context: CANARY_CONTEXT,
      description: result.ok ? 'Ready/Integration/DEV/PULSE/notification evidence is coherent' :
        `Control-plane canary failed: ${Object.entries(result.checks).filter(([, ok]) => !ok).map(([key]) => key).join(', ')}`.slice(0, 140),
      target_url: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    }),
  });
  if (!response.ok) throw new Error(`CANARY_STATUS_HTTP_${response.status}`);
  console.log(JSON.stringify({ sha, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
