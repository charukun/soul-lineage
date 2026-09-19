const caches = new WeakMap();

/** Reuse deterministic density samples and only upload matrices whose visibility changes. */
export function updateVegetationDensity(mesh, target, scale, { densityAtDistance, rankAtIndex, hiddenMatrix }) {
  const base = mesh.userData.stylizedDensityBase;
  if (!base?.length) return 0;
  let cache = caches.get(mesh);
  if (!cache || cache.base !== base) {
    cache = { base, x: new Float64Array(base.length), z: new Float64Array(base.length), rank: new Float64Array(base.length), visible: new Uint8Array(base.length).fill(1) };
    for (let i = 0; i < base.length; i++) {
      cache.x[i] = base[i].elements[12];
      cache.z[i] = base[i].elements[14];
      cache.rank[i] = rankAtIndex(i);
    }
    caches.set(mesh, cache);
  }
  let writes = 0;
  for (let i = 0; i < base.length; i++) {
    const distance = Math.hypot(cache.x[i] - target.x, cache.z[i] - target.z);
    const visible = cache.rank[i] <= densityAtDistance(distance) * scale ? 1 : 0;
    if (cache.visible[i] === visible) continue;
    mesh.setMatrixAt(i, visible ? base[i] : hiddenMatrix);
    cache.visible[i] = visible;
    writes++;
  }
  if (writes) mesh.instanceMatrix.needsUpdate = true;
  return writes;
}
