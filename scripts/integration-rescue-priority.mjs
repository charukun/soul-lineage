import { REPOSITORY, STATE_BRANCH, RETURNED } from './integration-rescue-policy.mjs';

function decode(file) {
  if (file?.encoding !== 'base64' || !file.content) return null;
  try { return JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8')); }
  catch { return null; }
}

export async function returnedPriorityHeads(c) {
  try {
    const file = await c.api('GET', `${c.root}/contents/rescue-state.json?ref=${encodeURIComponent(STATE_BRANCH)}`, null, { cache: true });
    const state = decode(file);
    if (!state || state.repository !== REPOSITORY) return new Map();
    return new Map(Object.values(state.records || {})
      .filter(record => RETURNED.has(record.state) && record.state !== 'AWAITING_PUSH' && record.returnedAt)
      .map(record => [record.pr, record.pushedSha || record.headSha]));
  } catch {
    // Rescue priority is an optimization only. Integration safety and availability
    // must not depend on the state branch being readable at this instant.
    return new Map();
  }
}

export function prioritizeReturnedReady(items, returnedHeads) {
  return [...items].sort((a, b) => {
    const aPriority = returnedHeads.get(a.number) === a.head?.sha ? 1 : 0;
    const bPriority = returnedHeads.get(b.number) === b.head?.sha ? 1 : 0;
    return bPriority - aPriority;
  });
}
