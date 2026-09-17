import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_OPS_URL = 'https://rinne-ops.c-okamoto.workers.dev/';

async function controlApi(path, body, { baseUrl, refreshToken, request }) {
  const response = await request(new URL(path, baseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${refreshToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`PULSE_ACTION_CLAIM_FAILED:${response.status}:${path}`);
  return response.json();
}

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

export async function deliverControlNotification(state, {
  notificationUrl = '',
  notificationToken = '',
  opsUrl = DEFAULT_OPS_URL,
  refreshToken = '',
  request = fetch,
} = {}) {
  const notification = state?.controlTower?.notification;
  if (!notification?.shouldNotify) return 'skipped';
  if (!notificationUrl) return 'not-configured';
  if (!refreshToken || !notification.key) return 'claim-unavailable';

  const claim = await controlApi('api/action-notification/claim', { key: notification.key }, {
    baseUrl: opsUrl,
    refreshToken,
    request,
  });
  if (!claim?.claimed) return `deduped:${claim?.reason || 'unknown'}`;

  try {
    const result = await notifyControlState(state, {
      url: notificationUrl,
      token: notificationToken,
      request,
    });
    await controlApi('api/action-notification/complete', { key: notification.key, success: true }, {
      baseUrl: opsUrl,
      refreshToken,
      request,
    });
    return result;
  } catch (error) {
    try {
      await controlApi('api/action-notification/complete', { key: notification.key, success: false }, {
        baseUrl: opsUrl,
        refreshToken,
        request,
      });
    } catch { /* preserve original notification error */ }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path || !existsSync(path)) {
    console.log('PULSE_ACTION_NOTIFY=skipped-no-state');
  } else {
    const state = JSON.parse(readFileSync(path, 'utf8'));
    const result = await deliverControlNotification(state, {
      notificationUrl: process.env.NTFY_TOPIC_URL || '',
      notificationToken: process.env.NTFY_TOKEN || '',
      opsUrl: process.env.OPS_URL || DEFAULT_OPS_URL,
      refreshToken: process.env.OPS_REFRESH_TOKEN || '',
    });
    console.log(`PULSE_ACTION_NOTIFY=${result}`);
  }
}
