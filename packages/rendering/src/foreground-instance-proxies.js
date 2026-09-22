import { Matrix4, Mesh, Color } from 'three';

/** Encounter-only instance proxies: fade a tree part, never its entire forest batch.
 * Geometry stays shared; the original instance matrix/material/color is restored.
 * No shader patches, persistent geometry copies or changed instance IDs.
 */
export function createForegroundInstanceProxies({ limit = 64 } = {}) {
  const rows = new Map(), hidden = new Matrix4().makeScale(0, 0, 0);
  const set = (row, matrix) => { row.source.setMatrixAt(row.id, matrix); row.source.instanceMatrix.needsUpdate = true; };
  return {
    prepareSampling() { for (const row of rows.values()) { set(row, row.matrix); row.proxy.visible = false; } },
    proxyFor(source, id) {
      if (!source?.isInstancedMesh || !source.parent || !Number.isInteger(id)) return null;
      const key = `${source.uuid}:${id}`;
      let row = rows.get(key);
      if (!row) {
        if (rows.size >= limit) return null;
        const matrix = new Matrix4(); source.getMatrixAt(id, matrix);
        let material = source.material, owned = [];
        if (source.instanceColor) {
          const tint = new Color(); source.getColorAt(id, tint);
          owned = (Array.isArray(material) ? material : [material]).map(m => { const clone = m.clone(); clone.onBeforeCompile = m.onBeforeCompile; if (Object.hasOwn(m, 'customProgramCacheKey')) clone.customProgramCacheKey = m.customProgramCacheKey; clone.color?.multiply(tint); return clone; });
          material = Array.isArray(material) ? owned : owned[0];
        }
        const proxy = new Mesh(source.geometry, material);
        proxy.name = `ForegroundInstance:${key}`; proxy.matrixAutoUpdate = false;
        proxy.matrix.multiplyMatrices(source.matrix, matrix); proxy.castShadow = source.castShadow; proxy.receiveShadow = source.receiveShadow;
        proxy.userData.occlusionFadeDisabled = true; proxy.userData.foregroundInstanceKey = key;
        source.parent.add(proxy); proxy.updateWorldMatrix(true, false);
        row = { source, id, matrix, proxy, owned }; rows.set(key, row);
      }
      return row.proxy;
    },
    maskSources() { for (const row of rows.values()) { set(row, hidden); row.proxy.visible = row.source.visible; } },
    release(proxy) {
      const key = proxy?.userData?.foregroundInstanceKey, row = rows.get(key);
      if (!row) return;
      set(row, row.matrix); row.proxy.removeFromParent(); for (const material of row.owned) material.dispose(); rows.delete(key);
    },
    dispose() { for (const row of [...rows.values()]) this.release(row.proxy); },
    get size() { return rows.size; },
  };
}
