import { createHash } from 'node:crypto';
import { rescueView } from '../ops-board/rescue.mjs';
import { REPOSITORY } from './integration-rescue-policy.mjs';
export async function publishObservation(state, request = fetch) {
  if (!process.env.CLOUDFLARE_API_TOKEN) return;
  const token = createHash('sha256').update(`${process.env.CLOUDFLARE_API_TOKEN}|${REPOSITORY}|rinne-ops-refresh-v1`).digest('hex');
  const response = await request('https://rinne-ops.c-okamoto.workers.dev/api/rescue-observation', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(rescueView(state)), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`PULSE observation HTTP ${response.status}`);
}
