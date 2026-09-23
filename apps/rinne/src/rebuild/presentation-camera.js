import { tiltCameraOffsetForZoom } from '@soul/rendering/snap-camera-control';
import { createCameraDirector, CAMERA_PROFILES, cameraSubject, externalCameraShot } from '@soul/rendering/camera-director';
import { resolveCharacterView } from '@soul/rendering/character-view-resolver';
import { applyCameraPresentation, measureCameraSubject, actorScreenSafety, actorSilhouetteSamples, createCameraSelfVisibility } from '@soul/rendering/camera-presentation-three';

const weaponRadius = id => ({ spear: 1.8, great: 1.5, staff: 1.6, sword: 1.1, axe: 1.2 }[id] || .6);

/** RINNE adapter: game state -> shared director. Never owns character transforms. */
export function createRinnePresentationCamera({ camera, scene, canvas }) {
  const director = createCameraDirector({ profile: 'current3d' });
  let profileName = 'current3d';
  let yawOffset = 0, userZoom = 1, playerView = null, shotOverride = null, subjectProvider = null, screenSafety = null;
  let subjectCache = null, boundsAge = Infinity, lastSubjectKey = '', snapshot = null, drag = null;
  const hero = scene.getObjectByName('Player'), mother = scene.getObjectByName('Mother');
  const selfVisibility = createCameraSelfVisibility();
  const originalBeforeRender = scene.onBeforeRender, originalAfterRender = scene.onAfterRender;
  const beforeRender = function (...args) {
    originalBeforeRender?.apply(this, args);
    if (args[2] === camera && snapshot) selfVisibility.apply(snapshot.actor.id === 'player' ? [hero, ...(snapshot.actor.carried ? [mother] : [])] : [], snapshot.camera, snapshot.actor);
  };
  const afterRender = function (...args) { selfVisibility.restore(); originalAfterRender?.apply(this, args); };
  scene.onBeforeRender = beforeRender; scene.onAfterRender = afterRender;
  // Secondary mouse input is reserved for camera orbit; primary/touch movement is untouched.
  const down = event => { if (event.button !== 2) return; drag = { id: event.pointerId, x: event.clientX }; canvas.setPointerCapture?.(event.pointerId); event.preventDefault(); event.stopImmediatePropagation(); };
  const move = event => { if (!drag || drag.id !== event.pointerId) return; yawOffset += (event.clientX - drag.x) * .006; drag.x = event.clientX; event.preventDefault(); event.stopImmediatePropagation(); };
  const up = event => { if (!drag || drag.id !== event.pointerId) return; drag = null; if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId); event.stopImmediatePropagation(); };
  const menu = event => event.preventDefault();
  const orbitKey = event => {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key) || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)) return;
    yawOffset = event.key === 'Home' ? 0 : yawOffset + (event.key === 'ArrowLeft' ? -.12 : .12);
    event.preventDefault(); event.stopImmediatePropagation();
  };
  canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move, true); canvas.addEventListener('pointerup', up, true); canvas.addEventListener('pointercancel', up, true); canvas.addEventListener('contextmenu', menu);
  const doc = canvas.ownerDocument; doc.addEventListener('keydown', orbitKey, true);
  const api = {
    director,
    setShot(value) { shotOverride = value; },
    setSubjectProvider(provider) { if (provider !== null && typeof provider !== 'function') throw new TypeError('Subject provider must be a function'); subjectProvider = provider; },
    setProfile(name) { director.setProfile(name); profileName = name; },
    setUserView({ yawOffset: nextYaw = yawOffset, zoom = userZoom } = {}) {
      const yaw = Number(nextYaw), scale = Number(zoom);
      if (Number.isFinite(yaw)) yawOffset = yaw;
      if (Number.isFinite(scale)) userZoom = Math.max(.58, Math.min(1.65, scale));
      return Object.freeze({ yawOffset, zoom: userZoom });
    },
    // Alternate 3D renderers supply subjects and an authored frame, not their
    // own director. Shared transition/view ownership survives renderer handoff.
    presentExternal({ camera: activeCamera, actor: actorInput, target: targetInput, position, lookTarget, worldHeight, dt = 0, source = 'external3d', space = 'frontier', mode = 'combat' }) {
      const actor = cameraSubject(actorInput), target = targetInput ? cameraSubject(targetInput) : null;
      const tilted = position && lookTarget ? tiltCameraOffsetForZoom({ x: Number(position.x || 0) - Number(lookTarget.x || 0), y: Number(position.y || 0) - Number(lookTarget.y || 0), z: Number(position.z || 0) - Number(lookTarget.z || 0) }, userZoom) : null;
      const zoomedPosition = tilted ? {
        x: Number(lookTarget.x || 0) + tilted.x * userZoom,
        y: Number(lookTarget.y || 0) + tilted.y * userZoom,
        z: Number(lookTarget.z || 0) + tilted.z * userZoom,
      } : position;
      const authoredShot = externalCameraShot({ position: zoomedPosition, lookTarget, worldHeight, fov: CAMERA_PROFILES[profileName].fov, yawOffset });
      const presentation = director.update({ mode, actor, target, authoredShot, aspect: activeCamera.aspect, space, screenSafety }, dt);
      applyCameraPresentation(activeCamera, presentation);
      playerView = resolveCharacterView({ cameraPosition: activeCamera.position, actorPosition: actor.position, actorYaw: actor.yaw, state: playerView, dt });
      screenSafety = actorScreenSafety(activeCamera, target ? [actor, target] : [actor]);
      snapshot = { camera: { ...presentation, screenSafety }, playerView, actor, target, actorRuntime: '3d', actorYaw: actor.yaw, yawOffset, userZoom, renderer: source };
      return presentation;
    },
    update({ state, dt, inside, titleFrame, titleShot, combatFrame, offset, targetEnemy }) {
      boundsAge += Math.max(0, dt);
      const carried = Boolean(state.birthTour?.active || state.ageYears < 1), root = carried && mother ? mother : hero;
      const key = `${root?.uuid}:${state.ageYears}:${state.equipment?.weapon}:${state.interior?.buildingId || ''}`;
      if (!subjectCache || boundsAge >= .5 || key !== lastSubjectKey) {
        subjectCache = measureCameraSubject(root, { id: 'player', position: state.position, yaw: state.yaw, weaponRadius: weaponRadius(state.equipment?.weapon) });
        boundsAge = 0; lastSubjectKey = key;
      }
      const actor = subjectProvider?.(state) || { ...subjectCache, position: { x: state.position.x, y: 0, z: state.position.z }, yaw: state.yaw, carried };
      const enemyRoot = targetEnemy ? scene.getObjectByName(`Enemy:${targetEnemy.id}`) : null;
      const target = !titleFrame && shotOverride?.target ? shotOverride.target : targetEnemy ? measureCameraSubject(enemyRoot, { id: targetEnemy.id, position: targetEnemy, yaw: targetEnemy.yaw, fallbackHeight: targetEnemy.height || 1.8, weaponRadius: 1 }) : null;
      const baseMode = titleFrame ? 'title' : inside ? 'interior' : combatFrame ? 'combat' : 'exploration';
      const input = { mode: baseMode, actor, target, combatFrame, authoredShot: titleFrame ? titleShot : null,
        offset: tiltCameraOffsetForZoom(offset, userZoom), yaw: Math.atan2(offset.x, offset.z) + yawOffset, yawOffset, framing: { zoom: userZoom }, aspect: camera.aspect,
        space: inside ? `interior:${state.interior.buildingId}` : state.zone, screenSafety,
        ...(!titleFrame && shotOverride ? shotOverride : {}) };
      if (combatFrame?.offset) input.combatFrame = { ...combatFrame, offset: tiltCameraOffsetForZoom(combatFrame.offset, userZoom) };
      const presentation = director.update(input, dt);
      applyCameraPresentation(camera, presentation);
      playerView = resolveCharacterView({ cameraPosition: camera.position, actorPosition: actor.position, actorYaw: actor.yaw, state: playerView, dt });
      screenSafety = actorScreenSafety(camera, target ? [actor, target] : [actor], screenSafety?.occludedRatio || 0);
      snapshot = { camera: { ...presentation, screenSafety }, playerView, actor, target, actorRuntime: root?.userData?.characterRuntimeAdapter || '3d', actorYaw: state.yaw, yawOffset, userZoom };
      return { presentation, actor, target, samples: [...actorSilhouetteSamples(actor), ...(target ? actorSilhouetteSamples(target) : [])], snapshot };
    },
    recordOcclusion(ratio) { if (screenSafety) screenSafety.occludedRatio = ratio; },
    snapshot: () => snapshot ? structuredClone(snapshot) : null,
    dispose() {
      selfVisibility.dispose();
      if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = originalBeforeRender;
      if (scene.onAfterRender === afterRender) scene.onAfterRender = originalAfterRender;
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true); canvas.removeEventListener('pointerup', up, true); canvas.removeEventListener('pointercancel', up, true); canvas.removeEventListener('contextmenu', menu); doc.removeEventListener('keydown', orbitKey, true);
      if (canvas.cameraPresentation === api.snapshot) delete canvas.cameraPresentation;
    },
  };
  // Read-only diagnostics/evidence API, not a game HUD or a state-injection backdoor.
  canvas.cameraPresentation = api.snapshot;
  return api;
}
