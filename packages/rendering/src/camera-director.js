import { add, subtract, mix, point, length, finite, clamp, radians, orbit, orbitPosition, angleDelta, dampAngle, damping, normalizeAngle } from './camera/math.js';
import { presentationAnchor } from './character-view-resolver.js';
export { normalizeAngle, angleDelta } from './camera/math.js';

const SAFE = Object.freeze({ pitch: Object.freeze([radians(20), radians(46)]), distance: Object.freeze([8, 48]), edgeMargin: .065 });
export const CAMERA_PROFILES = Object.freeze({
  current3d: Object.freeze({ fov: 40, referenceFov: 43, yawPolicy: 'free', interior: 'interiorFirstPerson', safeViewRange: SAFE }),
  hybrid25dReady: Object.freeze({ fov: 34, referenceFov: 43, yawPolicy: 'free', interior: 'interiorThirdPerson', safeViewRange: SAFE }),
});
const RATES = Object.freeze({ exploration: [6.9, 9.2, 6], combat: [5.6, 7.2, 6], conversation: [4, 5, 4], interior: [13.5, 15, 7], title: [12, 12, 8], event: [5, 6, 5], cinematic: [5, 6, 5] });

/** Generic subject dimensions; caller supplies bounds for humans, creatures, props or 2.5D. */
export function cameraSubject(value = {}) {
  const position = point(value.position || value), height = Math.max(.1, finite(value.height, 2));
  return { ...value, position, height, focusHeight: finite(value.focusHeight, height * .58),
    radius: Math.max(.05, finite(value.radius, height * .3)), weaponRadius: Math.max(0, finite(value.weaponRadius)) };
}
const focus = subject => add(subject.position, { x: 0, y: subject.focusHeight, z: 0 });
function lensScale(profile) { return Math.tan(radians(profile.referenceFov) / 2) / Math.tan(radians(profile.fov) / 2); }

/** Mode policy only. A shot NEVER mutates an actor, movement, equipment or save state. */
export function selectCameraShot(input = {}, profile = CAMERA_PROFILES.current3d) {
  const actor = cameraSubject(input.actor), opponent = input.target ? cameraSubject(input.target) : null;
  const mode = input.mode || (input.title ? 'title' : input.interior ? 'interior' : input.combatFrame ? 'combat' : 'exploration');
  const target = focus(actor), fov = finite(input.fov, profile.fov), yaw = finite(input.yaw, Math.atan2(10.5, 14.5));
  const framing = { lateralOffset: finite(input.framing?.lateralOffset), yawBias: finite(input.framing?.yawBias), zoom: clamp(finite(input.framing?.zoom, 1), .6, 2) };
  let shot;
  if (input.authoredShot) {
    shot = { ...input.authoredShot, position: point(input.authoredShot.position), lookTarget: point(input.authoredShot.lookTarget), fov: finite(input.authoredShot.fov, fov) };
  } else if (mode === 'interior' && (input.interiorPolicy || profile.interior) === 'interiorFirstPerson') {
    const heading = finite(actor.yaw), eye = Math.max(.35, actor.height * .86), forward = { x: Math.sin(heading), y: 0, z: Math.cos(heading) };
    const position = add(actor.position, { x: forward.x * .08, y: eye, z: forward.z * .08 });
    shot = { position, lookTarget: add(position, { x: forward.x * 4.2, y: -.03, z: forward.z * 4.2 }), fov: 43, interiorPolicy: 'interiorFirstPerson', pivot: 'eye', selfVisibility: 'firstPerson' };
  } else if (mode === 'interior') {
    const variant = input.interiorPolicy || profile.interior;
    const pitch = variant === 'interiorDiorama' ? radians(44) : variant === 'interiorCutaway' ? radians(38) : radians(25);
    shot = { position: orbitPosition(target, yaw, pitch, Math.max(actor.height * 2.5, 4)), lookTarget: target, fov: 43, interiorPolicy: variant };
  } else if (mode === 'combat' && input.combatFrame) {
    const frame = input.combatFrame, base = frame.offset || subtract(frame.camera, frame.look);
    const center = point(frame.look), polar = orbit(add(center, base), center);
    let bias = framing.yawBias;
    if (opponent) {
      const axis = Math.atan2(opponent.position.x - actor.position.x, opponent.position.z - actor.position.z);
      const relative = angleDelta(polar.yaw + finite(input.yawOffset), axis);
      if (Math.abs(Math.sin(relative)) < .48) bias += (Math.cos(relative) >= 0 ? -1 : 1) * radians(20);
      center.y = (target.y + focus(opponent).y) * .5;
    }
    const finalYaw = polar.yaw + finite(input.yawOffset) + bias;
    const lookTarget = add(center, { x: Math.cos(finalYaw) * framing.lateralOffset, y: 0, z: -Math.sin(finalYaw) * framing.lateralOffset });
    shot = { position: orbitPosition(lookTarget, finalYaw, polar.pitch, polar.distance * lensScale(profile) * framing.zoom), lookTarget, fov, framing: { ...framing, yawBias: bias } };
  } else if (mode === 'conversation' && opponent) {
    const center = mix(target, focus(opponent), .5), separation = length(subtract(actor.position, opponent.position));
    const a = finite(actor.yaw) + radians(40), b = finite(actor.yaw) - radians(40);
    const quarter = Math.abs(angleDelta(yaw, a)) <= Math.abs(angleDelta(yaw, b)) ? a : b;
    const distance = Math.max(actor.height, opponent.height) * 3 + separation * .55;
    shot = { position: orbitPosition(center, quarter, radians(20), distance), lookTarget: center, fov: Math.min(fov, 38) };
  } else {
    const offset = point(input.offset || { x: 10.5, y: 11.5, z: 14.5 }), polar = orbit(offset, point());
    const pitch = clamp(polar.pitch, ...profile.safeViewRange.pitch);
    shot = { position: orbitPosition(target, yaw + framing.yawBias, pitch, clamp(polar.distance * lensScale(profile) * framing.zoom, ...profile.safeViewRange.distance)), lookTarget: target, fov };
  }
  if (!input.authoredShot && shot.interiorPolicy !== 'interiorFirstPerson') {
    const subjects = opponent && ['combat', 'conversation'].includes(mode) ? [actor, opponent] : [actor];
    const horizontalFov = 2 * Math.atan(Math.tan(radians(shot.fov) / 2) * Math.max(.2, finite(input.aspect, 1)));
    const fitFov = Math.min(radians(shot.fov), horizontalFov), margin = 1 - profile.safeViewRange.edgeMargin * 2;
    const radius = Math.max(...subjects.map(s => length(subtract(focus(s), shot.lookTarget)) + Math.hypot(Math.max(s.radius, s.weaponRadius) * Math.SQRT2, Math.max(s.focusHeight, s.height - s.focusHeight))));
    const polar = orbit(shot.position, shot.lookTarget);
    const minimum = radius / Math.max(.04, Math.sin(fitFov / 2) * margin);
    if (minimum > polar.distance) shot.position = orbitPosition(shot.lookTarget, polar.yaw, polar.pitch, minimum);
  }
  return { ...shot, mode, targetActor: actor.id || null, focusActors: opponent ? [actor.id, opponent.id] : [actor.id], safeViewRange: profile.safeViewRange };
}

/**
 * Camera Director owns shot policies and one transition state, independent of THREE.
 * Different coordinate spaces rebase the old pose around the subject before damping:
 * a room origin change is not a cinematic pan through unrelated world coordinates.
 */
export function createCameraDirector({ profile: profileName = 'current3d', yawPolicy, policies = {} } = {}) {
  let profile = CAMERA_PROFILES[profileName];
  if (!profile) throw new RangeError(`Unknown camera profile: ${profileName}`);
  let state = null, center = null, previousAnchor = null, previousSpace = null, age = .6, viewAnchor;
  const registry = new Map(Object.entries(policies));
  return {
    setProfile(name) { if (!CAMERA_PROFILES[name]) throw new RangeError(`Unknown camera profile: ${name}`); profileName = name; profile = CAMERA_PROFILES[name]; },
    registerShot(mode, resolver) { if (typeof resolver !== 'function') throw new TypeError('Shot resolver must be a function'); registry.set(mode, resolver); return () => registry.delete(mode); },
    update(input = {}, dt = 0) {
      const actor = cameraSubject(input.actor), anchor = actor.position, space = input.space || 'world';
      const shot = registry.has(input.mode) ? registry.get(input.mode)(input, profile) : selectCameraShot(input, profile);
      if (!shot?.position || !shot?.lookTarget) throw new TypeError('Camera shot requires position and lookTarget');
      const desired = orbit(shot.position, shot.lookTarget), policy = input.yawPolicy || yawPolicy || profile.yawPolicy;
      if (!['free', 'softSnap', 'hardSnap'].includes(policy)) throw new RangeError(`Unknown yaw policy: ${policy}`);
      const anchorYaw = presentationAnchor(desired.yaw, viewAnchor);
      if (!input.authoredShot && modeAllowsYaw(shot)) {
        if (policy === 'hardSnap') desired.yaw = anchorYaw;
        if (policy === 'softSnap') desired.yaw = dampAngle(desired.yaw, anchorYaw, .35);
      }
      let rebased = false;
      if (state && previousSpace !== space && previousAnchor) {
        const shift = subtract(anchor, previousAnchor);
        state = { ...state, position: add(state.position, shift), lookTarget: add(state.lookTarget, shift) };
        center = add(center, shift); rebased = true;
      }
      const changed = state && (state.mode !== shot.mode || state.interiorPolicy !== shot.interiorPolicy || state.profile !== profileName);
      if (changed) age = 0;
      else age += clamp(finite(dt), 0, .1);
      const [positionRate, lookRate, lensRate] = RATES[shot.mode] || RATES.event;
      const a = damping(positionRate, dt), b = damping(lookRate, dt), c = damping(lensRate, dt);
      if (!state) {
        center = point(shot.lookTarget);
        state = { ...shot, position: orbitPosition(center, desired.yaw, desired.pitch, desired.distance), lookTarget: point(shot.lookTarget), ...desired, fov: shot.fov, transition: { progress: 1, from: shot.mode, to: shot.mode, rebased: false } };
      } else {
        center = mix(center, shot.lookTarget, a);
        const turn = angleDelta(state.yaw, desired.yaw) * a, maxTurn = (shot.mode === 'title' ? 8 : 4) * clamp(finite(dt), 0, .1);
        const yaw = normalizeAngle(state.yaw + clamp(turn, -maxTurn, maxTurn)), pitch = state.pitch + (desired.pitch - state.pitch) * a;
        const distance = state.distance + (desired.distance - state.distance) * a;
        const position = shot.pivot === 'eye' ? mix(state.position, shot.position, a) : orbitPosition(center, yaw, pitch, distance);
        const lookTarget = shot.pivot === 'eye' ? orbitPosition(position, yaw + Math.PI, -pitch, distance) : mix(state.lookTarget, shot.lookTarget, b);
        if (shot.pivot === 'eye') center = point(lookTarget);
        state = { ...shot, yaw, pitch, distance, position, lookTarget,
          fov: state.fov + (shot.fov - state.fov) * c,
          transition: { progress: clamp(age / .6, 0, 1), from: changed ? state.mode : state.transition.from, to: shot.mode, rebased } };
      }
      state.profile = profileName; state.continuousCameraYaw = state.yaw; viewAnchor = presentationAnchor(state.yaw, viewAnchor); state.presentationYaw = viewAnchor;
      state.yawPolicy = policy; state.screenSafety = input.screenSafety || null;
      previousAnchor = point(anchor); previousSpace = space;
      return state;
    },
    snapshot() { return state ? structuredClone(state) : null; },
    reset() { state = null; center = null; previousAnchor = null; previousSpace = null; age = .6; viewAnchor = undefined; },
  };
}
function modeAllowsYaw(shot) { return shot.mode !== 'interior' || shot.interiorPolicy !== 'interiorFirstPerson'; }
