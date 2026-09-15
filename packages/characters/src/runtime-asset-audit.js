import { REQUIRED_BONES } from './master-character.js';

const fail = (errors, condition, code) => { if (!condition) errors.push(code); };

/**
 * Validate a generated DCC character against the exact integrity sidecar that was
 * committed with it. This is intentionally separate from auditShinoDocument: a new
 * DCC surface must never be smuggled through the two historical Shino hashes.
 */
export function auditCharacterRuntimeDocument(document, sha256, byteLength, integrity) {
  const errors = [];
  fail(errors, integrity?.schema === 'character-asset-integrity' && integrity?.version === 1, 'invalid-integrity-schema');
  fail(errors, typeof sha256 === 'string' && sha256 === integrity?.sha256, 'content-hash-mismatch');
  fail(errors, Number.isInteger(byteLength) && byteLength === integrity?.bytes, 'content-size-mismatch');
  fail(errors, document?.asset?.version === '2.0', 'unsupported-gltf');
  fail(errors, document?.extensions?.VRMC_vrm?.specVersion === '1.0', 'missing-vrm1');
  fail(errors, integrity?.modelingMode === 'dcc-blender' || integrity?.modelingMode === 'dcc-maya' || integrity?.modelingMode === 'imported-reviewed', 'non-dcc-integrity');
  fail(errors, ['PRIMARY','SECONDARY','DEFORMATION','MOTION','POLISH','RUNTIME_READY'].includes(integrity?.productionStage), 'invalid-production-stage');
  fail(errors, document?.asset?.extras?.rinneCharacter?.id === integrity?.id, 'character-identity-mismatch');
  fail(errors, document?.asset?.extras?.rinneCharacter?.modelingMode === integrity?.modelingMode, 'modeling-mode-mismatch');
  fail(errors, (document?.buffers || []).every(row => !row.uri) && (document?.images || []).every(row => !row.uri), 'external-resource');
  const bones = document?.extensions?.VRMC_vrm?.humanoid?.humanBones || {};
  fail(errors, REQUIRED_BONES.every(name => Number.isInteger(bones[name]?.node) && document?.nodes?.[bones[name].node]), 'incomplete-humanoid');
  return Object.freeze({
    approved: errors.length === 0,
    errors: Object.freeze(errors),
    sha256,
    byteLength,
    id: integrity?.id ?? null,
    assetId: integrity?.assetId ?? null,
    productionStage: integrity?.productionStage ?? null,
    productionReady: integrity?.productionStage === 'RUNTIME_READY' && integrity?.visualApproval === 'approved'
  });
}
