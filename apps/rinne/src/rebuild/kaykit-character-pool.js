import { KAYKIT_DEFAULT_MODEL_ID, KAYKIT_MODELS, selectKaykitModel } from '@soul/characters';
import { GLTFLoader } from '@soul/rendering';
import { createMasterCharacterPool } from '@soul/rendering/master-character';
import { kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';

function fallbackModelId(actorId) {
  const text = String(actorId || 'actor');
  if (text.includes('mother')) return 'kaykit.rogue-hooded.v1';
  if (text.includes('hero')) return KAYKIT_DEFAULT_MODEL_ID;
  return selectKaykitModel({ kind: 'actor', key: text }).id;
}

function familyPool(templates, capacity) {
  const pools = new Map(KAYKIT_MODELS.map(model => [model.id, createMasterCharacterPool({
    template: templates.get(model.id).scene,
    humanoid: templates.get(model.id).humanoid,
    capacity
  })]));
  const owners = new Map();
  return Object.freeze({
    spawn(id, modelId = null) {
      if (owners.has(id)) throw new Error(`KayKit actor already spawned: ${id}`);
      const selected = modelId || fallbackModelId(id), pool = pools.get(selected);
      if (!pool) throw new Error(`Unknown KayKit runtime model: ${selected}`);
      const actor = pool.spawn(id); owners.set(id, selected); actor.root.userData.characterFamily = 'kaykit.adventurers.v1'; actor.root.userData.characterModel = selected; return actor;
    },
    despawn(id) {
      const modelId = owners.get(id); if (!modelId) return false;
      owners.delete(id); return pools.get(modelId).despawn(id);
    },
    stats() {
      const rows = [...pools.values()].map(pool => pool.stats());
      return rows.reduce((sum, row) => ({
        active: sum.active + row.active,
        allocated: sum.allocated + row.allocated,
        meshes: sum.meshes + row.meshes,
        geometries: sum.geometries + row.geometries,
        textures: sum.textures + row.textures,
        materials: sum.materials + row.materials
      }), { active: 0, allocated: 0, meshes: 0, geometries: 0, textures: 0, materials: 0 });
    },
    dispose() { owners.clear(); for (const pool of pools.values()) pool.dispose(); }
  });
}

/** Load the pinned/localized KayKit cast once, then expose the same pool contract used by gameplay. */
export async function createKaykitCharacterPools(renderer) {
  const loader = new GLTFLoader();
  loader.useCompressedTextures?.(renderer, { transcoderPath: './basis/' });
  const templates = new Map();
  try {
    for (const model of KAYKIT_MODELS) {
      const gltf = await loader.loadAsync(model.runtime.url);
      const humanoid = kaykitHumanoidFromGLTF(gltf);
      templates.set(model.id, Object.freeze({ scene: gltf.scene, humanoid }));
    }
  } catch (error) {
    loader.disposeCompressedTextures?.();
    throw error;
  }
  return Object.freeze({
    pool: familyPool(templates, 8),
    peerPool: familyPool(templates, 30),
    motherPool: familyPool(templates, 30),
    dispose() {
      this.pool.dispose(); this.peerPool.dispose(); this.motherPool.dispose(); loader.disposeCompressedTextures?.();
    }
  });
}
