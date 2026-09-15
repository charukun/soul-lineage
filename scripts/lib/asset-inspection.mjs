import { extname } from 'node:path';

export const ASSET_INSPECTION_VERSION = 1;
export const INSPECTABLE_ASSET_EXTENSIONS = Object.freeze(['.glb', '.gltf', '.vrm']);
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

const finiteNonNegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const array = value => Array.isArray(value) ? value : [];
const unique = values => [...new Set(values)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function decodeJsonChunk(bytes) {
  return new TextDecoder().decode(bytes).replace(/[\u0000\s]+$/g, '');
}

export function parseAssetDocument(buffer, { file = '' } = {}) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const extension = extname(file).toLowerCase();
  if (!INSPECTABLE_ASSET_EXTENSIONS.includes(extension)) throw new Error(`Unsupported inspectable asset: ${extension || '(none)'}`);
  if (extension === '.gltf') {
    const document = JSON.parse(bytes.toString('utf8'));
    return { document, container: { kind: 'gltf-json', version: document.asset?.version || null, declaredBytes: bytes.length } };
  }
  if (bytes.length < 20) throw new Error('GLB/VRM is too small to contain a valid header and JSON chunk');
  const magic = bytes.readUInt32LE(0), version = bytes.readUInt32LE(4), declaredBytes = bytes.readUInt32LE(8);
  if (magic !== GLB_MAGIC) throw new Error('Invalid GLB/VRM magic');
  if (version !== 2) throw new Error(`Unsupported GLB version: ${version}`);
  if (declaredBytes > bytes.length || declaredBytes < 20) throw new Error(`Invalid GLB declared length: ${declaredBytes}`);
  let offset = 12, document = null;
  while (offset + 8 <= declaredBytes) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (length < 0 || offset + length > declaredBytes) throw new Error('Invalid GLB chunk length');
    if (type === JSON_CHUNK && document == null) document = JSON.parse(decodeJsonChunk(bytes.subarray(offset, offset + length)));
    offset += length;
  }
  if (!document) throw new Error('GLB/VRM has no JSON chunk');
  return { document, container: { kind: extension === '.vrm' ? 'vrm-glb' : 'glb', version, declaredBytes } };
}

function primitiveElementCount(document, primitive) {
  const accessor = Number.isInteger(primitive?.indices)
    ? document.accessors?.[primitive.indices]
    : document.accessors?.[primitive?.attributes?.POSITION];
  return finiteNonNegative(accessor?.count) ? accessor.count : null;
}

function primitiveTriangles(document, primitive) {
  const count = primitiveElementCount(document, primitive);
  if (!finiteNonNegative(count)) return null;
  const mode = primitive?.mode ?? 4;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return null;
}

function inspectGeometry(document) {
  let primitiveCount = 0, triangleCount = 0, measuredPrimitives = 0, morphTargetCount = 0;
  const materialBindings = new Set();
  for (const mesh of array(document.meshes)) {
    for (const primitive of array(mesh?.primitives)) {
      primitiveCount++;
      if (Number.isInteger(primitive?.material)) materialBindings.add(primitive.material);
      morphTargetCount += array(primitive?.targets).length;
      const triangles = primitiveTriangles(document, primitive);
      if (finiteNonNegative(triangles)) { triangleCount += triangles; measuredPrimitives++; }
    }
  }
  return {
    primitiveCount,
    triangles: primitiveCount > 0 && measuredPrimitives === primitiveCount ? triangleCount : null,
    triangleEvidence: primitiveCount === 0 ? 'not-applicable' : measuredPrimitives === primitiveCount ? 'measured' : measuredPrimitives ? 'partial' : 'unavailable',
    measuredPrimitives,
    materialBindings: materialBindings.size,
    morphTargetCount,
  };
}

function inspectLod(document) {
  const names = [...array(document.meshes), ...array(document.nodes)].map(row => row?.name).filter(Boolean);
  const groups = new Map();
  for (const name of names) {
    const match = String(name).match(/^(.*)_LOD([012])$/i);
    if (!match) continue;
    const id = match[1] || '(root)', level = Number(match[2]);
    if (!groups.has(id)) groups.set(id, new Set());
    groups.get(id).add(level);
  }
  const rows = [...groups.entries()].map(([id, levels]) => ({ id, levels: [...levels].sort() }));
  return {
    levels: unique(rows.flatMap(row => row.levels)).sort(),
    groups: rows,
    completeGroups: rows.filter(row => [0, 1, 2].every(level => row.levels.includes(level))).map(row => row.id),
    hasCompleteAuthoredLod: rows.some(row => [0, 1, 2].every(level => row.levels.includes(level))),
  };
}

function inspectCompression(document) {
  const extensions = unique([...array(document.extensionsUsed), ...array(document.extensionsRequired)]);
  const imageKtx2 = array(document.images).some(image => image?.mimeType === 'image/ktx2' || /\.ktx2(?:$|[?#])/i.test(image?.uri || ''));
  const meshopt = extensions.includes('EXT_meshopt_compression');
  const draco = extensions.includes('KHR_draco_mesh_compression');
  const ktx2 = extensions.includes('KHR_texture_basisu') || imageKtx2;
  return { extensions, meshopt, draco, geometryCompressed: meshopt || draco, ktx2 };
}

function inspectVrm(document, extension) {
  const root = document.extensions || {};
  const flavor = root.VRMC_vrm ? 'VRM1' : root.VRM ? 'VRM0' : extension === '.vrm' ? 'VRM-unknown' : null;
  return { isVrm: extension === '.vrm' || Boolean(flavor), flavor };
}

function inspectRisk({ file, extension, geometry, skins, vrm }) {
  const normalized = String(file).replaceAll('\\', '/');
  const reviewArtifact = /(?:^|[/_.-])review(?:[/. _-]|$)/i.test(normalized) || /\/simulator\/assets\//i.test(normalized) && extension === '.vrm';
  const hasSkin = skins.count > 0;
  const hasMorphTargets = geometry.morphTargetCount > 0;
  const destructiveOptimizationSafe = extension !== '.vrm' && !reviewArtifact && !hasSkin && !hasMorphTargets;
  return {
    reviewArtifact,
    runtimeContainer: true,
    editableSource: false,
    canonicalSourceKnown: false,
    hasSkin,
    hasMorphTargets,
    destructiveOptimizationSafe,
  };
}

export function compareRoleBudget(metrics, budget = null) {
  if (!budget) return null;
  const checks = {
    triangles: metrics.triangles == null ? 'unknown' : metrics.triangles <= budget.softTriangleBudget ? 'pass' : 'review',
    materials: metrics.materials == null ? 'unknown' : metrics.materials <= budget.softMaterialBudget ? 'pass' : 'review',
    estimatedDrawCalls: metrics.primitiveCount == null ? 'unknown' : metrics.primitiveCount <= budget.softDrawCallBudget ? 'pass' : 'review',
  };
  return { role: budget.role, styleId: budget.styleId, budget, checks, gate: Object.values(checks).includes('review') ? 'review' : Object.values(checks).every(value => value === 'unknown') ? 'unknown' : 'pass' };
}

export function prioritiseAsset(row) {
  const sizeMiB = row.bytes / 1024 / 1024;
  let score = Math.min(30, sizeMiB * 1.5);
  if (finiteNonNegative(row.metrics.triangles)) score += Math.min(25, row.metrics.triangles / 4000);
  score += Math.min(12, row.metrics.materials * .6);
  score += Math.min(8, row.metrics.images * .5);
  score += Math.min(8, row.metrics.primitiveCount * .2);
  if (!row.compression.geometryCompressed) score += 8;
  if (!row.compression.ktx2 && row.metrics.images > 0) score += 5;
  if (!row.lod.hasCompleteAuthoredLod && finiteNonNegative(row.metrics.triangles) && row.metrics.triangles >= 10000) score += 8;
  if (row.risk.reviewArtifact) score += 4;
  if (row.risk.hasSkin || row.risk.hasMorphTargets) score += 4;
  score = Math.round(clamp(score, 0, 100) * 10) / 10;

  let action = 'monitor';
  let reason = 'No high-priority optimisation evidence detected';
  if (row.risk.reviewArtifact) { action = 'locate-canonical-source'; reason = 'Review/runtime artifact is not an editable canonical source'; }
  else if (row.risk.hasMorphTargets || row.risk.hasSkin) { action = 'author-dcc-lod'; reason = 'Skinned or morphed assets require authored DCC optimisation'; }
  else if (!row.lod.hasCompleteAuthoredLod && finiteNonNegative(row.metrics.triangles) && row.metrics.triangles >= 10000) { action = 'generate-authored-lod'; reason = 'Large static geometry has no complete LOD0/1/2 evidence'; }
  else if (!row.compression.geometryCompressed || (!row.compression.ktx2 && row.metrics.images > 0)) { action = 'compress-runtime-asset'; reason = 'Runtime compression evidence is incomplete'; }
  if (row.budget?.gate === 'review' && row.risk.hasSkin) { action = 'author-dcc-lod'; reason = 'Role budget is exceeded on a skinned asset'; }
  return { score, action, reason };
}

export function inspectAssetBuffer(buffer, { file = '', bytes = null, roleBudget = null } = {}) {
  const extension = extname(file).toLowerCase();
  const parsed = parseAssetDocument(buffer, { file });
  const document = parsed.document;
  const geometry = inspectGeometry(document);
  const skins = {
    count: array(document.skins).length,
    jointCount: array(document.skins).reduce((sum, skin) => sum + array(skin?.joints).length, 0),
    maxJointsPerSkin: array(document.skins).reduce((max, skin) => Math.max(max, array(skin?.joints).length), 0),
  };
  const metrics = {
    meshes: array(document.meshes).length,
    primitiveCount: geometry.primitiveCount,
    triangles: geometry.triangles,
    triangleEvidence: geometry.triangleEvidence,
    materials: array(document.materials).length,
    materialBindings: geometry.materialBindings,
    textures: array(document.textures).length,
    images: array(document.images).length,
    animations: array(document.animations).length,
    skins: skins.count,
    joints: skins.jointCount,
    maxJointsPerSkin: skins.maxJointsPerSkin,
    morphTargets: geometry.morphTargetCount,
  };
  const compression = inspectCompression(document);
  const lod = inspectLod(document);
  const vrm = inspectVrm(document, extension);
  const risk = inspectRisk({ file, extension, geometry, skins, vrm });
  const row = {
    schema: 'soul-asset-inspection',
    version: ASSET_INSPECTION_VERSION,
    file,
    extension,
    bytes: finiteNonNegative(bytes) ? bytes : Buffer.byteLength(buffer),
    container: parsed.container,
    assetVersion: document.asset?.version || null,
    generator: document.asset?.generator || null,
    vrm,
    metrics,
    compression,
    lod,
    risk,
    evidence: {
      measured: ['bytes', 'container', 'meshes', 'primitives', 'materials', 'textures', 'images', 'animations', 'skins', 'joints', 'morphTargets', 'extensions', 'lodNames'],
      unavailable: geometry.triangleEvidence === 'measured' || geometry.triangleEvidence === 'not-applicable' ? [] : ['completeTriangleCount'],
      inferred: ['reviewArtifact', 'destructiveOptimizationSafe', 'priority', 'recommendedAction'],
    },
    budget: null,
    priority: null,
  };
  row.budget = compareRoleBudget(metrics, roleBudget);
  row.priority = prioritiseAsset(row);
  return row;
}

export function buildInventoryReport(rows, { limit = 20, createdAt = new Date().toISOString() } = {}) {
  const valid = rows.filter(Boolean);
  const priority = [...valid].sort((a, b) => b.priority.score - a.priority.score || a.file.localeCompare(b.file)).slice(0, Math.max(1, limit));
  const summary = {
    assets: valid.length,
    bytes: valid.reduce((sum, row) => sum + (row.bytes || 0), 0),
    reviewArtifacts: valid.filter(row => row.risk.reviewArtifact).length,
    skinned: valid.filter(row => row.risk.hasSkin).length,
    morphed: valid.filter(row => row.risk.hasMorphTargets).length,
    geometryUncompressed: valid.filter(row => !row.compression.geometryCompressed).length,
    textureCompressionMissing: valid.filter(row => row.metrics.images > 0 && !row.compression.ktx2).length,
    completeAuthoredLod: valid.filter(row => row.lod.hasCompleteAuthoredLod).length,
    triangleUnknown: valid.filter(row => row.metrics.triangles == null).length,
  };
  return { schema: 'soul-asset-inventory', version: ASSET_INSPECTION_VERSION, createdAt, summary, rows: [...valid].sort((a,b) => a.file.localeCompare(b.file)), priority };
}
