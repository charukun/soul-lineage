import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function notifyControlState(state, {
  url = '',
  token = '',
  request = fetch,
} = {}) {
  const notification = state?.controlTower?.notification;
  if (!notification?.shouldNotify) return 'skipped';
  if (!url) return 'not-configured';
  const response = await request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': notification.title || 'PULSE 確認が必要',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: `${notification.body || 'PULSEで確認が必要です'}\nhttps://rinne-ops.c-okamoto.workers.dev/`,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`PULSE_ACTION_NOTIFY_FAILED:${response.status}`);
  return 'ntfy';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) throw new Error('PULSE_STATE_PATH_REQUIRED');
  const state = JSON.parse(readFileSync(path, 'utf8'));
  const result = await notifyControlState(state, {
    url: process.env.NTFY_TOPIC_URL || '',
    token: process.env.NTFY_TOKEN || '',
  });
  console.log(`PULSE_ACTION_NOTIFY=${result}`);
}
