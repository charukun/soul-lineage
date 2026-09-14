import { REPOSITORY, STATE_BRANCH, RETURNED } from './integration-rescue-policy.mjs';

const HOUR_MS = 60 * 60 * 1000;
const MAX_AGE_HOURS = 365 * 24;
const CONTROL_PLANE_BOOST_HOURS = 72;
const REPAIR_BOOST_HOURS = 168;
const RETURNED_BOOST_HOURS = 100_000;
const controlBranch = /^(?:fix|feat|chore|perf)\/(?:integration(?:[-/]|$)|rescue(?:[-/]|$))/i;
const controlText = /\b(?:integration rescue|integration throughput|rescue throughput|rescue work|integration control)\b/i;

function decode(file) {
  if (file?.encoding !== 'base64' || !file.content) return null;
  try { return JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8')); }
  catch { return null; }
}

function labelNames(item) {
  return new Set((item?.labels || []).map(label => typeof label === 'string' ? label : label?.name).filter(Boolean));
}

export function readyAgeHours(item, now = Date.now()) {
  const created = Date.parse(item?.created_at || item?.updated_at || '');
  if (!Number.isFinite(created) || now <= created) return 0;
  return Math.min(MAX_AGE_HOURS, Math.floor((now - created) / HOUR_MS));
}

export function isIntegrationControlPlane(item) {
  const labels = labelNames(item);
  if (labels.has('integration:control') || labels.has('integration:repair')) return true;
  if (controlBranch.test(item?.head?.ref || '')) return true;
  return controlText.test(`${item?.title || ''}\n${item?.body || ''}`);
}

export function readyPriorityScore(item, returnedHeads, now = Date.now()) {
  const labels = labelNames(item);
  const returned = returnedHeads.get(item?.number) === item?.head?.sha;
  const ageHours = readyAgeHours(item, now);
  const control = isIntegrationControlPlane(item);
  const repair = labels.has('integration:repair');
  return {
    returned,
    control,
    repair,
    ageHours,
    score: ageHours +
      (control ? CONTROL_PLANE_BOOST_HOURS : 0) +
      (repair ? REPAIR_BOOST_HOURS : 0) +
      (returned ? RETURNED_BOOST_HOURS : 0),
  };
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

export function prioritizeReturnedReady(items, returnedHeads, now = Date.now()) {
  return [...items].sort((a, b) => {
    const pa = readyPriorityScore(a, returnedHeads, now);
    const pb = readyPriorityScore(b, returnedHeads, now);
    if (pa.score !== pb.score) return pb.score - pa.score;
    const aCreated = Date.parse(a?.created_at || a?.updated_at || '') || 0;
    const bCreated = Date.parse(b?.created_at || b?.updated_at || '') || 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return Number(a?.number || 0) - Number(b?.number || 0);
  });
}
