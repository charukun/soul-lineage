import { createCameraDirector } from '@soul/rendering/camera-director';
import { resolveCharacterView } from '@soul/rendering/character-view-resolver';
import { applyCameraPresentation, measureCameraSubject, actorScreenSafety, actorSilhouetteSamples } from '@soul/rendering/camera-presentation-three';

const weaponRadius = id => ({ spear: 1.8, great: 1.5, staff: 1.6, sword: 1.1, axe: 1.2 }[id] || .6);

/** RINNE adapter: game state -> shared director. Never owns character transforms. */
export function createRinnePresentationCamera({ camera, scene, canvas }) {
  const director = createCameraDirector({ profile: 'current3d' });
  let yawOffset = 0, playerView = null, shotOverride = null, subjectProvider = null, screenSafety = null;
  let subjectCache = null, boundsAge = Infinity, lastSubjectKey = '', snapshot = null, drag = null;
  const hero = scene.getObjectByName('Player'), mother = scene.getObjectByName('Mother');
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
    setProfile: name => director.setProfile(name),
    update({ state, dt, inside, titleFrame, titleShot, combatFrame, offset, targetEnemy }) {
      boundsAge += Math.max(0, dt);
      const carried = Boolean(state.birthTour?.active || state.ageYears < 1), root = carried && mother ? mother : hero;
      const key = `${root?.uuid}:${state.ageYears}:${state.equipment?.weapon}:${state.interior?.buildingId || ''}`;
      if (!subjectCache || boundsAge >= .5 || key !== lastSubjectKey) {
        subjectCache = measureCameraSubject(root, { id: 'player', position: state.position, yaw: state.yaw, weaponRadius: weaponRadius(state.equipment?.weapon) });
        boundsAge = 0; lastSubjectKey = key;
      }
      const actor = subjectProvider?.(state) || { ...subjectCache, position: { x: state.position.x, y: 0, z: state.position.z }, yaw: state.yaw };
      const enemyRoot = targetEnemy ? scene.getObjectByName(`Enemy:${targetEnemy.id}`) : null;
      const target = targetEnemy ? measureCameraSubject(enemyRoot, { id: targetEnemy.id, position: targetEnemy, yaw: targetEnemy.yaw, fallbackHeight: targetEnemy.height || 1.8, weaponRadius: 1 }) : null;
      const baseMode = titleFrame ? 'title' : inside ? 'interior' : combatFrame ? 'combat' : 'exploration';
      const input = { mode: baseMode, actor, target, combatFrame, authoredShot: titleFrame ? titleShot : null,
        offset, yaw: Math.atan2(offset.x, offset.z) + yawOffset, yawOffset, aspect: camera.aspect,
        space: inside ? `interior:${state.interior.buildingId}` : state.zone, screenSafety,
        ...(!titleFrame && shotOverride ? shotOverride : {}) };
      const presentation = director.update(input, dt);
      applyCameraPresentation(camera, presentation);
      playerView = resolveCharacterView({ cameraPosition: camera.position, actorPosition: actor.position, actorYaw: actor.yaw, state: playerView, dt });
      screenSafety = actorScreenSafety(camera, target ? [actor, target] : [actor], screenSafety?.occludedRatio || 0);
      snapshot = { camera: { ...presentation, screenSafety }, playerView, actor, target, actorRuntime: root?.userData?.characterRuntimeAdapter || '3d', actorYaw: state.yaw, yawOffset };
      return { presentation, actor, target, samples: [...actorSilhouetteSamples(actor), ...(target ? actorSilhouetteSamples(target) : [])], snapshot };
    },
    recordOcclusion(ratio) { if (screenSafety) screenSafety.occludedRatio = ratio; },
    snapshot: () => snapshot ? structuredClone(snapshot) : null,
    dispose() {
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true); canvas.removeEventListener('pointerup', up, true); canvas.removeEventListener('pointercancel', up, true); canvas.removeEventListener('contextmenu', menu); doc.removeEventListener('keydown', orbitKey, true);
      if (canvas.cameraPresentation === api.snapshot) delete canvas.cameraPresentation;
    },
  };
  // Read-only diagnostics/evidence API, not a game HUD or a state-injection backdoor.
  canvas.cameraPresentation = api.snapshot;
  return api;
}
