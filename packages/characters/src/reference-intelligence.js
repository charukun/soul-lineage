import { CHARACTER_REFERENCE_MODELS } from './reference-models.js';
import { CHARACTER_REFERENCE_ARCHETYPES } from './reference-archetypes.js';
import { evaluateCharacterProduction } from './production-pipeline.js';
import {
  CHARACTER_PRESENTATION_AGE_BANDS,
  CHARACTER_PRESENTATION_APPS
} from './presentation-resolver.js';
import { deepFreeze, identifier, invariant } from './master-character.js';

export const CHARACTER_REFERENCE_INTELLIGENCE_VERSION = 1;
export const CHARACTER_EXTERNAL_REFERENCE_VERSION = 1;
export const CHARACTER_GOLDEN_BASELINE_VERSION = 1;

const APP_IDS = new Set(CHARACTER_PRESENTATION_APPS);
const AGE_BAND_IDS = new Set(CHARACTER_PRESENTATION_AGE_BANDS);
const RENDER_TIER_IDS = new Set(['full', 'mid', 'far']);
const EXTERNAL_REFERENCE_KINDS = new Set(['character-source', 'character-reference', 'runtime-technique']);
const ADOPTION_POLICIES = new Set(['source-audit', 'reference-only', 'technique-only']);
const SHA40 = /^[0-9a-f]{40}$/i;
const GITHUB_REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;
const OBSERVATION_ID = /^[a-z0-9][a-z0-9._:-]{1,95}$/;

function nonEmptyString(value, name) {
  invariant(typeof value === 'string' && value.trim().length > 0, `Invalid ${name}`);
  return value.trim();
}

function stringList(value, name, { min = 0, pattern = null } = {}) {
  invariant(Array.isArray(value) && value.length >= min, `Invalid ${name}`);
  const rows = value.map(item => nonEmptyString(item, name));
  invariant(new Set(rows).size === rows.length, `Duplicate ${name}`);
  if (pattern) invariant(rows.every(item => pattern.test(item)), `Invalid ${name}`);
  return rows;
}

function repositoryEvidencePath(value) {
  const path = nonEmptyString(value, 'reference evidence path');
  invariant(!path.startsWith('/') && !path.includes('..') && !/^https?:/i.test(path), 'Evidence must be a repository-relative path');
  return path;
}

export function defineExternalCharacterReference(input) {
  invariant(input && typeof input === 'object' && !Array.isArray(input), 'Invalid external character reference');
  const id = identifier(input.id, 'external character reference id');
  invariant(EXTERNAL_REFERENCE_KINDS.has(input.kind), `Unknown external reference kind: ${input.kind}`);
  const repository = nonEmptyString(input.repository, 'external reference repository').replace(/\/$/, '');
  invariant(GITHUB_REPOSITORY.test(repository), 'External reference repository must be a public GitHub repository URL');
  invariant(SHA40.test(input.revision || ''), 'External reference revision must be a full commit SHA');
  const license = nonEmptyString(input.license, 'external reference license');
  invariant(ADOPTION_POLICIES.has(input.adoptionPolicy), `Unknown external reference adoption policy: ${input.adoptionPolicy}`);
  const evidence = stringList(input.evidence, 'external reference evidence', { min: 1 }).map(repositoryEvidencePath);
  const observations = stringList(input.observations, 'external reference observation', { min: 1, pattern: OBSERVATION_ID });
  const licenseUrl = input.licenseUrl == null ? null : nonEmptyString(input.licenseUrl, 'external reference license URL');
  if (licenseUrl) invariant(/^https:\/\//.test(licenseUrl), 'External reference license URL must use HTTPS');

  return deepFreeze({
    schema: 'external-character-reference',
    version: CHARACTER_EXTERNAL_REFERENCE_VERSION,
    id,
    kind: input.kind,
    repository,
    revision: input.revision.toLowerCase(),
    sourceKey: `${repository}@${input.revision.toLowerCase()}`,
    license,
    licenseUrl,
    adoptionPolicy: input.adoptionPolicy,
    evidence,
    observations,
    copyPolicy: 'never-wholesale-copy'
  });
}

const externalReferences = [
  defineExternalCharacterReference({
    id: 'sendagaya-shino-yui',
    kind: 'character-source',
    repository: 'https://github.com/yw0nam/YUI',
    revision: '9bce6c36d28f58693db3ce6f4203871ab1c11b76',
    license: 'CC0-1.0 source / VRM-Public-License-1.0 conversion',
    licenseUrl: 'https://vrm.dev/licenses/1.0/',
    adoptionPolicy: 'source-audit',
    evidence: ['resources/vrms/Sendagaya_Shino.vrm'],
    observations: ['stylized-humanoid', 'vrm-humanoid', 'auditable-character-source']
  }),
  defineExternalCharacterReference({
    id: 'vroid-sample-a-voxavatar',
    kind: 'character-reference',
    repository: 'https://github.com/SanHsien/voxavatar',
    revision: '448e505e2ce7d436660c339ddb4b5b908f471bbe',
    license: 'VRoid sample model terms',
    licenseUrl: 'https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z',
    adoptionPolicy: 'reference-only',
    evidence: ['public/assets/models/AvatarSample_A.vrm'],
    observations: ['stylized-humanoid', 'vrm-humanoid', 'multi-material-avatar']
  }),
  defineExternalCharacterReference({
    id: 'vroid-sample-b-voxavatar',
    kind: 'character-reference',
    repository: 'https://github.com/SanHsien/voxavatar',
    revision: '448e505e2ce7d436660c339ddb4b5b908f471bbe',
    license: 'VRoid sample model terms',
    licenseUrl: 'https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z',
    adoptionPolicy: 'reference-only',
    evidence: ['public/assets/models/AvatarSample_B.vrm'],
    observations: ['stylized-humanoid', 'vrm-humanoid', 'multi-material-avatar']
  }),
  defineExternalCharacterReference({
    id: 'pixiv-three-vrm-runtime',
    kind: 'runtime-technique',
    repository: 'https://github.com/pixiv/three-vrm',
    revision: '1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7',
    license: 'MIT',
    licenseUrl: 'https://github.com/pixiv/three-vrm/blob/1b4fc0cc7ef39a49d62bb7a66dcfeca8f65316f7/LICENSE',
    adoptionPolicy: 'technique-only',
    evidence: ['packages/three-vrm/README.md'],
    observations: ['vrm-humanoid', 'threejs-vrm-runtime']
  })
];

export const EXTERNAL_CHARACTER_REFERENCE_REGISTRY = deepFreeze(Object.fromEntries(externalReferences.map(row => [row.id, row])));

export const CHARACTER_REFERENCE_EXTERNAL_LINKS = deepFreeze({
  'shino.reference.v2': ['sendagaya-shino-yui']
});

export function getExternalCharacterReference(id) {
  const reference = EXTERNAL_CHARACTER_REFERENCE_REGISTRY[id];
  invariant(reference, `Unknown external character reference: ${id}`);
  return reference;
}

export function evaluateExternalReferenceConsensus(referenceIds, observation, { minimumIndependentSources = 2 } = {}) {
  const ids = stringList(referenceIds, 'reference id');
  const observed = nonEmptyString(observation, 'reference observation');
  invariant(OBSERVATION_ID.test(observed), 'Invalid reference observation');
  invariant(Number.isInteger(minimumIndependentSources) && minimumIndependentSources >= 2, 'minimumIndependentSources must be >= 2');
  const references = ids.map(getExternalCharacterReference);
  const independent = new Map();
  for (const reference of references) {
    if (reference.observations.includes(observed)) independent.set(reference.sourceKey, reference.id);
  }
  const supportingReferenceIds = [...independent.values()].sort();
  return deepFreeze({
    observation: observed,
    status: supportingReferenceIds.length >= minimumIndependentSources ? 'consensus' : 'insufficient',
    minimumIndependentSources,
    independentSourceCount: supportingReferenceIds.length,
    supportingReferenceIds
  });
}

export function externalReferenceConsensusSet(referenceIds, { minimumIndependentSources = 2 } = {}) {
  const references = stringList(referenceIds, 'reference id').map(getExternalCharacterReference);
  const observations = [...new Set(references.flatMap(reference => reference.observations))].sort();
  return Object.freeze(observations
    .map(observation => evaluateExternalReferenceConsensus(referenceIds, observation, { minimumIndependentSources }))
    .filter(row => row.status === 'consensus'));
}

function normalizeTarget(target) {
  invariant(target && typeof target === 'object' && !Array.isArray(target), 'Invalid character coverage target');
  invariant(APP_IDS.has(target.app), `Unknown coverage app: ${target.app}`);
  invariant(AGE_BAND_IDS.has(target.ageBand), `Unknown coverage age band: ${target.ageBand}`);
  const bodyArchetype = identifier(target.bodyArchetype, 'coverage body archetype');
  const role = identifier(target.role, 'coverage role');
  invariant(RENDER_TIER_IDS.has(target.renderTier), `Unknown coverage render tier: ${target.renderTier}`);
  const externalReferenceIds = target.externalReferenceIds == null ? [] : stringList(target.externalReferenceIds, 'external reference id');
  externalReferenceIds.forEach(getExternalCharacterReference);
  return Object.freeze({ app: target.app, ageBand: target.ageBand, bodyArchetype, role, renderTier: target.renderTier, externalReferenceIds });
}

export function characterCoverageTargetId(target) {
  const row = normalizeTarget(target);
  return `${row.app}:${row.ageBand}:${row.bodyArchetype}:${row.role}:${row.renderTier}`;
}

function ageBandForAge(age) {
  if (age < 18) return 'child';
  if (age < 65) return 'adult';
  return 'elder';
}

function localReferenceDescriptors() {
  const rows = Object.values(CHARACTER_REFERENCE_ARCHETYPES).map(reference => {
    const ageBand = ageBandForAge(reference.age);
    return deepFreeze({
      id: reference.id,
      ageBand,
      bodyArchetype: `${ageBand}.${reference.profile.body}`,
      role: reference.role,
      apps: reference.contexts.filter(context => APP_IDS.has(context)),
      externalReferenceIds: []
    });
  });
  const shino = CHARACTER_REFERENCE_MODELS['shino.reference.v2'];
  if (shino) rows.push(deepFreeze({
    id: shino.id,
    ageBand: shino.ageBand,
    bodyArchetype: `${shino.ageBand}.${shino.parts.body}`,
    role: shino.role,
    apps: ['rinne'],
    externalReferenceIds: CHARACTER_REFERENCE_EXTERNAL_LINKS[shino.id] || []
  }));
  return rows;
}

const LOCAL_REFERENCE_DESCRIPTORS = Object.freeze(localReferenceDescriptors());

function localReferencesForTarget(target) {
  return LOCAL_REFERENCE_DESCRIPTORS.filter(reference =>
    reference.apps.includes(target.app) && reference.ageBand === target.ageBand &&
    reference.role === target.role && reference.bodyArchetype === target.bodyArchetype);
}

function explicitPresentationSelector(candidate) {
  const selector = candidate?.presentation || candidate;
  if (!selector || typeof selector !== 'object' || Array.isArray(selector)) return null;
  const fields = ['apps', 'ageBands', 'bodyArchetypes', 'roles', 'renderTiers'];
  if (!fields.every(name => Array.isArray(selector[name]) && selector[name].length > 0)) return null;
  return selector;
}

function selectorMatches(candidate, target) {
  const selector = explicitPresentationSelector(candidate);
  return !!selector && selector.apps.includes(target.app) && selector.ageBands.includes(target.ageBand) &&
    selector.bodyArchetypes.includes(target.bodyArchetype) && selector.roles.includes(target.role) &&
    selector.renderTiers.includes(target.renderTier);
}

function productionRecord(candidate, target) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const manifest = candidate.manifest || (candidate.schema === 'character-production' ? candidate : null);
  if (!manifest || !selectorMatches(candidate, target)) return null;
  try {
    const declared = evaluateCharacterProduction(manifest, manifest.stage);
    const runtimeReady = evaluateCharacterProduction(manifest, 'RUNTIME_READY');
    return deepFreeze({
      id: manifest.id,
      stage: manifest.stage,
      highestEligibleStage: declared.highestEligibleStage,
      productionReady: runtimeReady.productionReady
    });
  } catch {
    return null;
  }
}

function goldenMatches(golden, target) {
  return golden?.schema === 'character-golden-baseline' && golden.version === CHARACTER_GOLDEN_BASELINE_VERSION &&
    golden.target.app === target.app && golden.target.ageBand === target.ageBand &&
    golden.target.bodyArchetype === target.bodyArchetype && golden.target.role === target.role &&
    golden.target.renderTier === target.renderTier;
}

export function createCharacterGoldenBaseline({ id, target, manifest }) {
  const goldenId = identifier(id, 'golden baseline id');
  const normalizedTarget = normalizeTarget(target);
  const evaluation = evaluateCharacterProduction(manifest, 'RUNTIME_READY');
  invariant(evaluation.productionReady, 'Golden baseline requires a RUNTIME_READY production manifest');
  invariant(manifest.evidence?.polish?.visualApproval === 'approved', 'Golden baseline requires explicit visual approval');
  const runtime = manifest.evidence.runtime;
  return deepFreeze({
    schema: 'character-golden-baseline',
    version: CHARACTER_GOLDEN_BASELINE_VERSION,
    id: goldenId,
    assetId: manifest.id,
    assetHash: runtime.assetHash,
    target: normalizedTarget,
    metrics: {
      triangles: runtime.triangles,
      drawCalls: runtime.drawCalls,
      textureMemoryBytes: runtime.textureMemoryBytes,
      desktopP95Ms: runtime.desktopP95Ms,
      mobileP95Ms: runtime.mobileP95Ms
    },
    visualApproval: 'approved',
    productionStage: 'RUNTIME_READY'
  });
}

const GOLDEN_METRICS = Object.freeze(['triangles', 'drawCalls', 'textureMemoryBytes', 'desktopP95Ms', 'mobileP95Ms']);

export function compareCharacterRuntimeToGolden(runtime, golden) {
  invariant(golden?.schema === 'character-golden-baseline' && golden.version === CHARACTER_GOLDEN_BASELINE_VERSION, 'Invalid golden baseline');
  invariant(runtime && typeof runtime === 'object' && !Array.isArray(runtime), 'Invalid runtime evidence');
  const comparisons = GOLDEN_METRICS.map(metric => {
    const baseline = golden.metrics[metric], candidate = runtime[metric];
    const measured = Number.isFinite(candidate) && candidate >= 0 && Number.isFinite(baseline) && baseline >= 0;
    return deepFreeze({
      metric,
      status: measured ? 'measured' : 'unavailable',
      baseline: measured ? baseline : null,
      candidate: measured ? candidate : null,
      delta: measured ? candidate - baseline : null,
      ratio: measured && baseline > 0 ? candidate / baseline : null
    });
  });
  return deepFreeze({
    schema: 'character-golden-comparison',
    version: 1,
    goldenId: golden.id,
    assetId: golden.assetId,
    result: comparisons.every(row => row.status === 'measured') ? 'complete' : 'partial',
    comparisons,
    visualApprovalRequired: true
  });
}

export function defaultCharacterCoverageTargets({ apps = CHARACTER_PRESENTATION_APPS, renderTiers = ['full', 'mid', 'far'] } = {}) {
  invariant(Array.isArray(apps) && apps.length > 0 && apps.every(app => APP_IDS.has(app)), 'Invalid coverage apps');
  invariant(Array.isArray(renderTiers) && renderTiers.length > 0 && renderTiers.every(tier => RENDER_TIER_IDS.has(tier)), 'Invalid coverage render tiers');
  const allowedApps = new Set(apps);
  const targets = [];
  const seen = new Set();
  for (const reference of LOCAL_REFERENCE_DESCRIPTORS) {
    for (const app of reference.apps.filter(item => allowedApps.has(item))) for (const renderTier of renderTiers) {
      const target = normalizeTarget({
        app,
        renderTier,
        ageBand: reference.ageBand,
        bodyArchetype: reference.bodyArchetype,
        role: reference.role,
        externalReferenceIds: reference.externalReferenceIds
      });
      const id = characterCoverageTargetId(target);
      if (!seen.has(id)) { seen.add(id); targets.push(target); }
    }
  }
  return Object.freeze(targets);
}

export function buildCharacterCoverageMatrix(targets, {
  productionAssets = [],
  goldenBaselines = []
} = {}) {
  invariant(Array.isArray(targets), 'Character coverage targets must be an array');
  invariant(Array.isArray(productionAssets), 'Production assets must be an array');
  invariant(Array.isArray(goldenBaselines), 'Golden baselines must be an array');
  const rows = targets.map(normalizeTarget).map(target => {
    const localReferences = localReferencesForTarget(target);
    const linkedExternalIds = new Set(target.externalReferenceIds);
    for (const reference of localReferences) {
      for (const id of reference.externalReferenceIds) linkedExternalIds.add(id);
    }
    const externalReferences = [...linkedExternalIds].map(getExternalCharacterReference);
    const production = productionAssets.map(candidate => productionRecord(candidate, target)).filter(Boolean);
    const golden = goldenBaselines.filter(item => goldenMatches(item, target));
    const ready = production.some(item => item.productionReady);
    const hasReference = localReferences.length > 0 || externalReferences.length > 0;
    const status = golden.length ? 'golden' : ready ? 'runtime-ready' : production.length ? 'in-production' : hasReference ? 'reference-only' : 'missing';
    const nextAction = !hasReference ? 'collect-reference' : !production.length ? 'author-production-asset' : !ready ? 'advance-production-stage' : !golden.length ? 'capture-golden-baseline' : 'monitor';
    return deepFreeze({
      id: characterCoverageTargetId(target),
      target,
      status,
      nextAction,
      references: {
        local: localReferences.map(item => item.id).sort(),
        external: externalReferences.map(item => item.id).sort()
      },
      production,
      golden: golden.map(item => item.id).sort()
    });
  });
  const summary = Object.freeze(Object.fromEntries(['missing', 'reference-only', 'in-production', 'runtime-ready', 'golden']
    .map(status => [status, rows.filter(row => row.status === status).length])));
  return deepFreeze({
    schema: 'character-coverage-matrix',
    version: CHARACTER_REFERENCE_INTELLIGENCE_VERSION,
    rows,
    summary
  });
}
