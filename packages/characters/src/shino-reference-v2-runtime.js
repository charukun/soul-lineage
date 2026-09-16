import { MASTER_ID, SHINO_MASTER, deepFreeze } from './master-character.js';

export const SHINO_REFERENCE_V2_ID = 'shino.reference.v2';
export const SHINO_REFERENCE_V2_ASSET_ID = 'character.shino-reference-v2.dcc.v1';
export const SHINO_REFERENCE_V2_SHA256 = '5f730603f1cd32f743ecbcdd279cf1d3233839fcf36277876a185abbf8eb3e2e';
export const SHINO_REFERENCE_V2_BYTES = 1453736;

export const SHINO_REFERENCE_V2_INTEGRITY = deepFreeze({
  schema: 'character-asset-integrity',
  version: 1,
  id: SHINO_REFERENCE_V2_ID,
  assetId: SHINO_REFERENCE_V2_ASSET_ID,
  format: 'vrm',
  path: './simulator/assets/SHINO_REFERENCE_V2.vrm',
  sha256: SHINO_REFERENCE_V2_SHA256,
  bytes: SHINO_REFERENCE_V2_BYTES,
  productionStage: 'PRIMARY',
  modelingMode: 'dcc-blender',
  sourceBlendSha256: '47e5859ba492d40b71c83835ad05b913e04b9433cefd44d18d300f71c7e9ccdc',
  humanoidRig: SHINO_MASTER.rigId,
  referencePath: 'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
  visualApproval: 'pending'
});

/**
 * Exact shared runtime descriptor for the DCC-authored Shino reference candidate.
 * This is deliberately still PRIMARY/pending. Three-app adoption must not turn a
 * rendered asset into an implicit RUNTIME_READY or visual-approval claim.
 */
export const SHINO_REFERENCE_V2_RUNTIME = deepFreeze({
  id: `asset.${SHINO_REFERENCE_V2_ID}`,
  familyId: MASTER_ID,
  modelId: SHINO_REFERENCE_V2_ID,
  label: 'Shino Reference v2 / DCC',
  url: SHINO_REFERENCE_V2_INTEGRITY.path,
  runtime: {
    file: 'SHINO_REFERENCE_V2.vrm',
    localPath: 'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm',
    integrityPath: 'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json'
  },
  source: {
    baseRepository: SHINO_MASTER.source.repository,
    baseRevision: SHINO_MASTER.source.commit,
    basePath: SHINO_MASTER.source.path,
    dccSourcePath: 'assets/characters/shino/reference-v2/source/ShinoReferenceV2.blend',
    referencePath: SHINO_REFERENCE_V2_INTEGRITY.referencePath,
    sourceBlendSha256: SHINO_REFERENCE_V2_INTEGRITY.sourceBlendSha256
  },
  integrity: SHINO_REFERENCE_V2_INTEGRITY,
  license: SHINO_MASTER.license,
  rigId: SHINO_MASTER.rigId,
  productionStage: SHINO_REFERENCE_V2_INTEGRITY.productionStage,
  modelingMode: SHINO_REFERENCE_V2_INTEGRITY.modelingMode,
  usage: 'dev-shared-dcc-candidate',
  productionReady: false,
  visualApproval: SHINO_REFERENCE_V2_INTEGRITY.visualApproval,
  procedural: false
});
