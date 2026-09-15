import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA256 = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FORMAT = new Set(['glb', 'vrm']);
const STAGE = new Set(['REFERENCE', 'BLOCKOUT', 'PRIMARY']);
const REQUIRED_REFERENCE_VIEWS = ['front', 'side', 'back'];

function fail(message) {
  throw new Error(`Character DCC request: ${message}`);
}

function string(value, name) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} must be a non-empty string`);
  if (/\r|\n|\0/.test(value)) fail(`${name} contains an invalid control character`);
  return value;
}

export function repoPath(value, name) {
  const raw = string(value, name).replaceAll('\\', '/');
  if (path.posix.isAbsolute(raw)) fail(`${name} must be repository-relative`);
  const normalized = path.posix.normalize(raw);
  if (normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')) fail(`${name} escapes the repository`);
  if (normalized === '.') fail(`${name} must identify a file or directory`);
  return normalized;
}

function sha(value, name) {
  value = string(value, name).toLowerCase();
  if (!SHA256.test(value)) fail(`${name} must be a lowercase 64-character SHA-256`);
  return value;
}

function integer(value, name, min = 1) {
  if (!Number.isInteger(value) || value < min) fail(`${name} must be an integer >= ${min}`);
  return value;
}

function boolean(value, name) {
  if (typeof value !== 'boolean') fail(`${name} must be boolean`);
  return value;
}

function arrayOfStrings(value, name) {
  if (!Array.isArray(value) || !value.length) fail(`${name} must be a non-empty string array`);
  return value.map((entry, index) => string(entry, `${name}[${index}]`));
}

function requireValues(actual, required, name) {
  const values = new Set(actual);
  for (const value of required) if (!values.has(value)) fail(`${name} must include ${value}`);
}

export function loadCharacterDccRequest(requestPath, { verifyFiles = false } = {}) {
  const relativeRequest = repoPath(requestPath, 'request path');
  let raw;
  try {
    raw = JSON.parse(readFileSync(relativeRequest, 'utf8'));
  } catch (error) {
    fail(`cannot read ${relativeRequest}: ${error.message}`);
  }
  if (raw.schema !== 'character-dcc-request' || raw.version !== 1) fail('schema/version must be character-dcc-request v1');
  const id = string(raw.id, 'id');
  const assetId = string(raw.assetId, 'assetId');
  if (!ID.test(id) || !ID.test(assetId)) fail('id and assetId may contain only letters, digits, dot, underscore and hyphen');

  const reference = {
    path: repoPath(raw.reference?.path, 'reference.path'),
    sha256: sha(raw.reference?.sha256, 'reference.sha256'),
    views: arrayOfStrings(raw.reference?.views, 'reference.views')
  };
  requireValues(reference.views, REQUIRED_REFERENCE_VIEWS, 'reference.views');
  const rig = {
    path: repoPath(raw.rig?.path, 'rig.path'),
    sha256: sha(raw.rig?.sha256, 'rig.sha256'),
    id: string(raw.rig?.id, 'rig.id')
  };
  const builder = repoPath(raw.builder, 'builder');
  if (!builder.endsWith('.py')) fail('builder must be a Blender Python script');
  const generatedDir = repoPath(raw.generatedDir, 'generatedDir');
  if (!generatedDir.startsWith('generated/')) fail('generatedDir must stay under generated/');
  const blendName = string(raw.blendName, 'blendName');
  const modelName = string(raw.modelName, 'modelName');
  if (!blendName.endsWith('.blend')) fail('blendName must end in .blend');

  const format = string(raw.format ?? path.posix.extname(modelName).slice(1).toLowerCase(), 'format').toLowerCase();
  if (!FORMAT.has(format)) fail('format must be glb or vrm');
  if (!modelName.toLowerCase().endsWith(`.${format}`)) fail(`modelName must end in .${format}`);
  const publicPath = string(raw.publicPath, 'publicPath');
  if (!publicPath.startsWith('./') || publicPath.includes('..') || /\r|\n|\0/.test(publicPath)) fail('publicPath must be a safe ./ runtime path');

  const canonical = {
    blend: repoPath(raw.canonical?.blend, 'canonical.blend'),
    model: repoPath(raw.canonical?.model, 'canonical.model'),
    integrity: repoPath(raw.canonical?.integrity, 'canonical.integrity'),
    production: repoPath(raw.canonical?.production, 'canonical.production'),
    qaDir: repoPath(raw.canonical?.qaDir, 'canonical.qaDir')
  };
  if (!canonical.blend.endsWith('.blend')) fail('canonical.blend must end in .blend');
  if (!canonical.model.toLowerCase().endsWith(`.${format}`)) fail(`canonical.model must end in .${format}`);
  if (!canonical.integrity.endsWith('.json') || !canonical.production.endsWith('.production.json')) fail('canonical integrity/production paths must be JSON');
  for (const [key, value] of Object.entries(canonical)) {
    if (value.startsWith('generated/')) fail(`canonical.${key} cannot point into generated/`);
    if (value.startsWith('.github/')) fail(`canonical.${key} cannot modify workflow control files`);
    if (value === '.dcc' || value.startsWith('.dcc/')) fail(`canonical.${key} cannot overwrite the DCC request`);
  }

  const license = {
    rigProvenance: string(raw.license?.rigProvenance, 'license.rigProvenance'),
    surfaceAuthorship: string(raw.license?.surfaceAuthorship, 'license.surfaceAuthorship')
  };
  const primary = {
    separateSurfaces: arrayOfStrings(raw.primary?.separateSurfaces, 'primary.separateSurfaces'),
    minMeshObjects: integer(raw.primary?.minMeshObjects, 'primary.minMeshObjects'),
    minMaterials: integer(raw.primary?.minMaterials, 'primary.minMaterials')
  };
  requireValues(primary.separateSurfaces, ['skin', 'hair', 'clothing'], 'primary.separateSurfaces');

  const production = {
    stage: string(raw.production?.stage ?? 'REFERENCE', 'production.stage').toUpperCase(),
    productionReady: raw.production?.productionReady ?? false,
    visualApproval: string(raw.production?.visualApproval ?? 'pending', 'production.visualApproval')
  };
  if (!STAGE.has(production.stage)) fail('production.stage may only be REFERENCE, BLOCKOUT or PRIMARY in the carrier');
  if (production.productionReady !== false) fail('productionReady must remain false in the carrier');
  if (production.visualApproval !== 'pending') fail('visualApproval must remain pending in the carrier');

  const review = {
    intentLocked: raw.review?.intentLocked ?? true,
    proportionsReviewed: raw.review?.proportionsReviewed ?? false,
    silhouetteReviewed: raw.review?.silhouetteReviewed ?? false,
    topologyReviewed: raw.review?.topologyReviewed ?? false
  };
  for (const [key, value] of Object.entries(review)) boolean(value, `review.${key}`);
  if (!review.intentLocked) fail('all carrier stages require review.intentLocked=true');
  if (production.stage === 'BLOCKOUT' || production.stage === 'PRIMARY') {
    for (const key of ['proportionsReviewed', 'silhouetteReviewed']) {
      if (!review[key]) fail(`${production.stage} requires review.${key}=true`);
    }
  }
  if (production.stage === 'PRIMARY' && !review.topologyReviewed) fail('PRIMARY requires review.topologyReviewed=true');

  const request = Object.freeze({
    requestPath: relativeRequest,
    schema: raw.schema,
    version: raw.version,
    id,
    assetId,
    reference,
    rig,
    builder,
    generatedDir,
    blendName,
    modelName,
    format,
    publicPath,
    canonical,
    license,
    primary,
    production,
    review
  });

  if (verifyFiles) verifyCharacterDccInputs(request);
  return request;
}

export function fileSha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function verifyCharacterDccInputs(request) {
  for (const [name, file, expected] of [
    ['reference', request.reference.path, request.reference.sha256],
    ['rig', request.rig.path, request.rig.sha256]
  ]) {
    if (!existsSync(file) || !statSync(file).isFile() || statSync(file).size === 0) fail(`${name} file is missing or empty: ${file}`);
    const actual = fileSha256(file);
    if (actual !== expected) fail(`${name} SHA-256 mismatch: expected ${expected}, got ${actual}`);
  }
  if (!existsSync(request.builder) || !statSync(request.builder).isFile() || statSync(request.builder).size === 0) fail(`builder is missing or empty: ${request.builder}`);
}

function appendGithubFile(file, rows) {
  writeFileSync(file, Object.entries(rows).map(([key, value]) => `${key}=${String(value)}`).join('\n') + '\n', { flag: 'a' });
}

function summary(request) {
  return {
    id: request.id,
    assetId: request.assetId,
    reference: request.reference.path,
    rig: request.rig.id,
    builder: request.builder,
    stage: request.production.stage,
    generatedDir: request.generatedDir,
    canonical: request.canonical
  };
}

const [command, requestPath = '.dcc/character-dcc-request.json', outputPath] = process.argv.slice(2);
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  try {
    const request = loadCharacterDccRequest(requestPath, { verifyFiles: true });
    if (command === 'validate') {
      console.log(JSON.stringify(summary(request), null, 2));
    } else if (command === 'emit-env') {
      if (!outputPath) fail('emit-env requires a GITHUB_ENV path');
      appendGithubFile(outputPath, {
        DCC_REQUEST: request.requestPath,
        DCC_ID: request.id,
        DCC_REFERENCE: request.reference.path,
        DCC_RIG: request.rig.path,
        DCC_BUILDER: request.builder,
        DCC_GENERATED_DIR: request.generatedDir,
        DCC_BLEND_NAME: request.blendName,
        DCC_MODEL_NAME: request.modelName,
        DCC_CANONICAL_BLEND: request.canonical.blend,
        DCC_CANONICAL_MODEL: request.canonical.model,
        DCC_CANONICAL_INTEGRITY: request.canonical.integrity,
        DCC_CANONICAL_PRODUCTION: request.canonical.production,
        DCC_QA_DIR: request.canonical.qaDir
      });
      console.log(JSON.stringify(summary(request), null, 2));
    } else {
      fail('usage: node scripts/character-dcc-request.mjs validate|emit-env <request.json> [GITHUB_ENV]');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
