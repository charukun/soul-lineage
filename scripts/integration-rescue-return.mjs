import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { REPOSITORY, rescueConfig, RETURNED, transition, failure } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore, comparison } from './integration-rescue-store.mjs';
import { workRepairEligibility } from './integration-rescue-work-repair-policy.mjs';
import { bestKnownPlaybook } from './integration-failure-knowledge.mjs';
import { reconcileStack } from './integration-queue-recovery.mjs';
import { aiRepairEnvelope, aiRepairEnvelopeMarker } from './integration-ai-repair-envelope.mjs';

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
    await c.api('POST', `${c.root}/actions/workflows/deploy.yml/dispatches`, { ref: 'develop' });
    await store.mutate(state => {
      for (const item of checked) {
        const r = state.records[item.pr];
        if (r?.rescueId !== item.rescueId || !r.pendingIntegration || r.dispatchLease?.id !== lease) continue;
        r.pendingIntegration = false; r.dispatchLease = null; r.integrationRequestedAt = new Date(now).toISOString();
        transition(state, r, 'CHECKING', 'Integrationへ再評価を依頼済み。Rescue返却PRを優先して現在headの通常gateを確認', now);
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

export async function reconcileReadyStacks(c, { limit = 4 } = {}) {
  const develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const candidates = open.filter(pr => !pr.draft && pr.head?.repo?.full_name === REPOSITORY && /^Depends-On:\s*#\d/im.test(pr.body || '')).slice(0, limit);
  const result = [];
  for (const pr of candidates) {
    try {
      const outcome = await reconcileStack(c, pr, develop, { write: true });
      if (!['not-stacked', 'dependency-wait', 'safety-hold', 'already-current'].includes(outcome.state)) result.push({ pr: pr.number, ...outcome });
    } catch (error) {
      result.push({ pr: pr.number, state: 'error', reason: error.message });
    }
  }
  return result;
}

export function stackValidationMatrix(stacks = []) {
  return stacks
    .filter(item => item?.state === 'merged-forward' && Number.isSafeInteger(Number(item.pr)) &&
      /^[0-9a-f]{40}$/i.test(item.sha || '') && /^[0-9a-f]{40}$/i.test(item.develop || ''))
    .map(item => ({ pr: Number(item.pr), head: item.sha, base: item.develop }));
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
      const r = state.records[item.pr];
      if (r?.rescueId !== item.rescueId || r.state !== 'MERGED') continue;
      r.devAt = new Date(now).toISOString(); r.devCommit = branch.commit.sha;
      transition(state, r, 'DEV', 'developの公開・focused browser gate成功を確認', now);
    }
  });
}

async function signalWorkRepair(c, item, record, message, state) {
  const eligibility = workRepairEligibility(record);
  if (item.type !== 'manual' || !eligibility.eligible || !record?.headSha) return false;
  const pr = await c.api('GET', `${c.root}/pulls/${item.pr}`);
  if (pr.state !== 'open' || pr.draft || pr.head?.sha !== record.headSha || pr.head?.repo?.full_name !== REPOSITORY || pr.base?.ref !== 'develop') return false;
  const marker = `<!-- integration-rescue-work-request:${item.id} -->`;
  const comments = await c.pages(`/issues/${item.pr}/comments`, undefined, { maxPages: 3 });
  const knowledge = bestKnownPlaybook(state, item.reason || record.failureReason || '');
  const learned = knowledge.learned
    ? `\nKnown pattern: ${knowledge.learned.id} (${knowledge.learned.successfulRepairs}/${knowledge.learned.count} prior successful repairs).\nSuggested safe playbook:\n- ${knowledge.learned.playbook.join('\n- ')}`
    : `\nSuggested safe playbook:\n- ${knowledge.fingerprint.playbook.join('\n- ')}`;
  if (!comments.some(comment => comment.body?.includes(marker))) {
    const develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
    const envelope = aiRepairEnvelope({
      pr: item.pr,
      branch: pr.head.ref,
      head: pr.head.sha,
      develop,
      repairKind: eligibility.kind,
      reason: item.reason || record.failureReason || 'FAILED_MANUAL repair requested',
      attempt: eligibility.attempts,
      maxAttempts: eligibility.maxAttempts,
      source: 'integration-rescue-work',
    });
    await c.api('POST', `${c.root}/issues/${item.pr}/comments`, {
      body: `${marker}\n${aiRepairEnvelopeMarker(envelope)}\nAI_REPAIR_REQUIRED\n${message}\n\nWork-Repair-Kind: ${eligibility.kind}${learned}\n\nThe envelope is a bounded handoff snapshot, not authority: re-read current PR/head/develop before editing. Periodic Integration Rescue Work remains the durable backstop if an event-driven Work hook is unavailable.`,
    });
  }
  await c.api('POST', `${c.root}/statuses/${record.headSha}`, {
    state: 'pending', context: 'integration-rescue/work-repair',
    description: `AI repair requested: ${eligibility.kind}; periodic Work is fallback`,
    target_url: `https://github.com/${REPOSITORY}/pull/${item.pr}`,
  });
  return true;
}

function currentPr(pr, expectedHead) {
  return [
    Boolean(pr),
    pr?.state === 'open',
    pr?.draft === false,
    pr?.base?.ref === 'develop',
    pr?.base?.repo?.full_name === REPOSITORY,
    pr?.head?.repo?.full_name === REPOSITORY,
    pr?.head?.sha === expectedHead,
  ].every(Boolean);
}

function manualIdentity(record, item) {
  const rescue = record?.rescueId ? record.rescueId : `pr-${record?.pr}`;
  return [
    Boolean(record),
    record?.state === 'FAILED_MANUAL',
    record?.failureReason === item.reason,
    Boolean(record?.headSha),
    item.id === `${rescue}:manual:${item.attempt}`,
  ].every(Boolean);
}

async function prepareManualNotification(c, state, item) {
  const record = state.records?.[item.pr];
  if (!manualIdentity(record, item)) return { send: false, reason: 'manual-state-superseded', record };
  const pr = await c.api('GET', `${c.root}/pulls/${item.pr}`);
  return currentPr(pr, record.headSha)
    ? { send: true, record, pr }
    : { send: false, reason: 'manual-head-superseded', record, liveHead: pr?.head?.sha };
}

async function prepareWaveNotification(c, state, item) {
  const wave = state.waves?.find(w => w.id === item.wave);
  if (!wave) return { send: false, reason: 'wave-superseded', prs: [], manual: [] };
  const rescueIds = new Set(wave.rescueIds ? wave.rescueIds : []);
  const fresh = async (number, kind) => {
    const record = state.records?.[number];
    const head = record?.pushedSha ? record.pushedSha : record?.headSha;
    const stateMatches = kind === 'returned'
      ? [RETURNED.has(record?.state), record?.state !== 'AWAITING_PUSH'].every(Boolean)
      : record?.state === 'FAILED_MANUAL';
    const eligible = [Boolean(record), rescueIds.has(record?.rescueId), stateMatches, Boolean(head)].every(Boolean);
    return eligible ? currentPr(await c.api('GET', `${c.root}/pulls/${number}`), head) : false;
  };
  const prNumbers = item.prs ? item.prs : [];
  const manualNumbers = item.manual ? item.manual : [];
  const [prFreshness, manualFreshness] = await Promise.all([
    Promise.all(prNumbers.map(number => fresh(number, 'returned'))),
    Promise.all(manualNumbers.map(number => fresh(number, 'manual'))),
  ]);
  const prs = prNumbers.filter((_number, index) => prFreshness[index]);
  const manual = manualNumbers.filter((_number, index) => manualFreshness[index]);
  return prs.length
    ? { send: true, prs, manual }
    : { send: false, reason: 'wave-returned-heads-superseded', prs, manual };
}

async function suppressNotification(store, id, reason, liveHead = null) {
  await store.mutate(state => {
    const entry = state.outbox.find(n => n.id === id);
    const mutable = [Boolean(entry), !entry?.sentAt, !entry?.suppressedAt].every(Boolean);
    return mutable ? Object.assign(entry, {
      suppressedAt: new Date().toISOString(),
      channel: 'suppressed-stale',
      suppressionReason: reason,
      nextNotificationAt: null,
      ...(liveHead ? { liveHead } : {}),
    }) : undefined;
  });
}

export async function notifyOutbox(c, store, { url = '', token = '', request = fetch } = {}) {
  const initial = await store.read();
  const due = initial.state.outbox.filter(n => [
    !n.sentAt,
    !n.suppressedAt,
    (n.notificationAttempts ? n.notificationAttempts : 0) < 3,
    n.nextNotificationAt ? Date.parse(n.nextNotificationAt) <= Date.now() : true,
  ].every(Boolean)).slice(0, 5).map(n => n.id);
  for (const id of due) {
    const { state } = await store.read();
    const item = state.outbox.find(n => n.id === id);
    const actionable = [
      Boolean(item),
      !item?.sentAt,
      !item?.suppressedAt,
      (item?.notificationAttempts ? item.notificationAttempts : 0) < 3,
      item?.nextNotificationAt ? Date.parse(item.nextNotificationAt) <= Date.now() : true,
    ].every(Boolean);
    if (!actionable) continue;
    try {
      const legacyFreshness = {
        send: true,
        record: state.records?.[item.pr],
        prs: item.prs ? item.prs : [],
        manual: item.manual ? item.manual : [],
      };
      const freshness = item.type === 'manual' && state.records
        ? await prepareManualNotification(c, state, item)
        : item.type === 'wave' && state.waves
          ? await prepareWaveNotification(c, state, item)
          : legacyFreshness;
      if (!freshness.send) {
        await suppressNotification(store, item.id, freshness.reason, freshness.liveHead);
        continue;
      }
      const record = freshness.record ? freshness.record : state.records?.[item.pr];
      const wave = item.type === 'wave' ? freshness : null;
      const eligibility = item.type === 'manual' ? workRepairEligibility(record) : { eligible: false };
      const aiRepair = Boolean(eligibility.eligible);
      const message = item.type === 'manual' ? aiRepair
        ? `Integration Rescue\nAI_REPAIR_REQUIRED\nPR: #${item.pr}\nstate: FAILED_MANUAL\nattempt: ${item.attempt}/${item.maxAttempts}\nreason: ${item.reason}\nnext action: existing ChatGPT Work repair lane; periodic Work remains fallback`
        : `Integration Rescue\nFAILED\nPR: #${item.pr}\nstate: FAILED_MANUAL\nattempt: ${item.attempt}/${item.maxAttempts}\nreason: ${item.reason}\nnext action: human or approved Work review required`
        : `Integration Rescue\nREADY_FOR_INTEGRATION\nWave: ${item.wave}\nReturned to Integration: ${wave.prs.map(n => '#' + n).join(' ')}\nManual: ${wave.manual.map(n => '#' + n).join(' ') || 'none'}\nCI/browser monitoring: Integration; repair workers ended`;
      if (aiRepair) await signalWorkRepair(c, item, record, message, state);
      if (url) {
        const latest = item.type === 'manual' ? await store.read() : null;
        const recheck = latest?.state?.records ? await prepareManualNotification(c, latest.state, item) : { send: true };
        if (!recheck.send) {
          await suppressNotification(store, item.id, recheck.reason, recheck.liveHead);
          continue;
        }
        if (!url.startsWith('https://')) throw new Error('NTFY_HTTPS_REQUIRED');
        const response = await request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: message, signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`NTFY_FAILED:${response.status}`);
      } else if (item.type === 'manual' && !aiRepair) {
        const marker = `<!-- integration-rescue-notice:${item.id} -->`;
        const comments = await c.pages(`/issues/${item.pr}/comments`, undefined, { maxPages: 3 });
        if (!comments.some(comment => comment.body?.includes(marker))) await c.api('POST', `${c.root}/issues/${item.pr}/comments`, { body: `${marker}\n${message}` });
      }
      await store.mutate(state => {
        const entry = state.outbox.find(n => n.id === item.id);
        if ([Boolean(entry), !entry?.suppressedAt].every(Boolean)) {
          entry.sentAt = new Date().toISOString();
          entry.channel = aiRepair ? 'github-pr+work-signal' : url ? 'ntfy' : item.type === 'manual' ? 'github-pr' : 'pulse-summary';
        }
      });
    } catch (error) {
      await store.mutate(state => {
        const entry = state.outbox.find(n => n.id === item.id);
        if (![Boolean(entry), !entry?.sentAt, !entry?.suppressedAt].every(Boolean)) return;
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
      if (records.some(r => r?.lease || r?.state === 'AWAITING_PUSH' || r?.pushLease || r?.workRepair?.status === 'working')) continue;
      wave.completedAt = new Date(now).toISOString();
      const prs = records.filter(r => r?.returnedAt).map(r => r.pr), manual = records.filter(r => r?.state === 'FAILED_MANUAL').map(r => r.pr);
      wave.returned = prs; wave.manual = manual;
      if (prs.length) state.outbox.push({ id: `${wave.id}:summary`, type: 'wave', wave: wave.id, prs, manual });
    }
    state.outbox = state.outbox.filter(n => {
      const finalizedAt = n.sentAt ? n.sentAt : n.suppressedAt;
      return finalizedAt ? now - Date.parse(finalizedAt) < 86400000 : true;
    }).slice(-100);
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
      const response = await fetch(process.env.NTFY_TOPIC_URL, { method: 'POST', headers: { 'content-type': 'text/plain; charset=utf-8', ...(process.env.NTFY_TOKEN ? { Authorization: `Bearer ${process.env.NTFY_TOKEN}` } : {}) }, body: message, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`NTFY_FAILED:${response.status}`);
    } else console.error(message);
    return;
  }
  const config = rescueConfig(process.env), c = rescueClient(process.env.GH_TOKEN, config), store = new RescueStore(c, config);
  const returned = await finalize(c, store);
  const stacks = process.env.RESCUE_STACK_RECONCILE === 'true' ? await reconcileReadyStacks(c) : [];
  const matrix = stackValidationMatrix(stacks);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `stack_has_work=${matrix.length > 0}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `stack_matrix=${JSON.stringify({ include: matrix })}\n`);
  }
  await notifyOutbox(c, store, { url: process.env.NTFY_TOPIC_URL, token: process.env.NTFY_TOKEN });
  console.log(JSON.stringify({ returned, stackReconciliation: stacks, stackValidation: matrix }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
