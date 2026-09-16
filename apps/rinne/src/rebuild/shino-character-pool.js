import { MASTER_ID, SHINO_REFERENCE_V2_RUNTIME } from '@soul/characters';
import { createShinoReferenceV2Pool, loadShinoReferenceV2Runtime } from '@soul/rendering/shino-reference-v2-runtime';

export function shinoRuntimeModelUrl(href) {
  return new URL('./simulator/assets/SHINO_REFERENCE_V2.vrm', href).href;
}

function familyPool(loaded, capacity) {
  const pool = createShinoReferenceV2Pool(loaded, { capacity });
  return Object.freeze({
    spawn(id, _modelId = null) {
      const actor = pool.spawn(id);
      actor.root.userData.characterFamily = MASTER_ID;
      actor.root.userData.characterModel = SHINO_REFERENCE_V2_RUNTIME.modelId;
      actor.root.userData.characterAsset = SHINO_REFERENCE_V2_RUNTIME.id;
      return actor;
    },
    despawn(id) { return pool.despawn(id); },
    stats() { return pool.stats(); },
    dispose() { pool.dispose(); }
  });
}

/**
 * Rinne keeps the existing three-pool ownership contract while all actors share the
 * same audited DCC template. Gameplay identity, equipment and motion stay outside it.
 */
export async function createShinoCharacterPools(renderer) {
  const url = shinoRuntimeModelUrl(location.href);
  const loaded = await loadShinoReferenceV2Runtime({
    url,
    renderer,
    transcoderPath: './basis/'
  });
  const pool = familyPool(loaded, 8);
  const peerPool = familyPool(loaded, 30);
  const motherPool = familyPool(loaded, 30);
  return Object.freeze({
    asset: SHINO_REFERENCE_V2_RUNTIME,
    audit: loaded.audit,
    pool,
    peerPool,
    motherPool,
    dispose() {
      pool.dispose();
      peerPool.dispose();
      motherPool.dispose();
    }
  });
}
