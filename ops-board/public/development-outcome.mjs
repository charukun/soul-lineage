const IMPLEMENTATION_REPAIR_STAGES = new Set(['CI_FAILED']);
const EXPLICIT_BLOCK_STAGES = new Set(['HOLD']);

const queueByNumber = queue => new Map((Array.isArray(queue) ? queue : [])
  .filter(item => Number.isFinite(Number(item?.number)))
  .map(item => [Number(item.number), item]));

export function developmentOutcomeForPull(pull, integrationQueue = []) {
  if (!pull || !['Draft', 'Ready'].includes(pull.state)) return null;
  if (pull.state === 'Draft') return 'WORKING';

  const item = queueByNumber(integrationQueue).get(Number(pull.number));
  if (EXPLICIT_BLOCK_STAGES.has(item?.stage)) return 'BLOCKED';
  if (IMPLEMENTATION_REPAIR_STAGES.has(item?.stage)) return 'WORKING';
  return 'READY';
}

export function developmentOutcomeSummary(state = {}) {
  const pulls = Array.isArray(state?.pullRequests?.normal) ? state.pullRequests.normal : [];
  const queue = Array.isArray(state?.integration?.queue) ? state.integration.queue : [];
  const counts = { WORKING: 0, READY: 0, BLOCKED: 0 };
  for (const pull of pulls) {
    const outcome = developmentOutcomeForPull(pull, queue);
    if (outcome) counts[outcome] += 1;
  }

  const total = counts.WORKING + counts.READY + counts.BLOCKED;
  const headline = counts.BLOCKED ? `BLOCKED ${counts.BLOCKED}`
    : counts.WORKING ? `WORKING ${counts.WORKING}`
      : counts.READY ? `READY ${counts.READY}`
        : 'タスクなし';
  const tone = counts.BLOCKED ? 'danger' : counts.WORKING ? 'progress' : counts.READY ? 'warning' : 'ok';
  const detail = `WORKING ${counts.WORKING} / READY ${counts.READY} / BLOCKED ${counts.BLOCKED}`;
  return { counts, total, headline, tone, detail };
}
