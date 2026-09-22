import { riverX } from '@soul/world/mura';
import { presentRinneFootstepAudio } from '../gameplay-audio.js';
import { createGroundDust } from './ground-dust.js';

/** Sample the actual dirt ribbon, including every house approach, rather than
 * guessing a road from the player's distance to the village centre. */
function createGroundSampler(view) {
  const { THREE: T, scene } = view, paths = [];
  scene.traverse(node => { if (node.userData?.muraDirtPaths) paths.push(node); });
  for (const path of paths) path.updateWorldMatrix(true, false);
  const ray = new T.Raycaster(), origin = new T.Vector3(), down = new T.Vector3(0, -1, 0), hits = [];
  return (state, x, z) => {
    if (state.interior) return { surface: 'wood', y: .035 };
    if (state.zone === 'frontier') return { surface: 'stone', y: .035 };
    // The two broad stone fords are authored by createMuraTerrain.
    if ([-42, 54].some(ford => Math.abs(z - ford) <= 5 && Math.abs(x - riverX(ford)) <= 9.5)) return { surface: 'stone', y: .16 };
    if (Math.abs(x - riverX(z)) < 7.1) return { surface: 'water', y: .04 };
    origin.set(x, 1, z); ray.set(origin, down); ray.near = 0; ray.far = 2; hits.length = 0;
    ray.intersectObjects(paths, false, hits);
    return { surface: hits.length ? 'soil' : 'grass', y: .04 };
  };
}

/** Observe displacement after gameplay, but emit at the live actor's feet after
 * the character stage has positioned it and before the same frame is drawn. */
export function installLocomotionPresentation({ view, canvas, document: doc }) {
  const dust = createGroundDust({ ...view, canvas }), groundAt = createGroundSampler(view);
  const originalRender = view.renderState.bind(view), originalDispose = view.dispose.bind(view);
  const originalBefore = view.scene.onBeforeRender, point = new view.THREE.Vector3();
  let state = null, last = null, travelled = 0, foot = 1, speed = 0, lastSpeed = 0;
  let sinceStep = 1, sinceSkid = 1, idle = 0, sampleElapsed = 0, pendingStep = false, pendingSkid = false;
  const clear = () => {
    last = null; travelled = speed = lastSpeed = idle = sampleElapsed = 0; sinceStep = sinceSkid = 1;
    pendingStep = pendingSkid = false; dust.clear();
  };
  function beforeRender(...args) {
    originalBefore?.apply(view.scene, args);
    if (!state || (!pendingStep && !pendingSkid)) return;
    const carried = state.phase === 'birth', actor = view.scene.getObjectByName(carried ? 'Mother' : 'Player');
    if (!actor || !actor.visible) { pendingStep = pendingSkid = false; return; }
    actor.getWorldPosition(point);
    const yaw = Number(state.yaw) || 0, width = carried || state.ageYears >= 7 ? .15 : .1;
    const x = point.x + Math.cos(yaw) * width * foot, z = point.z - Math.sin(yaw) * width * foot;
    const ground = groundAt(state, x, z), quality = view.qualitySnapshot?.()?.profile?.level || 0;
    // Held infants use Mother above; ungrounded/knocked-up actors do not step.
    if (point.y <= ground.y + .35 && ground.surface !== 'water') {
      if (pendingStep) {
        presentRinneFootstepAudio({ surface: ground.surface, speed, carried, foot });
        dust.emit({ x, z, ...ground, yaw, speed, carried, quality }); foot *= -1;
        canvas.dataset.locomotionSurface = ground.surface;
      }
      if (pendingSkid) dust.emit({ x: point.x, z: point.z, ...ground, yaw, speed: Math.max(speed, lastSpeed), carried, quality, skid: true });
    }
    pendingStep = pendingSkid = false;
  }
  view.scene.onBeforeRender = beforeRender;
  view.renderState = (next, dt = 0, options = {}) => {
    state = next; dt = Math.max(0, Math.min(.05, Number(dt) || 0));
    const carried = next.phase === 'birth', shared = Boolean(canvas.dataset.coopWorld);
    const live = !options.titlePreview && !doc.hidden && !next.down && !next.ended && dt > 0 && canvas.dataset.runtime === 'active';
    if (!live) clear();
    else {
      const key = `${next.id}:${next.generation}:${next.zone}:${next.interior?.buildingId || ''}:${carried}`;
      const x = next.position.x, z = next.position.z;
      const distance = last && last.key === key ? Math.hypot(x - last.x, z - last.z) : 0;
      if (!last || last.key !== key || distance > 1.25) { clear(); last = { x, z, key, yaw: next.yaw }; }
      else {
        sampleElapsed += dt;
        const moving = distance > .0001 && (carried || next.moving);
        lastSpeed = speed; speed = moving ? Math.min(12, distance / (shared ? Math.max(dt, sampleElapsed) : dt)) : 0;
        if (distance > .0001) sampleElapsed = 0;
        sinceStep += dt; sinceSkid += dt; idle = moving ? 0 : idle + dt;
        if (idle > .16) travelled = 0;
        if (moving) {
          travelled += distance;
          const stride = carried ? .62 + speed * .15 : (next.ageYears < 7 ? .3 : .5) + speed * .18;
          const firstStep = sinceStep > .5 && travelled > .12;
          if ((firstStep || travelled >= Math.min(1.85, stride)) && sinceStep >= .16) {
            travelled = firstStep ? 0 : travelled % Math.min(1.85, stride); sinceStep = 0; pendingStep = true;
          }
        }
        const turn = Math.abs(Math.atan2(Math.sin(next.yaw - last.yaw), Math.cos(next.yaw - last.yaw)));
        if (!shared && sinceSkid > .3 && lastSpeed > 3 && ((lastSpeed - speed) / dt > 22 || (moving && turn / dt > 3.5))) {
          pendingSkid = true; sinceSkid = 0;
        }
        last = { x, z, key, yaw: next.yaw };
      }
      dust.update(dt);
    }
    const hero = view.scene.getObjectByName('Player');
    if (hero) { if (live && !shared) hero.userData.locomotionSpeed = speed; else delete hero.userData.locomotionSpeed; }
    originalRender(next, dt, options);
  };
  const onVisibility = () => { if (doc.hidden) clear(); };
  doc.addEventListener('visibilitychange', onVisibility);
  view.clearLocomotion = clear;
  view.dispose = () => {
    clear(); doc.removeEventListener('visibilitychange', onVisibility);
    view.scene.onBeforeRender = originalBefore; dust.dispose(); delete view.clearLocomotion;
    delete canvas.dataset.locomotionSurface; originalDispose();
  };
  return view;
}
