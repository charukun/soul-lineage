import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { quarantineDecision } from './integration-flow-control.mjs';
import { REPOSITORY, rescueConfig } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore } from './integration-rescue-store.mjs';
import { workRepairClass } from './integration-rescue-work-repair-policy.mjs';
import { aiRepairEnvelope, aiRepairEnvelopeMarker } from './integration-ai-repair-envelope.mjs';

export async function signalQuarantine(c, store, { limit = 4 } = {}) {
  const { state } = await store.read();
  const candidates = Object.values(state.records || {}).filter(record => quarantineDecision(record).quarantined && record.headSha).slice(0, limit);
  const signaled = [];
  const develop = candidates.length ? (await c.api('GET', `${c.root}/branches/develop`)).commit.sha : null;
  for (const record of candidates) {
    const pr = await c.api('GET', `${c.root}/pulls/${record.pr}`);
    if (pr.state !== 'open' || pr.draft || pr.head?.sha !== record.headSha || pr.head?.repo?.full_name !== REPOSITORY || pr.base?.ref !== 'develop') continue;
    const marker = `<!-- integration-quarantine:${record.headSha} -->`;
    const comments = await c.pages(`/issues/${record.pr}/comments`, undefined, { maxPages: 3 });
    if (!comments.some(comment => comment.body?.includes(marker))) {
      const recent = (record.failures || []).slice(-3).map(item => item.reason).filter(Boolean);
      const reason = recent.at(-1) || record.failureReason || 'repeated repair failures';
      const envelope = aiRepairEnvelope({
        pr: record.pr,
        branch: record.branch || pr.head.ref,
        head: record.headSha,
        develop,
        repairKind: workRepairClass(record) || 'deep',
        reason,
        attempt: Number(record.workRepairAttempts || record.attempt || 0),
        maxAttempts: Number(record.workRepair?.maxAttempts || record.maxAttempts || 0),
        source: 'integration-quarantine',
        deep: true,
      });
      await c.api('POST', `${c.root}/issues/${record.pr}/comments`, { body: `${marker}\n${aiRepairEnvelopeMarker(envelope)}\nAI_DEEP_REPAIR_REQUIRED\n\nRepeated independent repair failures moved this exact head out of the normal Integration train.\n\nRecent failures:\n- ${recent.join('\n- ') || record.failureReason || 'unknown'}\n\nUse the existing ChatGPT Work repair lane to re-read current develop, governing specs, prior evidence and browser/CI artifacts. The envelope is a bounded snapshot, not authority. Do not bypass review/hold/product-decision gates. A new head is re-evaluated from scratch; the periodic Rescue Work remains the fallback.` });
    }
    await c.api('POST', `${c.root}/statuses/${record.headSha}`, { state: 'pending', context: 'integration/quarantine', description: 'AI deep repair requested; normal Integration train isolated', target_url: pr.html_url });
    signaled.push(record.pr);
  }
  return signaled;
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') throw new Error('QUARANTINE_SIGNAL_TRUSTED_DEVELOP_ONLY');
  const config = rescueConfig(process.env), c = rescueClient(process.env.GH_TOKEN, config), store = new RescueStore(c, config);
  console.log(JSON.stringify({ signaled: await signalQuarantine(c, store) }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
