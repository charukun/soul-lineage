import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { quarantineDecision } from './integration-flow-control.mjs';
import { REPOSITORY, rescueConfig } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore } from './integration-rescue-store.mjs';

export async function signalQuarantine(c, store, { limit = 4 } = {}) {
  const { state } = await store.read();
  const candidates = Object.values(state.records || {}).filter(record => quarantineDecision(record).quarantined && record.headSha).slice(0, limit);
  const signaled = [];
  for (const record of candidates) {
    const pr = await c.api('GET', `${c.root}/pulls/${record.pr}`);
    if (pr.state !== 'open' || pr.draft || pr.head?.sha !== record.headSha || pr.head?.repo?.full_name !== REPOSITORY || pr.base?.ref !== 'develop') continue;
    const marker = `<!-- integration-quarantine:${record.headSha} -->`;
    const comments = await c.pages(`/issues/${record.pr}/comments`, undefined, { maxPages: 3 });
    if (!comments.some(comment => comment.body?.includes(marker))) {
      const reasons = (record.failures || []).slice(-3).map(item => item.reason).filter(Boolean).join('\n- ');
      await c.api('POST', `${c.root}/issues/${record.pr}/comments`, { body: `${marker}\nAI_DEEP_REPAIR_REQUIRED\n\nRepeated independent repair failures moved this exact head out of the normal Integration train.\n\nRecent failures:\n- ${reasons || record.failureReason || 'unknown'}\n\nUse the existing ChatGPT Work repair lane to re-read current develop, governing specs, prior evidence and browser/CI artifacts. Do not bypass review/hold/product-decision gates. A new head is re-evaluated from scratch; the periodic Rescue Work remains the fallback.` });
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
