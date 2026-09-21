import { createCharacterModelWrapper } from '@soul/characters';
import { GLTFLoader } from '@soul/rendering';
import { createMasterCharacterPool } from '@soul/rendering/master-character';
import { kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';
import { RINNE_CHARACTER_RUNTIME } from './character-runtime-adapter.js';
import {
  RINNE_PROTAGONIST_BYTES,
  RINNE_PROTAGONIST_GIT_BLOB_SHA,
  RINNE_PROTAGONIST_MODEL_ID,
  RINNE_PROTAGONIST_RUNTIME_ASSET
} from './protagonist-runtime-asset.js';

const EMBEDDED_COMBAT_PROP=/\b(?:arrow|axe|blade|bow|crossbow|dagger|mace|quiver|shield|spear|staff|sword|wand|weapon)\b/i;
const toHex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');

function hideEmbeddedCombatProps(root) {
  let hidden = 0;
  root?.traverse?.(node => {
    if (!node?.isMesh) return;
    const materials = (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean);
    const signature = [node.name, node.geometry?.name, ...materials.map(material => material?.name)].filter(Boolean).join(' ').replace(/[_\-.]+/g, ' ');
    if (!EMBEDDED_COMBAT_PROP.test(signature)) return;
    node.visible = false;
    hidden++;
  });
  return hidden;
}

export async function verifyProtagonistRuntimeBytes(bytes) {
  if (!(bytes instanceof ArrayBuffer)) throw new Error('Protagonist runtime asset must be an ArrayBuffer');
  if (bytes.byteLength !== RINNE_PROTAGONIST_BYTES) {
    throw new Error(`Protagonist runtime byte length mismatch: ${bytes.byteLength} != ${RINNE_PROTAGONIST_BYTES}`);
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle?.digest) throw new Error('WebCrypto SHA-1 is required for protagonist runtime integrity');
  const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const payload = new Uint8Array(header.byteLength + bytes.byteLength);
  payload.set(header, 0);
  payload.set(new Uint8Array(bytes), header.byteLength);
  const gitBlobSha = toHex(await subtle.digest('SHA-1', payload));
  if (gitBlobSha !== RINNE_PROTAGONIST_GIT_BLOB_SHA) {
    throw new Error(`Protagonist runtime Git blob SHA-1 mismatch: ${gitBlobSha} != ${RINNE_PROTAGONIST_GIT_BLOB_SHA}`);
  }
  return Object.freeze({ gitBlobSha, bytes: bytes.byteLength });
}

async function loadTemplate(loader) {
  const response = await fetch(RINNE_PROTAGONIST_RUNTIME_ASSET.url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Protagonist runtime fetch failed: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const integrity = await verifyProtagonistRuntimeBytes(bytes);
  const gltf = await loader.parseAsync(bytes, './simulator/assets/kaykit/');
  const humanoid = kaykitHumanoidFromGLTF(gltf);
  const hiddenEmbeddedCombatProps = hideEmbeddedCombatProps(gltf.scene);
  return Object.freeze({ scene: gltf.scene, humanoid, integrity, hiddenEmbeddedCombatProps });
}

function stamp(actor, template) {
  Object.assign(actor.root.userData, {
    characterFamily: RINNE_CHARACTER_RUNTIME.family,
    characterModel: RINNE_PROTAGONIST_MODEL_ID,
    characterRuntimeAdapter: RINNE_CHARACTER_RUNTIME.id,
    characterRuntimeFormat: RINNE_CHARACTER_RUNTIME.format,
    characterRuntimeRig: RINNE_CHARACTER_RUNTIME.rigFamily,
    characterRuntimeState: RINNE_CHARACTER_RUNTIME.resolveState(),
    characterAssetGitBlobSha: template.integrity.gitBlobSha,
    characterAssetBytes: template.integrity.bytes,
    characterEmbeddedCombatPropsHidden: template.hiddenEmbeddedCombatProps,
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
        stamp(actor, template);
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
