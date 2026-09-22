const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const ZERO = Object.freeze({ x: 0, z: 0 });
const PROBES = Object.freeze(Array.from({ length: 8 }, (_, i) => ({
  x: Math.cos(i * Math.PI / 4), z: Math.sin(i * Math.PI / 4),
})));

/** Keep the existing collision predicate authoritative; sweep, then spend only
 * the unconsumed displacement along its free tangent. Never shrink colliders. */
export function sweepAndSlide(position, dx, dz, canMoveTo, radius = .32, zone = 'village', interiorId = null) {
  const startX = position.x, startZ = position.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return { dx: 0, dz: 0, blocked: true };
  const distance = Math.hypot(dx, dz);
  // Bound both work and travel after a stalled frame; ordinary dash steps are much smaller.
  const scale = distance > 1.8 ? 1.8 / distance : 1;
  dx *= scale; dz *= scale;
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .075));
  const free = (x, z) => canMoveTo(x, z, radius, zone, interiorId);
  let blocked = false;
  for (let step = 0; step < count; step++) {
    let rx = dx / count, rz = dz / count;
    for (let contact = 0; contact < 3 && Math.hypot(rx, rz) > .00001; contact++) {
      if (free(position.x + rx, position.z + rz)) {
        position.x += rx; position.z += rz; break;
      }
      blocked = true;
      let lo = 0, hi = 1;
      for (let i = 0; i < 7; i++) {
        const t = (lo + hi) / 2;
        if (free(position.x + rx * t, position.z + rz * t)) lo = t;
        else hi = t;
      }
      const travel = Math.max(0, lo - .002);
      position.x += rx * travel; position.z += rz * travel;
      rx *= 1 - travel; rz *= 1 - travel;
      let nx = 0, nz = 0;
      for (const probe of PROBES) {
        if (free(position.x + probe.x * .035, position.z + probe.z * .035)) {
          nx += probe.x; nz += probe.z;
        }
      }
      const length = Math.hypot(nx, nz);
      if (length > .1) {
        nx /= length; nz /= length;
        const into = rx * nx + rz * nz;
        if (into < -.00001) {
          rx -= nx * into; rz -= nz * into;
          continue;
        }
      }
      // Tight corners can have no unique normal. Consume one safe component,
      // not two full moves (which would add speed on diagonals).
      const xFree = Math.abs(rx) > .00001 && free(position.x + rx, position.z);
      const zFree = Math.abs(rz) > .00001 && free(position.x, position.z + rz);
      if (xFree && (!zFree || Math.abs(rx) >= Math.abs(rz))) position.x += rx;
      else if (zFree) position.z += rz;
      break;
    }
  }
  return { dx: position.x - startX, dz: position.z - startZ, blocked };
}

/** Session-local velocity: it is deliberately not part of the saved life or
 * shared-world authority. The caller supplies the unchanged input/speed rules. */
export function createLocomotion({ canMoveTo, carried = false } = {}) {
  if (typeof canMoveTo !== 'function') throw new TypeError('Locomotion requires canMoveTo');
  let vx = 0, vz = 0, identity = '', lastX = 0, lastZ = 0, ready = false;
  const reset = () => { vx = vz = 0; ready = false; };
  function step({ state, direction = ZERO, speed = 0, dt = 0, enabled = true, radius = carried ? .42 : .32 } = {}) {
    const position = state?.position;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) { reset(); return { moved: false, speed: 0 }; }
    const zone = state.interior ? 'interior' : state.zone;
    const nextIdentity = `${state.id}:${state.generation}:${zone}:${state.interior?.buildingId || ''}:${state.phase}`;
    if (!ready || identity !== nextIdentity || Math.hypot(position.x - lastX, position.z - lastZ) > .35) vx = vz = 0;
    identity = nextIdentity; ready = true;
    dt = clamp(Number(dt) || 0, 0, .05);
    if (!enabled || state.down || state.ended || dt <= 0) {
      reset(); lastX = position.x; lastZ = position.z;
      return { moved: false, speed: 0 };
    }
    const tx = (Number(direction?.x) || 0) * Math.max(0, Number(speed) || 0);
    const tz = (Number(direction?.z) || 0) * Math.max(0, Number(speed) || 0);
    const hasIntent = Math.hypot(tx, tz) > .001;
    const tau = hasIntent ? (carried ? .15 : .085) : (carried ? .08 : .045);
    const decay = Math.exp(-dt / tau);
    // Analytic integration avoids frame-rate-dependent acceleration and braking distance.
    const dx = tx * dt + (vx - tx) * tau * (1 - decay);
    const dz = tz * dt + (vz - tz) * tau * (1 - decay);
    vx = tx + (vx - tx) * decay; vz = tz + (vz - tz) * decay;
    const motion = sweepAndSlide(position, dx, dz, canMoveTo, radius, zone, state.interior?.buildingId);
    const distance = Math.hypot(motion.dx, motion.dz), actualSpeed = distance / dt;
    if (motion.blocked) {
      // Remove velocity into the wall, rather than storing a spring that kicks
      // the character sideways as soon as the corner is cleared.
      if (distance < .0001) vx = vz = 0;
      else {
        const ux = motion.dx / distance, uz = motion.dz / distance;
        const along = Math.max(0, Math.min(actualSpeed, vx * ux + vz * uz));
        vx = ux * along; vz = uz * along;
      }
    }
    if (!hasIntent && Math.hypot(vx, vz) < .08) vx = vz = 0;
    const moved = distance > .0001;
    if (moved) {
      const yaw = Number(state.yaw) || 0, target = Math.atan2(motion.dx, motion.dz);
      const delta = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
      state.yaw = yaw + delta * (1 - Math.exp(-(carried ? 10 : 17) * dt));
    }
    lastX = position.x; lastZ = position.z;
    return { moved, speed: actualSpeed, blocked: motion.blocked };
  }
  return { step, reset };
}
