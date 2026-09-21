import { createCharacterModelWrapper } from '@soul/characters';
import { GLTFLoader } from '@soul/rendering';
import { createMasterCharacterPool } from '@soul/rendering/master-character';
import { kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';
import { RINNE_CHARACTER_RUNTIME } from './character-runtime-adapter.js';
import {
  RINNE_PROTAGONIST_BYTES,
  RINNE_PROTAGONIST_MODEL_ID,
  RINNE_PROTAGONIST_RUNTIME_ASSET,
  RINNE_PROTAGONIST_SHA256
} from './protagonist-runtime-asset.js';

const toHex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');

export async function verifyProtagonistRuntimeBytes(bytes) {
  if (!(bytes instanceof ArrayBuffer)) throw new Error('Protagonist runtime asset must be an ArrayBuffer');
  if (bytes.byteLength !== RINNE_PROTAGONIST_BYTES) {
    throw new Error(`Protagonist runtime byte length mismatch: ${bytes.byteLength} != ${RINNE_PROTAGONIST_BYTES}`);
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) throw new Error('WebCrypto SHA-256 is required for protagonist runtime integrity');
  const sha256 = toHex(await subtle.digest('SHA-256', bytes));
  if (sha256 !== RINNE_PROTAGONIST_SHA256) {
    throw new Error(`Protagonist runtime SHA-256 mismatch: ${sha256} != ${RINNE_PROTAGONIST_SHA256}`);
  }
  return Object.freeze({ sha256, bytes: bytes.byteLength });
}

async function loadTemplate(loader) {
  const response = await fetch(RINNE_PROTAGONIST_RUNTIME_ASSET.url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Protagonist runtime fetch failed: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const integrity = await verifyProtagonistRuntimeBytes(bytes);
  const gltf = await loader.parseAsync(bytes, './simulator/assets/');
  const metadata = gltf?.parser?.json?.asset?.extras?.rinneCharacter;
  if (metadata?.id !== RINNE_PROTAGONIST_MODEL_ID || metadata?.license !== 'CC0-1.0') {
    throw new Error('Protagonist runtime metadata does not match the adopted CC0 model');
  }
  const humanoid = kaykitHumanoidFromGLTF(gltf);
  return Object.freeze({ scene: gltf.scene, humanoid, integrity });
}

function stamp(actor, integrity) {
  Object.assign(actor.root.userData, {
    characterFamily: RINNE_CHARACTER_RUNTIME.family,
    characterModel: RINNE_PROTAGONIST_MODEL_ID,
    characterRuntimeAdapter: RINNE_CHARACTER_RUNTIME.id,
    characterRuntimeFormat: RINNE_CHARACTER_RUNTIME.format,
    characterRuntimeRig: RINNE_CHARACTER_RUNTIME.rigFamily,
    characterRuntimeState: RINNE_CHARACTER_RUNTIME.resolveState(),
    characterAssetSha256: integrity.sha256,
    characterAssetBytes: integrity.bytes,
    characterProductionStage: RINNE_PROTAGONIST_RUNTIME_ASSET.productionStage,
    characterVisualApproval: RINNE_PROTAGONIST_RUNTIME_ASSET.visualApproval
  });
}

export async function createProtagonistCharacterPool(renderer) {
  const loader = new GLTFLoader();
  loader.useCompressedTextures?.(renderer, { transcoderPath: './basis/' });
  try {
    const template = await loadTemplate(loader);
    const inner = createMasterCharacterPool({ template: template.scene, humanoid: template.humanoid, capacity: 2 });
    const pool = Object.freeze({
      spawn(id) {
        const actor = inner.spawn(id);
        stamp(actor, template.integrity);
        return createCharacterModelWrapper({
          actor,
          adapter: RINNE_CHARACTER_RUNTIME,
          modelId: RINNE_PROTAGONIST_MODEL_ID
        });
      },
      despawn(id) { return inner.despawn(id); },
      stats() { return inner.stats(); },
      dispose() { inner.dispose(); }
    });
    return Object.freeze({
      pool,
      asset: RINNE_PROTAGONIST_RUNTIME_ASSET,
      integrity: template.integrity,
      dispose() {
        pool.dispose();
        loader.disposeCompressedTextures?.();
      }
    });
  } catch (error) {
    loader.disposeCompressedTextures?.();
    throw error;
  }
}
