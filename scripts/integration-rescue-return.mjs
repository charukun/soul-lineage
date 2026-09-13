import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { REPOSITORY, rescueConfig, RETURNED, transition, failure } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore, comparison } from './integration-rescue-store.mjs';

export async function returnToIntegration(c, store, now = Date.now()) {
  const lease = randomUUID();
  const reserved = await store.mutate(state => {
    const selected = Object.values(state.records).filter(r => RETURNED.has(r.state) && r.state !== 'AWAITING_PUSH' && r.pendingIntegration &&
      (!r.dispatchLease || now - Date.parse(r.dispatchLease.at) > 60000)).slice(0, store.config.maxConcurrency);
    for (const r of selected) r.dispatchLease = { id: lease, at: new Date(now).toISOString() };
    return selected.map(r => structuredClone(r));
  });
  const pending = reserved.result;
  if (!pending.length) return [];
  try {
  const checked = [];
  for (const r of pending.slice(0, store.config.maxConcurrency)) {
    const pr = await c.api('GET', `${c.root}/pulls/${r.pr}`);
    if (pr.head.sha !== (r.pushedSha || r.headSha)) {
      await store.mutate(state => {
        const current = state.records[r.pr];
        if (current?.rescueId !== r.rescueId || current.dispatchLease?.id !== lease) return;
        current.dispatchLease = null; current.pendingIntegration = false;
        failure(state, current, 'HEAD_CHANGED_BEFORE_INTEGRATION_RETURN', now);
      });
      continue;
    }
    checked.push({ pr: r.pr, rescueId: r.rescueId, head: pr.head.sha });
  }
  if (!checked.length) return [];
  // One aggregated, standard Integration wakeup. No success/check/review is manufactured.
  await c.api('POST', `${c.root}/actions/workflows/deploy.yml/dispatches`, { ref: 'develop' });
  await store.mutate(state => {
    for (const item of checked) {
      const r = state.records[item.pr];
      if (r?.rescueId !== item.rescueId || !r.pendingIntegration || r.dispatchLease?.id !== lease) continue;
      r.pendingIntegration = false; r.dispatchLease = null; r.integrationRequestedAt = new Date(now).toISOString();
      transition(state, r, 'CHECKING', 'Integrationへ再評価を依頼済み。現在headの通常gate待ち', now);
    }
  });
  return checked.map(r => r.pr);
  } catch (error) {
    await store.mutate(state => {
      for (const item of pending) {
        const r = state.records[item.pr];
        if (r?.dispatchLease?.id !== lease) continue;
        r.dispatchLease = null; r.integrationDispatchFailures = (r.integrationDispatchFailures || 0) + 1;
        if (r.integrationDispatchFailures >= r.maxAttempts) failure(state, r, 'INTEGRATION_DISPATCH_FAILED', now, true);
      }
    });
    throw error;
  }
}
export async function collectDelivery(c, store, now = Date.now()) {
  const { state } = await store.read();
  const branch = await c.api('GET', `${c.root}/branches/develop`);
  const statuses = await c.pages(`/commits/${branch.commit.sha}/statuses`, undefined, { maxPages: 3 });
  if (statuses.find(s => s.context === 'integration/develop')?.state !== 'success') return;
  const delivered = [];
  for (const r of Object.values(state.records).filter(r => r.state === 'MERGED' && r.mergeCommit).slice(0, 12)) {
    const diff = await comparison(c, r.mergeCommit, branch.commit.sha);
    if (['ahead', 'identical'].includes(diff.status)) delivered.push({ pr: r.pr, rescueId: r.rescueId });
  }
  await store.mutate(state => {
    for (const item of delivered) {
      const r = state.records[item.pr]; if (r?.rescueId !== item.rescueId || r.state !== 'MERGED') continue;
      r.devAt = new Date(now).toISOString(); r.devCommit = branch.commit.sha;
      transition(state, r, 'DEV', 'developの公開・focused browser gate成功を確認', now);
    }
  });
}
export async function notifyOutbox(c, store, { url = '', token = '', request = fetch } = {}) {
  const { state } = await store.read();
  for (const item of state.outbox.filter(n => !n.sentAt && (n.notificationAttempts || 0) < 3 && (!n.nextNotificationAt || Date.parse(n.nextNotificationAt) <= Date.now())).slice(0, 5)) {
    const message = item.type === 'manual' ? `Integration Rescue\nFAILED\nPR: #${item.pr}\nstate: FAILED_MANUAL\nattempt: ${item.attempt}/${item.maxAttempts}\nreason: ${item.reason}\nnext action: human review required` :
      `Integration Rescue\nREADY_FOR_INTEGRATION\nWave: ${item.wave}\nReturned to Integration: ${item.prs.map(n => '#' + n).join(' ')}\nManual: ${item.manual.map(n => '#' + n).join(' ') || 'none'}\nCI/browser monitoring: Integration; repair workers ended`;
    try {
    // Existing ntfy deployment can supply its normal topic URL/token; never invent a recipient.
    if (url) {
      if (!url.startsWith('https://')) throw new Error('NTFY_HTTPS_REQUIRED');
      const response = await request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: message, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`NTFY_FAILED:${response.status}`);
    } else if (item.type === 'manual') {
      // Repository-native notification and durable recovery point when no push topic is configured.
      const marker = `<!-- integration-rescue-notice:${item.id} -->`;
      const comments = await c.pages(`/issues/${item.pr}/comments`, undefined, { maxPages: 3 });
      if (!comments.some(comment => comment.body?.includes(marker))) await c.api('POST', `${c.root}/issues/${item.pr}/comments`, { body: `${marker}\n${message}` });
    }
    await store.mutate(state => {
      const entry = state.outbox.find(n => n.id === item.id);
      if (entry) { entry.sentAt = new Date().toISOString(); entry.channel = url ? 'ntfy' : item.type === 'manual' ? 'github-pr' : 'pulse-summary'; }
    });
    } catch (error) {
      // Notification transport is not a repair/validation gate. Keep the unsent
      // receipt and a bounded retry in durable state, without claiming delivery.
      await store.mutate(state => {
        const entry = state.outbox.find(n => n.id === item.id);
        if (!entry || entry.sentAt) return;
        entry.notificationAttempts = (entry.notificationAttempts || 0) + 1;
        entry.notificationError = String(error.message).slice(0, 400);
        entry.nextNotificationAt = new Date(Date.now() + entry.notificationAttempts * 300000).toISOString();
      });
      console.warn(`Rescue notification ${item.id} was not delivered: ${error.message}`);
    }
  }
}
export async function finalize(c, store, now = Date.now()) {
  const returned = await returnToIntegration(c, store, now);
  await store.mutate(state => {
    for (const wave of state.waves) {
      if (wave.completedAt) continue;
      const records = wave.rescueIds.map(id => Object.values(state.records).find(r => r.rescueId === id));
      if (records.some(r => r?.lease || r?.state === 'AWAITING_PUSH' || r?.pushLease)) continue;
      wave.completedAt = new Date(now).toISOString();
      const prs = records.filter(r => r?.returnedAt).map(r => r.pr), manual = records.filter(r => r?.state === 'FAILED_MANUAL').map(r => r.pr);
      wave.returned = prs; wave.manual = manual;
      if (prs.length) state.outbox.push({ id: `${wave.id}:summary`, type: 'wave', wave: wave.id, prs, manual });
    }
    state.outbox = state.outbox.filter(n => !n.sentAt || now - Date.parse(n.sentAt) < 86400000).slice(-100);
  });
  await collectDelivery(c, store, now);
  return returned;
}
async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') throw new Error('RESCUE_TRUSTED_DEVELOP_ONLY');
  if (process.argv[2] === '--coordinator-failure') {
    const message = `Integration Rescue\nFAILED\nCoordinator stopped. Existing claims remain fenced.\nRun: https://github.com/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}\nNext action: inspect diagnostics; independent watchdog will retry a bounded scan.`;
    if (process.env.NTFY_TOPIC_URL) {
      if (!process.env.NTFY_TOPIC_URL.startsWith('https://')) throw new Error('NTFY_HTTPS_REQUIRED');
      const response = await fetch(process.env.NTFY_TOPIC_URL, { method: 'POST', headers: { 'content-type': 'text/plain; charset=utf-8', ...(process.env.NTFY_TOKEN ? {Authorization:`Bearer ${process.env.NTFY_TOKEN}`} : {}) }, body: message, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`NTFY_FAILED:${response.status}`);
    } else console.error(message);
    return;
  }
  const config = rescueConfig(process.env), c = rescueClient(process.env.GH_TOKEN, config), store = new RescueStore(c, config);
  await finalize(c, store);
  await notifyOutbox(c, store, { url: process.env.NTFY_TOPIC_URL, token: process.env.NTFY_TOKEN });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
