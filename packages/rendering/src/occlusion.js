import { Box3, Raycaster, Vector3 } from 'three';

const center = new Vector3(), cameraPosition = new Vector3(), target = new Vector3();

function candidateSamples(object) {
  const box = new Box3().setFromObject(object);
  if (box.isEmpty()) return [];
  const min = box.min, max = box.max, c = box.getCenter(new Vector3());
  return [
    c,
    new Vector3(min.x, c.y, min.z),
    new Vector3(max.x, c.y, min.z),
    new Vector3(min.x, c.y, max.z),
    new Vector3(max.x, c.y, max.z),
  ];
}

/**
 * Conservative CPU occlusion culler for static set dressing.
 * A candidate is hidden only when every sampled ray is blocked by a registered
 * solid occluder before reaching the candidate. Visibility changed by another
 * system (streaming/gameplay) is never force-restored by this culler.
 */
export function createConservativeOcclusionCuller({ maxChecksPerUpdate = 8, minDistance = 18, hiddenConfirmations = 2 } = {}) {
  const raycaster = new Raycaster();
  let cursor = 0, tested = 0, hidden = 0, visible = 0;
  const state = new WeakMap();

  function blocked(camera, object, occluders) {
    camera.getWorldPosition(cameraPosition);
    const samples = candidateSamples(object);
    if (!samples.length) return false;
    object.getWorldPosition(center);
    if (center.distanceTo(cameraPosition) < minDistance) return false;
    for (const point of samples) {
      target.copy(point).sub(cameraPosition);
      const distance = target.length();
      if (distance <= 1e-4) return false;
      raycaster.set(cameraPosition, target.multiplyScalar(1 / distance));
      raycaster.far = Math.max(0, distance - .08);
      const hits = raycaster.intersectObjects(occluders, true);
      if (!hits.some(hit => hit.object?.visible !== false)) return false;
    }
    return true;
  }

  return {
    update({ camera, candidates = [], occluders = [] } = {}) {
      if (!camera || !candidates.length || !occluders.length) return snapshot();
      const count = Math.min(maxChecksPerUpdate, candidates.length);
      for (let i = 0; i < count; i++) {
        const object = candidates[(cursor + i) % candidates.length];
        if (!object || object.userData?.streamingCritical || object.userData?.occlusionDisabled) continue;
        const row = state.get(object) || { blocked: 0, ownedHidden: false };
        if (object.visible === false && !row.ownedHidden) { row.blocked = 0; state.set(object, row); continue; }
        const isBlocked = blocked(camera, object, occluders);
        tested++;
        if (isBlocked) {
          row.blocked++;
          if (row.blocked >= hiddenConfirmations) { object.visible = false; row.ownedHidden = true; object.userData.occluded = true; hidden++; }
        } else {
          row.blocked = 0;
          if (row.ownedHidden) object.visible = true;
          row.ownedHidden = false; object.userData.occluded = false; visible++;
        }
        state.set(object, row);
      }
      cursor = (cursor + count) % Math.max(1, candidates.length);
      return snapshot();
    },
    revealAll(candidates = []) {
      for (const object of candidates) {
        const row = state.get(object);
        if (object && row?.ownedHidden) { object.visible = true; row.ownedHidden = false; row.blocked = 0; if (object.userData) object.userData.occluded = false; }
      }
    },
    snapshot() { return Object.freeze({ tested, hidden, visible, cursor }); },
  };
}
