import { point, finite, radians, orbit, orbitPosition, clamp } from './camera/math.js';

/** Adapt an authored external renderer frame to the same perspective contract.
 * worldHeight is optional: a legacy orthographic renderer can preserve its focal
 * plane coverage without retaining an orthographic camera in RINNE.
 */
export function externalCameraShot({ position, lookTarget, worldHeight, fov = 40, yawOffset = 0 } = {}) {
  const target = point(lookTarget), polar = orbit(point(position), target), lens = clamp(finite(fov, 40), 15, 80);
  const distance = Number.isFinite(worldHeight) && worldHeight > 0 ? worldHeight / (2 * Math.tan(radians(lens) / 2)) : polar.distance;
  return { position: orbitPosition(target, polar.yaw + finite(yawOffset), polar.pitch, distance), lookTarget: target, fov: lens };
}
