import { Box3, Vector3 } from 'three';
export { createCameraSelfVisibility } from './camera-self-visibility.js';
import { cameraSubject } from './camera-director.js';

/** THREE boundary only. A future 2.5D subject can provide the same bounds directly. */
export function applyCameraPresentation(camera, state) {
  if (!camera?.isPerspectiveCamera) throw new TypeError('Presentation camera must be perspective');
  camera.position.set(state.position.x, state.position.y, state.position.z);
  camera.lookAt(state.lookTarget.x, state.lookTarget.y, state.lookTarget.z);
  if (Math.abs(camera.fov - state.fov) > .001) { camera.fov = state.fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);
}

export function measureCameraSubject(root, { id, position, yaw, fallbackHeight = 2, weaponRadius = 0 } = {}) {
  const box = new Box3();
  if (root) { root.updateWorldMatrix(true, true); box.setFromObject(root); }
  const height = box.isEmpty() ? fallbackHeight : Math.max(.1, box.max.y - box.min.y);
  return cameraSubject({ id, position: position || root?.position, yaw: yaw ?? root?.rotation?.y,
    height, focusHeight: height * .58, radius: box.isEmpty() ? height * .3 : Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * .5, weaponRadius });
}

/** World-space samples are also the extension point for authored 2.5D silhouettes. */
export function actorSilhouetteSamples(subject) {
  if (subject.silhouetteSamples?.length) return subject.silhouetteSamples.slice(0, 8);
  const { position: p, height } = cameraSubject(subject);
  return [.12, .55, .95].map(t => ({ x: p.x, y: p.y + height * t, z: p.z }));
}

export function actorScreenSafety(camera, subjects = [], occludedRatio = 0) {
  camera.updateMatrixWorld(true);
  const rows = subjects.map(value => {
    const s = cameraSubject(value), points = [], p = s.position, r = Math.max(s.radius, s.weaponRadius);
    for (const dx of [-r, r]) for (const y of [0, s.height]) for (const dz of [-r, r]) {
      const v = new Vector3(p.x + dx, p.y + y, p.z + dz).project(camera); points.push(v);
    }
    const x0 = Math.min(...points.map(v => (v.x + 1) / 2)), x1 = Math.max(...points.map(v => (v.x + 1) / 2));
    const y0 = Math.min(...points.map(v => (1 - v.y) / 2)), y1 = Math.max(...points.map(v => (1 - v.y) / 2));
    return { id: s.id, rect: { x0, x1, y0, y1 }, screenHeight: y1 - y0,
      edgeMargin: Math.min(x0, y0, 1 - x1, 1 - y1), inFront: points.every(v => v.z >= -1 && v.z <= 1) };
  });
  const overlaps = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i].rect, b = rows[j].rect;
    const area = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    overlaps.push({ actors: [rows[i].id, rows[j].id], ratio: area / Math.max(.000001, Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0))) });
  }
  return { actors: rows, overlaps, occludedRatio, units: 'viewport-fraction' };
}
