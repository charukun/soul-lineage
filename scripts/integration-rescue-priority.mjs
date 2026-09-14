import { REPOSITORY, STATE_BRANCH, RETURNED } from './integration-rescue-policy.mjs';
import { adaptiveFlowTuning, deliveryLatencyMetrics, dependencyGraph, flowPressure, prioritizeIntegrationTrain, quarantineDecision } from './integration-flow-control.mjs';

const HOUR_MS = 60 * 60 * 1000;
const MAX_AGE_HOURS = 365 * 24;
const CONTROL_PLANE_BOOST_HOURS = 72;
const REPAIR_BOOST_HOURS = 168;
const RETURNED_BOOST_HOURS = 100_000;
const DEPENDENT_BOOST = 30;
const controlBranch = /^(?:fix|feat|chore|perf)\/(?:integration(?:[-/]|$)|rescue(?:[-/]|$))/i;
const controlText = /\b(?:integration rescue|integration throughput|rescue throughput|rescue work|integration control)\b/i;

function decode(file) {
  if (file?.encoding !== 'base64' || !file.content) return null;
  try { return JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8')); }
  catch { return null; }
}
function labelNames(item) { return new Set((item?.labels || []).map(label => typeof label === 'string' ? label : label?.name).filter(Boolean)); }
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
export function readyPriorityScore(item, returnedHeads, now = Date.now(), graph = null) {
  const labels = labelNames(item), returned = returnedHeads.get(item?.number) === item?.head?.sha, ageHours = readyAgeHours(item, now);
  const control = isIntegrationControlPlane(item), repair = labels.has('integration:repair'), dependents = graph?.unblockCount?.get(Number(item?.number)) || 0;
  const quarantined = returnedHeads.quarantine?.has(Number(item?.number)) || false;
  return { returned, control, repair, ageHours, dependents, quarantined,
    score: ageHours + dependents * DEPENDENT_BOOST + (control ? CONTROL_PLANE_BOOST_HOURS : 0) + (repair ? REPAIR_BOOST_HOURS : 0) +
      (returned ? RETURNED_BOOST_HOURS : 0) - (quarantined && !repair && !returned ? 100_000 : 0) };
}

export async function returnedPriorityHeads(c) {
  const result = new Map();
  result.scopeByPr = new Map(); result.quarantine = new Set(); result.latency = deliveryLatencyMetrics([]); result.provenTrain = null;
  try {
    const file = await c.api('GET', `${c.root}/contents/rescue-state.json?ref=${encodeURIComponent(STATE_BRANCH)}`, null, { cache: true });
    const state = decode(file);
    if (!state || state.repository !== REPOSITORY) return result;
    const records = Object.values(state.records || {});
    result.latency = deliveryLatencyMetrics(records);
    for (const record of records) {
      if (record.scope?.files?.length) result.scopeByPr.set(record.pr, record.scope);
      if (RETURNED.has(record.state) && record.state !== 'AWAITING_PUSH' && record.returnedAt) result.set(record.pr, record.pushedSha || record.headSha);
      if (quarantineDecision(record).quarantined) result.quarantine.add(Number(record.pr));
    }
    const proof = state.flowControl?.trainProof;
    if (proof?.status === 'validated' && Array.isArray(proof.candidates) && proof.candidates.length >= 2) {
      const develop = (await c.api('GET', `${c.root}/branches/develop`, null, { cache:true })).commit.sha;
      if (proof.base === develop) result.provenTrain = proof;
    }
    return result;
  } catch { return result; }
}

export function prioritizeReturnedReady(items, returnedHeads, now = Date.now()) {
  const graph = dependencyGraph(items), pressure = flowPressure({ ready: items.length });
  const tuning = adaptiveFlowTuning({ ready: items.length, latency: returnedHeads.latency });
  const sorted = [...items].sort((a, b) => {
    const pa = readyPriorityScore(a, returnedHeads, now, graph), pb = readyPriorityScore(b, returnedHeads, now, graph);
    if (pa.score !== pb.score) return pb.score - pa.score;
    const aCreated = Date.parse(a?.created_at || a?.updated_at || '') || 0, bCreated = Date.parse(b?.created_at || b?.updated_at || '') || 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return Number(a?.number || 0) - Number(b?.number || 0);
  });
  const pinned = sorted.filter(item => { const score = readyPriorityScore(item, returnedHeads, now, graph); return score.returned || score.repair; });
  const pinnedIds = new Set(pinned.map(item => item.number));
  const byNumber = new Map(sorted.map(item => [Number(item.number), item]));
  const proven = (returnedHeads.provenTrain?.candidates || []).map(entry => byNumber.get(Number(entry.pr)))
    .filter(item => item && !pinnedIds.has(item.number) && !returnedHeads.quarantine?.has(Number(item.number)))
    .filter(item => returnedHeads.provenTrain.candidates.some(entry => Number(entry.pr) === Number(item.number) && entry.head === item.head?.sha));
  const provenIds = new Set(proven.map(item => item.number));
  const ordinary = sorted.filter(item => !pinnedIds.has(item.number) && !provenIds.has(item.number) && !returnedHeads.quarantine?.has(Number(item.number)));
  const quarantined = sorted.filter(item => !pinnedIds.has(item.number) && returnedHeads.quarantine?.has(Number(item.number)));
  const trained = pressure.mode === 'NORMAL' ? ordinary : prioritizeIntegrationTrain(ordinary, returnedHeads.scopeByPr || new Map(), { max:tuning.trainSize });
  const result = [...pinned, ...proven, ...trained, ...quarantined];
  result.flowControl = { ...pressure, ...tuning, provenTrain:proven.map(item=>item.number), train:trained.slice(0,tuning.trainSize).map(item=>item.number),
    quarantined:quarantined.map(item=>item.number), criticalPath:[...graph.unblockCount.entries()].filter(([,count])=>count>0).sort((a,b)=>b[1]-a[1]).slice(0,8) };
  return result;
}