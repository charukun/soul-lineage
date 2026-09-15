export const CHARACTER_PRODUCTION_MANIFEST = 'character-production';
export const CHARACTER_PRODUCTION_VERSION = 2;

export const CHARACTER_PRODUCTION_STAGES = Object.freeze([
  'REFERENCE',
  'BLOCKOUT',
  'PRIMARY',
  'SECONDARY',
  'DEFORMATION',
  'MOTION',
  'POLISH',
  'RUNTIME_READY'
]);

export const CHARACTER_MODELING_MODES = Object.freeze([
  'reference-only',
  'runtime-procedural',
  'dcc-blender',
  'dcc-maya',
  'imported-reviewed'
]);

export const REQUIRED_REFERENCE_VIEWS = Object.freeze(['front', 'side', 'back']);
export const REQUIRED_BLOCKOUT_VIEWS = Object.freeze(['front', 'side', 'back', 'three-quarter']);
export const REQUIRED_DEFORMATION_POSES = Object.freeze([
  'neutral', 'head-turn', 'arm-raise', 'elbow-bend', 'knee-bend', 'crouch'
]);
export const REQUIRED_MOTION_CLIPS = Object.freeze([
  'relaxed-idle', 'combat-idle', 'relaxed-to-combat', 'walk', 'run',
  'attack', 'hit-small', 'hit-large', 'weapon-draw', 'weapon-sheathe'
]);
export const REQUIRED_MOTION_PRINCIPLES = Object.freeze([
  'centerOfGravity', 'silhouette', 'lineOfAction', 'anticipation',
  'timingSpacing', 'gameplayExaggeration', 'cameraVersatility'
]);
export const REQUIRED_POLISH_EXPRESSIONS = Object.freeze(['neutral', 'blink', 'smile', 'mouth-open']);
export const REQUIRED_MATERIAL_CHANNELS = Object.freeze(['baseColor', 'roughness', 'metallic', 'normal']);

const STAGE_INDEX = new Map(CHARACTER_PRODUCTION_STAGES.map((stage, index) => [stage, index]));
const MODES = new Set(CHARACTER_MODELING_MODES);

function hasAll(actual, required) {
  const values = new Set(Array.isArray(actual) ? actual : []);
  return required.every(value => values.has(value));
}

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function missingBoolean(target, key, label, missing) {
  if (target?.[key] !== true) missing.push(label);
}

function missingList(target, key, required, label, missing) {
  if (!hasAll(target?.[key], required)) missing.push(`${label}: ${required.join(', ')}`);
}

function normalizeStage(stage) {
  if (!STAGE_INDEX.has(stage)) throw new Error(`Unknown character production stage: ${stage}`);
  return stage;
}

export function characterProductionStageIndex(stage) {
  return STAGE_INDEX.get(normalizeStage(stage));
}

export function characterProductionStageLabel(stage) {
  return ({
    REFERENCE: 'REFERENCE / 設定固定',
    BLOCKOUT: 'BLOCKOUT / 粗造形',
    PRIMARY: 'PRIMARY / 大形状',
    SECONDARY: 'SECONDARY / 二次形状',
    DEFORMATION: 'DEFORMATION / 変形検証',
    MOTION: 'MOTION / ゲーム動作',
    POLISH: 'POLISH / 仕上げ',
    RUNTIME_READY: 'RUNTIME READY / 実装投入可'
  })[normalizeStage(stage)];
}

export function maximumStageForModelingMode(mode) {
  if (!MODES.has(mode)) throw new Error(`Unknown character modeling mode: ${mode}`);
  if (mode === 'reference-only') return 'REFERENCE';
  if (mode === 'runtime-procedural') return 'BLOCKOUT';
  return 'RUNTIME_READY';
}

function stageProblems(manifest, stage) {
  const missing = [];
  const evidence = manifest.evidence || {};
  const source = manifest.source || {};

  if (stage === 'REFERENCE') {
    if (!Array.isArray(source.referencePaths) || source.referencePaths.length === 0) missing.push('source.referencePaths');
    missingBoolean(evidence.reference, 'intentLocked', 'evidence.reference.intentLocked', missing);
    missingList(evidence.reference, 'views', REQUIRED_REFERENCE_VIEWS, 'evidence.reference.views', missing);
  }

  if (stage === 'BLOCKOUT') {
    missingList(evidence.blockout, 'views', REQUIRED_BLOCKOUT_VIEWS, 'evidence.blockout.views', missing);
    missingBoolean(evidence.blockout, 'proportionsReviewed', 'evidence.blockout.proportionsReviewed', missing);
    missingBoolean(evidence.blockout, 'silhouetteReviewed', 'evidence.blockout.silhouetteReviewed', missing);
  }

  if (stage === 'PRIMARY') {
    if (!['dcc-blender', 'dcc-maya', 'imported-reviewed'].includes(manifest.modelingMode)) missing.push('PRIMARY requires DCC or reviewed imported mesh; runtime-procedural is blockout-only');
    if (!source.meshPath) missing.push('source.meshPath');
    missingBoolean(evidence.primary, 'topologyReviewed', 'evidence.primary.topologyReviewed', missing);
    missingBoolean(evidence.primary, 'uvReviewed', 'evidence.primary.uvReviewed', missing);
    missingList(evidence.primary, 'separateSurfaces', ['skin', 'hair', 'clothing'], 'evidence.primary.separateSurfaces', missing);
    if (manifest.modelingMode?.startsWith('dcc-')) {
      if (!source.dcc?.tool || !source.dcc?.version || !source.dcc?.sourcePath) missing.push('source.dcc tool/version/sourcePath');
    }
  }

  if (stage === 'SECONDARY') {
    for (const key of ['hairFormsReviewed', 'clothingFormsReviewed', 'accessoriesReviewed']) {
      missingBoolean(evidence.secondary, key, `evidence.secondary.${key}`, missing);
    }
  }

  if (stage === 'DEFORMATION') {
    missingList(evidence.deformation, 'poses', REQUIRED_DEFORMATION_POSES, 'evidence.deformation.poses', missing);
    missingBoolean(evidence.deformation, 'weightsReviewed', 'evidence.deformation.weightsReviewed', missing);
    missingBoolean(evidence.deformation, 'selfIntersectionReviewed', 'evidence.deformation.selfIntersectionReviewed', missing);
    missingBoolean(evidence.deformation, 'clothingHairCollisionReviewed', 'evidence.deformation.clothingHairCollisionReviewed', missing);
  }

  if (stage === 'MOTION') {
    missingList(evidence.motion, 'clips', REQUIRED_MOTION_CLIPS, 'evidence.motion.clips', missing);
    if (!Number.isInteger(evidence.motion?.viewCount) || evidence.motion.viewCount < 8) missing.push('evidence.motion.viewCount >= 8');
    for (const key of REQUIRED_MOTION_PRINCIPLES) missingBoolean(evidence.motion?.principles, key, `evidence.motion.principles.${key}`, missing);
    missingBoolean(evidence.motion, 'returnsToStablePose', 'evidence.motion.returnsToStablePose', missing);
  }

  if (stage === 'POLISH') {
    missingList(evidence.polish, 'expressions', REQUIRED_POLISH_EXPRESSIONS, 'evidence.polish.expressions', missing);
    for (const key of REQUIRED_MATERIAL_CHANNELS) missingBoolean(evidence.polish?.materials, key, `evidence.polish.materials.${key}`, missing);
    missingBoolean(evidence.polish, 'secondaryMotionReviewed', 'evidence.polish.secondaryMotionReviewed', missing);
    if (evidence.polish?.visualApproval !== 'approved') missing.push('evidence.polish.visualApproval = approved');
  }

  if (stage === 'RUNTIME_READY') {
    const runtime = evidence.runtime || {};
    if (!['glb', 'gltf', 'vrm'].includes(runtime.format)) missing.push('evidence.runtime.format = glb|gltf|vrm');
    if (runtime.webgl2 !== true) missing.push('evidence.runtime.webgl2');
    if (!runtime.assetHash) missing.push('evidence.runtime.assetHash');
    if (runtime.provenanceReviewed !== true) missing.push('evidence.runtime.provenanceReviewed');
    if (runtime.licenseReviewed !== true) missing.push('evidence.runtime.licenseReviewed');
    if (!Number.isFinite(runtime.desktopP95Ms) || runtime.desktopP95Ms > 16.67) missing.push('evidence.runtime.desktopP95Ms <= 16.67');
    if (!Number.isFinite(runtime.mobileP95Ms) || runtime.mobileP95Ms > 33.34) missing.push('evidence.runtime.mobileP95Ms <= 33.34');
    if (!finiteNonNegative(runtime.triangles)) missing.push('evidence.runtime.triangles');
    if (!finiteNonNegative(runtime.drawCalls)) missing.push('evidence.runtime.drawCalls');
    if (!finiteNonNegative(runtime.textureMemoryBytes)) missing.push('evidence.runtime.textureMemoryBytes');
    if (runtime.mobileDeviceClass !== 'pixel-fold-class') missing.push('evidence.runtime.mobileDeviceClass = pixel-fold-class');
    if (!Number.isInteger(runtime.reviewViewCount) || runtime.reviewViewCount < 8) missing.push('evidence.runtime.reviewViewCount >= 8');
  }

  return missing;
}

export function validateCharacterProductionManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Character production manifest must be an object');
  if (manifest.schema !== CHARACTER_PRODUCTION_MANIFEST) throw new Error(`schema must be ${CHARACTER_PRODUCTION_MANIFEST}`);
  if (manifest.version !== CHARACTER_PRODUCTION_VERSION) throw new Error(`version must be ${CHARACTER_PRODUCTION_VERSION}`);
  if (!/^[a-z0-9][a-z0-9._-]{1,127}$/i.test(manifest.id || '')) throw new Error('manifest.id is invalid');
  normalizeStage(manifest.stage);
  if (!MODES.has(manifest.modelingMode)) throw new Error(`Unknown character modeling mode: ${manifest.modelingMode}`);
  return manifest;
}

export function evaluateCharacterProduction(manifest, targetStage = manifest?.stage) {
  validateCharacterProductionManifest(manifest);
  const requested = normalizeStage(targetStage);
  const requestedIndex = STAGE_INDEX.get(requested);
  const modeMaximum = maximumStageForModelingMode(manifest.modelingMode);
  const modeMaximumIndex = STAGE_INDEX.get(modeMaximum);
  const missing = [];
  if (requestedIndex > modeMaximumIndex) missing.push(`${manifest.modelingMode} cannot advance beyond ${modeMaximum}`);
  for (let i = 0; i <= requestedIndex; i++) missing.push(...stageProblems(manifest, CHARACTER_PRODUCTION_STAGES[i]));

  let highestEligibleStage = null;
  for (let i = 0; i < CHARACTER_PRODUCTION_STAGES.length; i++) {
    const stage = CHARACTER_PRODUCTION_STAGES[i];
    if (i > modeMaximumIndex) break;
    const cumulative = [];
    for (let j = 0; j <= i; j++) cumulative.push(...stageProblems(manifest, CHARACTER_PRODUCTION_STAGES[j]));
    if (cumulative.length) break;
    highestEligibleStage = stage;
  }

  return Object.freeze({
    ok: missing.length === 0,
    id: manifest.id,
    declaredStage: manifest.stage,
    targetStage: requested,
    modelingMode: manifest.modelingMode,
    maximumStage: modeMaximum,
    highestEligibleStage,
    productionReady: missing.length === 0 && requested === 'RUNTIME_READY',
    missing: Object.freeze([...new Set(missing)])
  });
}

export function assertCharacterProductionStage(manifest, targetStage = manifest?.stage) {
  const result = evaluateCharacterProduction(manifest, targetStage);
  if (!result.ok) throw new Error(`${result.id} cannot enter ${result.targetStage}: ${result.missing.join('; ')}`);
  return result;
}

export function referenceModelProductionStage(model) {
  if (!model) return null;
  if (model.kind === 'runtime-reference-model' || model.assetId?.startsWith('runtime.')) return 'BLOCKOUT';
  if (model.kind === 'reference-preset') return 'REFERENCE';
  return model.productionStage && STAGE_INDEX.has(model.productionStage) ? model.productionStage : null;
}
