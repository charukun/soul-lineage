import {
  SHINO_REFERENCE_V2_BYTES,
  SHINO_REFERENCE_V2_INTEGRITY,
  SHINO_REFERENCE_V2_SHA256,
  auditCharacterRuntimeDocument
} from '@soul/characters';
import { createCompressedGLTFLoader } from './compressed-gltf.js';
import { createShinoProductionPool, shinoProductionRigFromGLTF } from './master-character-production-stylized.js';

const MAX_MODEL_BYTES = 32 * 1024 * 1024;

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function validateDeclaredSize(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared !== SHINO_REFERENCE_V2_BYTES) {
    throw new Error(`Shino Reference v2 content-length mismatch: ${declared}`);
  }
}

/**
 * Load and audit the exact repository-owned Shino Reference v2 bytes.
 * The parsed scene remains loader-independent after parse; the KTX2/Meshopt helper can
 * be disposed immediately while the returned glTF graph is retained by character pools.
 */
export async function loadShinoReferenceV2Runtime({
  url,
  renderer = null,
  transcoderPath = '/basis/',
  timeoutMs = 20_000
} = {}) {
  if (typeof url !== 'string' || !url.length) throw new Error('Shino Reference v2 URL is required');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) throw new Error('Invalid Shino Reference v2 timeout');
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Shino Reference v2 HTTP ${response.status}`);
  validateDeclaredSize(response);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== SHINO_REFERENCE_V2_BYTES || bytes.byteLength > MAX_MODEL_BYTES) {
    throw new Error(`Shino Reference v2 size mismatch: ${bytes.byteLength}`);
  }
  const hash = await sha256Hex(bytes);
  if (hash !== SHINO_REFERENCE_V2_SHA256) throw new Error('Shino Reference v2 hash mismatch');

  const loader = createCompressedGLTFLoader({ renderer, transcoderPath });
  try {
    const gltf = await loader.parseAsync(bytes, url);
    const audit = auditCharacterRuntimeDocument(
      gltf?.parser?.json,
      hash,
      bytes.byteLength,
      SHINO_REFERENCE_V2_INTEGRITY
    );
    if (!audit.approved) throw new Error(`Shino Reference v2 audit failed: ${audit.errors.join(',')}`);
    const rig = await shinoProductionRigFromGLTF(gltf);
    return Object.freeze({
      url,
      gltf,
      rig,
      audit,
      sha256: hash,
      byteLength: bytes.byteLength,
      compression: Object.freeze({ meshopt: true, ktx2: Boolean(renderer) })
    });
  } finally {
    loader.dispose();
  }
}

export function createShinoReferenceV2Pool(loaded, { capacity = 30 } = {}) {
  if (!loaded?.gltf?.scene || !loaded?.rig || loaded?.audit?.approved !== true) {
    throw new Error('Audited Shino Reference v2 runtime is required');
  }
  return createShinoProductionPool({
    template: loaded.gltf.scene,
    humanoid: loaded.rig.humanoid,
    rig: loaded.rig,
    capacity
  });
}
