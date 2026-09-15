import { Box3, Sphere, Vector3 } from 'three';

const key = (x, z, size) => `${Math.floor(x / size)},${Math.floor(z / size)}`;

export function createWorldCellStreamingPlan({ cellSize = 32, preloadRadius = 2, retainRadius = 3 } = {}) {
  if (!(cellSize > 0) || preloadRadius < 0 || retainRadius < preloadRadius) throw new Error('Invalid world streaming configuration');
  let loaded = new Set();
  return {
    update(x, z) {
      if (![x, z].every(Number.isFinite)) throw new Error('Invalid world streaming focus');
      const cx = Math.floor(x / cellSize), cz = Math.floor(z / cellSize), wanted = new Set(), retained = new Set();
      for (let dz = -retainRadius; dz <= retainRadius; dz++) for (let dx = -retainRadius; dx <= retainRadius; dx++) retained.add(`${cx + dx},${cz + dz}`);
      for (let dz = -preloadRadius; dz <= preloadRadius; dz++) for (let dx = -preloadRadius; dx <= preloadRadius; dx++) wanted.add(`${cx + dx},${cz + dz}`);
      const load = [...wanted].filter(id => !loaded.has(id));
      const unload = [...loaded].filter(id => !retained.has(id));
      for (const id of load) loaded.add(id); for (const id of unload) loaded.delete(id);
      return Object.freeze({ center: key(x, z, cellSize), load, unload, loaded: [...loaded] });
    },
    snapshot: () => Object.freeze({ loaded: [...loaded] }),
    reset() { loaded = new Set(); },
  };
}

export function createVisualDistanceStreamer({ baseDistance = 150, hysteresis = 12 } = {}) {
  if (!(baseDistance > 0) || !(hysteresis >= 0)) throw new Error('Invalid visual streamer configuration');
  const states = new WeakMap(), bounds = new WeakMap(), box = new Box3(), sphere = new Sphere(), focusPoint = new Vector3();
  const metrics = child => {
    if (bounds.has(child)) return bounds.get(child);
    child.updateWorldMatrix?.(true,true); box.setFromObject(child);
    if (box.isEmpty()) { const value={center:new Vector3(child.position?.x||0,child.position?.y||0,child.position?.z||0),radius:0};bounds.set(child,value);return value; }
    box.getBoundingSphere(sphere); const value={center:sphere.center.clone(),radius:sphere.radius};bounds.set(child,value);return value;
  };
  return {
    update(root, focus, distanceScale = 1) {
      if (!root?.children || !focus) return { tracked: 0, hidden: 0, skipped: 0 };
      const limit = Math.max(1, baseDistance * distanceScale); let tracked = 0, hidden = 0, skipped = 0;
      focusPoint.set(Number(focus.x)||0,Number(focus.y)||0,Number(focus.z)||0);
      for (const child of root.children) {
        if (child.userData?.streamingCritical || child.userData?.interactive || child.userData?.stylizedStreamable === false || (!states.has(child) && child.visible === false && child.userData?.occluded !== true)) { skipped++; continue; }
        const metric=metrics(child); if(metric.radius>baseDistance*.72){skipped++;continue;}
        const distance=Math.hypot(metric.center.x-focusPoint.x,metric.center.z-focusPoint.z),wasVisible=states.get(child)??true;
        const threshold=wasVisible?limit+metric.radius:Math.max(1,limit-hysteresis+metric.radius),visible=distance<=threshold;
        states.set(child,visible);
        child.userData=child.userData||{};
        child.userData.visualStreamManaged=true;
        child.userData.visualStreamVisible=visible;
        child.visible=visible && child.userData.occluded !== true;
        tracked++;if(!visible)hidden++;
      }
      return {tracked,hidden,skipped,distance:limit};
    },
    invalidate(child){if(child){bounds.delete(child);states.delete(child);delete child.userData?.visualStreamManaged;delete child.userData?.visualStreamVisible;}},
  };
}
