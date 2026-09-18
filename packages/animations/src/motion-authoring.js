// Evidence completeness, never an artistic score or permission to merge/deploy.
export const AUTHORING_STAGES = Object.freeze(['blocking', 'primary', 'polish']);
export const AUTHORING_GUIDE = 'docs/characters/MOTION_AUTHORING.md';

export function createAuthoringReview() {
  return {
    version: 1, intent: '',
    source: { before: '', after: '', model: '', rig: '', motions: [], invariants: '' },
    reference: { asset: '', range: null, originalRange: null },
    keyPoses: [],
    stages: Object.fromEntries(AUTHORING_STAGES.map(id => [id, {
      status: 'pending', observation: '', outcome: 'unverified', evidence: []
    }])),
    remaining: [], limitations: []
  };
}

const text = (v, max = 4000) => typeof v === 'string' && v.length <= max;
const filled = v => text(v) && v.trim().length > 0;
const range = v => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && v[0] >= 0 && v[1] > v[0];
const list = (v, max, check) => Array.isArray(v) && v.length <= max && v.every(check);
const demand = (ok, reason) => { if (!ok) throw new Error(`Invalid motion authoring: ${reason}`); };

function validateEvidence(e) {
  demand(e && ['image', 'video'].includes(e.kind) && ['before', 'after', 'reference'].includes(e.role), 'evidence kind/role');
  demand(filled(e.uri) && text(e.uri, 1024) && filled(e.revision) && text(e.revision, 160), 'evidence location/revision');
  demand(filled(e.camera) && text(e.camera, 160) && range(e.range), 'evidence view/time range');
  demand(['webgl', 'cpu-mesh', 'reference'].includes(e.renderer) && typeof e.reviewed === 'boolean', 'evidence renderer/review');
  demand((e.role === 'reference') === (e.renderer === 'reference'), 'reference must be distinguished from real model rendering');
  if (e.kind === 'video') demand(Number.isFinite(e.speed) && e.speed > 0 && e.speed <= 4, 'playback speed');
}

export function validateAuthoringReview(a) {
  demand(a && a.version === 1 && text(a.intent), 'version/intent');
  demand(a.source && ['before', 'after', 'model', 'rig', 'invariants'].every(k => text(a.source[k])), 'source identity');
  demand(list(a.source.motions, 100, v => filled(v) && text(v, 160)), 'existing motion IDs');
  demand(a.reference && text(a.reference.asset, 1024) && (a.reference.range === null || range(a.reference.range)) && (a.reference.originalRange === null || range(a.reference.originalRange)), 'reference range');
  demand(list(a.remaining, 100, v => filled(v)) && list(a.limitations, 100, v => filled(v)), 'remaining differences/limits');
  demand(Array.isArray(a.keyPoses) && a.keyPoses.length <= 100, 'key poses');
  for (const p of a.keyPoses) {
    demand(p && ['label', 'support', 'centerOfMass', 'silhouette'].every(k => filled(p[k])) && Number.isFinite(p.time) && p.time >= 0, 'key pose intent/support/weight/time');
  }
  let priorReviewed = true;
  for (const id of AUTHORING_STAGES) {
    const s = a.stages?.[id];
    demand(s && ['pending', 'revise', 'reviewed'].includes(s.status) && text(s.observation) && ['unverified', 'improved', 'unchanged', 'regressed'].includes(s.outcome), `${id} state`);
    demand(Array.isArray(s.evidence) && s.evidence.length <= 100, `${id} evidence`);
    for (const e of s.evidence) validateEvidence(e);
    if (s.status === 'reviewed') {
      demand(priorReviewed, `${id} requires preceding stages; reopen later stages after a regression`);
      demand(filled(a.intent) && ['before', 'after', 'model', 'rig', 'invariants'].every(k => filled(a.source[k])) && a.source.motions.length > 0 && a.source.before !== a.source.after, 'identify changed shared source and preserved rules');
      demand(filled(a.reference.asset) && range(a.reference.range), 'identify the reference actually reviewed');
      demand(filled(s.observation) && ['improved', 'unchanged'].includes(s.outcome), `${id} requires a supported comparison, not a regression`);
      const evidence = s.evidence.filter(e => e.reviewed);
      for (const e of evidence) {
        demand(e.revision === (e.role === 'reference' ? a.reference.asset : a.source[e.role]), 'stale evidence revision');
        if (e.role === 'reference') demand(e.range[0] >= a.reference.range[0] && e.range[1] <= a.reference.range[1], 'reference evidence outside inspected range');
      }
      if (id === 'blocking') {
        demand(a.keyPoses.length >= 3, 'record the major full-body poses before timing/detail work');
        const views = new Set(evidence.filter(e => e.role === 'after' && e.kind === 'image').map(e => e.camera));
        demand(views.has('front') && (views.has('left') || views.has('right')), 'blocking requires front and side actual-model evidence');
        demand(evidence.some(e => e.role === 'reference'), 'blocking requires observed reference evidence');
      } else {
        for (const role of ['before', 'after', 'reference']) {
          demand(evidence.some(e => e.role === role && e.kind === 'video' && e.speed === 1), `${id} requires reviewed 1x ${role} video; stills/slow playback are insufficient`);
        }
      }
      if (evidence.some(e => e.renderer === 'cpu-mesh')) demand(a.limitations.length > 0, 'state CPU lighting, WebGL and device verification limits');
    }
    priorReviewed = priorReviewed && s.status === 'reviewed';
  }
  return a;
}

export function authoringProgress(authoring) {
  if (authoring === undefined) return { recorded: false, complete: false, nextStage: 'blocking', visualApproval: 'not-assessed' };
  validateAuthoringReview(authoring);
  const nextStage = AUTHORING_STAGES.find(id => authoring.stages[id].status !== 'reviewed') ?? null;
  return { recorded: true, complete: nextStage === null, nextStage, visualApproval: 'not-assessed' };
}
