import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPOSITORY, rescueConfig } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore, comparison } from './integration-rescue-store.mjs';

export async function collectFlowDelivery(c, store, now = Date.now()) {
  const branch = await c.api('GET', `${c.root}/branches/develop`);
  const statuses = await c.pages(`/commits/${branch.commit.sha}/statuses`, undefined, { maxPages: 3 });
  const final = statuses.find(status => status.context === 'integration/develop');
  if (final?.state !== 'success') return { delivered:[], develop:branch.commit.sha, verified:false };
  const { state } = await store.read();
  const entries = Object.values(state.flowControl?.deliveries || {}).filter(item => item.readyAt && item.mergedAt && item.mergeCommit && !item.devAt).slice(0, 20);
  const delivered = [];
  for (const item of entries) {
    const diff = await comparison(c, item.mergeCommit, branch.commit.sha);
    if (['ahead','identical'].includes(diff.status)) delivered.push({ pr:item.pr, mergeCommit:item.mergeCommit });
  }
  if (!delivered.length) return { delivered:[], develop:branch.commit.sha, verified:true };
  await store.mutate(state => {
    state.flowControl ||= {}; state.flowControl.deliveries ||= {};
    for (const item of delivered) {
      const entry = state.flowControl.deliveries[String(item.pr)];
      if (!entry || entry.mergeCommit !== item.mergeCommit || entry.devAt) continue;
      entry.devAt = new Date(now).toISOString(); entry.devCommit = branch.commit.sha; entry.updatedAt = new Date(now).toISOString();
    }
  });
  return { delivered:delivered.map(item=>item.pr), develop:branch.commit.sha, verified:true };
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') throw new Error('FLOW_DELIVERY_TRUSTED_DEVELOP_ONLY');
  const config=rescueConfig(process.env), c=rescueClient(process.env.GH_TOKEN,config), store=new RescueStore(c,config);
  console.log(JSON.stringify(await collectFlowDelivery(c,store)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();