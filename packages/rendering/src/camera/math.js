/** Camera-only math. Radians, +Y up, actor forward +Z. No renderer/runtime dependency. */
export const TAU = Math.PI * 2;
export const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const radians = degrees => degrees * Math.PI / 180;
export function normalizeAngle(angle) { return ((finite(angle) + Math.PI) % TAU + TAU) % TAU - Math.PI; }
export const angleDelta = (from, to) => normalizeAngle(to - from);
export const dampAngle = (from, to, alpha) => normalizeAngle(from + angleDelta(from, to) * alpha);
export const damping = (rate, dt) => 1 - Math.exp(-Math.max(0, finite(rate)) * clamp(finite(dt), 0, .1));
export const point = value => ({ x: finite(value?.x), y: finite(value?.y), z: finite(value?.z) });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, value) => ({ x: a.x * value, y: a.y * value, z: a.z * value });
export const mix = (a, b, t) => add(a, scale(subtract(b, a), t));
export const length = a => Math.hypot(a.x, a.y, a.z);
export function orbit(position, target) {
  const delta = subtract(position, target), horizontal = Math.hypot(delta.x, delta.z);
  return { yaw: Math.atan2(delta.x, delta.z), pitch: Math.atan2(delta.y, horizontal), distance: Math.max(.02, length(delta)) };
}
export function orbitPosition(target, yaw, pitch, distance) {
  const horizontal = Math.cos(pitch) * distance;
  return add(target, { x: Math.sin(yaw) * horizontal, y: Math.sin(pitch) * distance, z: Math.cos(yaw) * horizontal });
}
