import { deepFreeze, invariant } from './master-character.js';
import { characterReferenceModel } from './reference-models.js';
import { createCharacterRefinementPolicy, validateCharacterRefinementPolicy } from './refinement-policy.js';

export const CHARACTER_MODEL_BUILD_REQUEST_VERSION = 1;
export const CHARACTER_MODEL_CANDIDATE_VERSION = 1;
export const CHARACTER_MODEL_DISTRIBUTION_VERSION = 1;

export const CHARACTER_MODEL_REQUIRED_GATES = Object.freeze([
  'provenance',
  'identity',
  'silhouette',
  'topology',
  'rig',
  'materials',
  'clipping',
  'motion',
  'performance'
]);

export const CHARACTER_MODEL_DISTRIBUTION_TARGETS = Object.freeze(['rinne', 'village', 'demon']);

const BUILD_STATUSES = new Set(['pending', 'needs-review', 'accepted', 'rejected']);
const GATE_STATUSES = new Set(['pending', 'pass', 'fail']);
const SHA256 = /^[a-f0-9]{64}$/i;

function plainObject(value, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `Invalid ${label}`);
  return value;
}

function stringValue(value, label, max = 160) {
  invariant(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `Invalid ${label}`);
  return value.trim();
}

function stringList(value, label) {
  invariant(Array.isArray(value), `Invalid ${label}`);
  const rows = value.map((item, index) => stringValue(item, `${label}[${index}]`));
  invariant(new Set(rows).size === rows.length, `Duplicate ${label}`);
  return rows;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function productionContract(reference) {
  const production = plainObject(reference.production, 'reference production contract');
  const authority = plainObject(production.authority, 'reference authority');
  const target = plainObject(production.target, 'reference target');
  const requirements = plainObject(production.requirements, 'reference requirements');
  const formats = stringList(target.formats, 'target formats');
  invariant(formats.length > 0, 'At least one target format is required');
  invariant(formats.includes(target.primaryFormat), 'Primary format must be in target formats');
  return {
    sourceSections: stringList(production.sourceSections, 'source sections'),
    authority: {
      currentMaster: stringList(authority.currentMaster, 'current master authority'),
      implementedModularParts: stringList(authority.implementedModularParts, 'implemented modular parts'),
      proposedParts: stringList(authority.proposedParts, 'proposed parts'),
      gameEquipment: stringList(authority.gameEquipment, 'game equipment')
    },
    target: {
      ...clone(target),
      formats
    },
    requirements: clone(requirements)
  };
}

/**
 * Convert one repository character reference into a provider-neutral build request.
 * The request describes what may be generated; it does not approve or adopt an asset.
 */
export function createCharacterModelBuildRequest(referenceId, options = {}) {
  const reference = characterReferenceModel(referenceId);
  const production = productionContract(reference);
  const provider = options.provider == null ? 'unassigned' : stringValue(options.provider, 'provider');
  const requestedBy = options.requestedBy == null ? 'character-workshop' : stringValue(options.requestedBy, 'requestedBy');
  const targets = options.distributionTargets == null
    ? [...CHARACTER_MODEL_DISTRIBUTION_TARGETS]
    : stringList(options.distributionTargets, 'distribution targets');

  const request = {
    version: CHARACTER_MODEL_BUILD_REQUEST_VERSION,
    kind: 'character-model-build-request',
    id: `request.${reference.id}`,
    requestedBy,
    provider: {
      id: provider,
      mode: provider === 'unassigned' ? 'adapter-required' : 'external-adapter'
    },
    reference: {
      id: reference.id,
      label: reference.label,
      characterId: reference.characterId,
      masterId: reference.masterId,
      // A runtime reference model is BLOCKOUT evidence, never the production
      // fallback. Keep the audited MasterCharacter active until every gate passes.
      fallbackAssetId: reference.masterId,
      referencePath: reference.referencePath,
      profile: clone(reference.profile)
    },
    sourceSections: production.sourceSections,
    authority: production.authority,
    target: production.target,
    requirements: {
      ...production.requirements,
      refinement: createCharacterRefinementPolicy()
    },
    acceptance: {
      rule: 'all-required-gates-pass',
      requiredGates: [...CHARACTER_MODEL_REQUIRED_GATES]
    },
    handoff: {
      reviewOwner: 'Character Workshop',
      distributionTargets: targets,
      fallbackPolicy: 'retain-current-master-until-candidate-accepted'
    }
  };
  validateCharacterModelBuildRequest(request);
  return deepFreeze(request);
}

export function validateCharacterModelBuildRequest(request) {
  plainObject(request, 'character model build request');
  invariant(request.version === CHARACTER_MODEL_BUILD_REQUEST_VERSION, 'Unsupported character model build request version');
  invariant(request.kind === 'character-model-build-request', 'Invalid character model build request kind');
  stringValue(request.id, 'request id');
  stringValue(request.requestedBy, 'requestedBy');
  const provider = plainObject(request.provider, 'provider');
  stringValue(provider.id, 'provider id');
  invariant(['adapter-required', 'external-adapter'].includes(provider.mode), 'Invalid provider mode');
  const reference = plainObject(request.reference, 'reference');
  for (const field of ['id', 'label', 'characterId', 'masterId', 'fallbackAssetId', 'referencePath']) stringValue(reference[field], `reference ${field}`, 512);
  plainObject(reference.profile, 'reference profile');
  const authority = plainObject(request.authority, 'authority');
  for (const key of ['currentMaster', 'implementedModularParts', 'proposedParts', 'gameEquipment']) stringList(authority[key], `authority ${key}`);
  const target = plainObject(request.target, 'target');
  const formats = stringList(target.formats, 'target formats');
  stringValue(target.primaryFormat, 'primary format');
  invariant(formats.includes(target.primaryFormat), 'Primary format must be in target formats');
  const requirements = plainObject(request.requirements, 'requirements');
  if (requirements.refinement != null) validateCharacterRefinementPolicy(plainObject(requirements.refinement, 'requirements refinement'));
  const acceptance = plainObject(request.acceptance, 'acceptance');
  invariant(acceptance.rule === 'all-required-gates-pass', 'Invalid acceptance rule');
  const gates = stringList(acceptance.requiredGates, 'acceptance gates');
  invariant(CHARACTER_MODEL_REQUIRED_GATES.every(gate => gates.includes(gate)), 'Missing required acceptance gate');
  const handoff = plainObject(request.handoff, 'handoff');
  stringValue(handoff.reviewOwner, 'review owner');
  stringList(handoff.distributionTargets, 'distribution targets');
  invariant(handoff.fallbackPolicy === 'retain-current-master-until-candidate-accepted', 'Invalid fallback policy');
  return request;
}

/**
 * Provider adapter contract. A provider may be a local Blender pipeline, a
 * dedicated AI worker, or a future model-generation API. Runtime/game packages
 * never depend on the provider itself.
 */
export function createCharacterModelProvider(id, build) {
  const providerId = stringValue(id, 'provider id');
  invariant(typeof build === 'function', 'Character model provider requires build(request)');
  return Object.freeze({ id: providerId, build });
}

export async function buildCharacterModel(request, provider) {
  validateCharacterModelBuildRequest(request);
  invariant(provider && typeof provider.build === 'function', 'Invalid character model provider');
  const artifact = await provider.build(request);
  return createCharacterModelCandidate(request, { ...artifact, provider: artifact?.provider ?? provider.id });
}

export function createCharacterModelCandidate(request, artifact) {
  validateCharacterModelBuildRequest(request);
  plainObject(artifact, 'candidate artifact');
  const format = stringValue(artifact.format, 'candidate format').toLowerCase();
  invariant(request.target.formats.includes(format), `Unsupported candidate format: ${format}`);
  const path = stringValue(artifact.path ?? artifact.uri, 'candidate path', 1024);
  const sha256 = stringValue(artifact.sha256, 'candidate sha256', 64).toLowerCase();
  invariant(SHA256.test(sha256), 'Invalid candidate sha256');
  const provider = stringValue(artifact.provider ?? request.provider.id, 'candidate provider');
  const gates = Object.fromEntries(request.acceptance.requiredGates.map(gate => [gate, { status: 'pending', evidence: [] }]));
  return deepFreeze({
    version: CHARACTER_MODEL_CANDIDATE_VERSION,
    kind: 'character-model-candidate',
    id: `candidate.${request.reference.id}.${sha256.slice(0, 12)}`,
    requestId: request.id,
    referenceId: request.reference.id,
    characterId: request.reference.characterId,
    masterId: request.reference.masterId,
    fallbackAssetId: request.reference.fallbackAssetId,
    artifact: { format, path, sha256, provider },
    acceptance: { status: 'pending', requiredGates: [...request.acceptance.requiredGates], gates }
  });
}

export function validateCharacterModelCandidate(candidate) {
  plainObject(candidate, 'character model candidate');
  invariant(candidate.version === CHARACTER_MODEL_CANDIDATE_VERSION, 'Unsupported character model candidate version');
  invariant(candidate.kind === 'character-model-candidate', 'Invalid character model candidate kind');
  for (const field of ['id', 'requestId', 'referenceId', 'characterId', 'masterId', 'fallbackAssetId']) stringValue(candidate[field], `candidate ${field}`);
  const artifact = plainObject(candidate.artifact, 'candidate artifact');
  stringValue(artifact.format, 'candidate format');
  stringValue(artifact.path, 'candidate path', 1024);
  invariant(SHA256.test(stringValue(artifact.sha256, 'candidate sha256', 64)), 'Invalid candidate sha256');
  stringValue(artifact.provider, 'candidate provider');
  const acceptance = plainObject(candidate.acceptance, 'candidate acceptance');
  invariant(BUILD_STATUSES.has(acceptance.status), 'Invalid candidate status');
  const required = stringList(acceptance.requiredGates, 'candidate required gates');
  const gates = plainObject(acceptance.gates, 'candidate gates');
  for (const gate of required) {
    const result = plainObject(gates[gate], `candidate gate ${gate}`);
    invariant(GATE_STATUSES.has(result.status), `Invalid candidate gate status: ${gate}`);
    stringList(result.evidence, `candidate gate evidence ${gate}`);
  }
  return candidate;
}

function normalizeGateResult(gate, result) {
  if (typeof result === 'string') result = { status: result };
  plainObject(result, `gate result ${gate}`);
  invariant(GATE_STATUSES.has(result.status), `Invalid gate result status: ${gate}`);
  return {
    status: result.status,
    evidence: result.evidence == null ? [] : stringList(result.evidence, `gate evidence ${gate}`),
    note: result.note == null ? '' : stringValue(result.note, `gate note ${gate}`, 2000)
  };
}

/** Apply deterministic Workshop/CI review results. No numeric gate can bypass a fail. */
export function reviewCharacterModelCandidate(candidate, results = {}) {
  validateCharacterModelCandidate(candidate);
  plainObject(results, 'candidate review results');
  const gates = {};
  for (const gate of candidate.acceptance.requiredGates) {
    gates[gate] = results[gate]
      ? normalizeGateResult(gate, results[gate])
      : clone(candidate.acceptance.gates[gate]);
  }
  const values = Object.values(gates).map(result => result.status);
  const status = values.includes('fail') ? 'rejected' : values.every(value => value === 'pass') ? 'accepted' : 'needs-review';
  return deepFreeze({ ...clone(candidate), acceptance: { ...clone(candidate.acceptance), status, gates } });
}

/**
 * Produce the shared-package handoff only after every required gate passes.
 * Integration/game adapters consume this manifest; creation does not mutate a game save.
 */
export function createCharacterDistributionManifest(candidate, targets = CHARACTER_MODEL_DISTRIBUTION_TARGETS) {
  validateCharacterModelCandidate(candidate);
  invariant(candidate.acceptance.status === 'accepted', 'Character model candidate is not accepted');
  const apps = stringList([...targets], 'distribution targets');
  invariant(apps.length > 0, 'At least one distribution target is required');
  return deepFreeze({
    version: CHARACTER_MODEL_DISTRIBUTION_VERSION,
    kind: 'character-model-distribution-manifest',
    candidateId: candidate.id,
    referenceId: candidate.referenceId,
    characterId: candidate.characterId,
    masterId: candidate.masterId,
    fallbackAssetId: candidate.fallbackAssetId,
    artifact: clone(candidate.artifact),
    targets: apps.map(appId => ({ appId, mode: 'shared-character-asset' })),
    adoptionPolicy: 'integration-exact-head-after-acceptance'
  });
}
