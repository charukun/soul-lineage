import { THREE } from '@soul/rendering';

const clamp = value => Math.max(0, Math.min(1, value));
export const POSTURE_DURATION = 1.4;
export function postureAmount(kind, time) {
  const progress = clamp((time - .15) / 1.1);
  return kind === 'sheathe' ? 1 - progress : progress;
}

/** Bake the game's actual weaponDraw/IK transition, not a renamed attack or reversed attack. */
export function bakePosturePreview(runtime) {
  const current = runtime.current;
  if (!current?.bones?.rightHand || !current.bones.hips) return [];
  const previousWeapon = runtime.api.weapons.sword;
  // Only the sampled collision report needs these dimensions; no gameplay state is changed.
  runtime.api.weapons.sword = previousWeapon || {width: .04, base: .05, tip: 1};
  try {
    return ['draw', 'sheathe'].map(kind => {
      const name = kind === 'draw' ? '姿勢 / 抜刀（ゲーム共通）' : '姿勢 / 納刀（ゲーム共通）';
      const times = [], rotations = Object.fromEntries(Object.keys(current.bones).map(key => [key, []])), hips = [];
      const actor = {id: 'lab-posture', hero: true, weapon: 'sword', combatReady: true, weaponTransition: true, x: 0, z: 0, yaw: 0, _humanoidClock: 0, _humanoidPhase: 0};
      for (let frame = 0; frame <= 84; frame++) {
        const time = frame / 84 * POSTURE_DURATION;
        actor.weaponDraw = postureAmount(kind, time);
        current.state = null; current.lastActual = null; current.blending = null;
        runtime.sample(actor, null, 0, 0, false);
        times.push(time);
        for (const [key, bone] of Object.entries(current.bones)) rotations[key].push(...bone.quaternion.toArray());
        hips.push(...current.bones.hips.position.toArray());
      }
      const tracks = Object.entries(current.bones).map(([key, bone]) => new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`, times, rotations[key]));
      tracks.push(new THREE.VectorKeyframeTrack(`${current.bones.hips.uuid}.position`, times, hips));
      return {name, kind, transferTime: .15 + (kind === 'draw' ? .25 : .75) * 1.1, clip: new THREE.AnimationClip(name, POSTURE_DURATION, tracks)};
    });
  } finally {
    if (previousWeapon) runtime.api.weapons.sword = previousWeapon; else delete runtime.api.weapons.sword;
    runtime.resetRoot(current); runtime.resetBones(current);
  }
}

/** Keep the visible weapon on the hip until the reaching hand meets it (and vice versa). */
export function installPostureWeaponPreview(body) {
  const hand = body.bones?.rightHand, hips = body.bones?.hips;
  const socket = hand?.getObjectByName('ReviewWeaponPolishedSocket');
  if (!hand || !hips || !socket) return body;
  const originalSet = body.setWeapon?.bind(body), originalSample = body.samplePosture?.bind(body);
  const handMatrix = new THREE.Matrix4();
  let sampled = null, signature = '', calibrated = null, disposed = false;
  const nodes = new Map(Object.values(body.bones).map(bone => [bone.uuid, bone]));
  function carryMatrix(row) {
    const saved = Object.values(body.bones).map(bone => [bone, bone.position.clone(), bone.quaternion.clone()]);
    try {
      for (const track of row.clip.tracks) {
        const dot = track.name.lastIndexOf('.'), node = nodes.get(track.name.slice(0, dot)), property = track.name.slice(dot + 1);
        if (node && ['position', 'quaternion'].includes(property)) node[property].fromArray(track.createInterpolant().evaluate(row.transferTime));
      }
      body.root.updateMatrixWorld(true);
      return hips.matrixWorld.clone().invert().multiply(hand.matrixWorld).multiply(handMatrix);
    } finally {
      for (const [bone, position, quaternion] of saved) { bone.position.copy(position); bone.quaternion.copy(quaternion); }
      body.root.updateMatrixWorld(true);
    }
  }
  function apply() {
    if (disposed) return;
    const row = body.posturePreviews?.get(sampled?.name);
    const amount = row ? postureAmount(row.kind, sampled.time) : 1;
    if (row && amount <= .25) {
      const key = `${row.name}:${handMatrix.elements.join(',')}`;
      if (signature !== key) { calibrated = carryMatrix(row); signature = key; }
      if (socket.parent !== hips) hips.add(socket);
      calibrated.decompose(socket.position, socket.quaternion, socket.scale);
    } else {
      if (socket.parent !== hand) hand.add(socket);
      handMatrix.decompose(socket.position, socket.quaternion, socket.scale);
    }
    socket.updateMatrixWorld(true);
  }
  body.samplePosture = state => { originalSample?.(state); sampled = state; apply(); };
  let pendingWeapon = null, latestWeapon = null;
  body.setWeapon = options => {
    latestWeapon = options;
    if (pendingWeapon) return pendingWeapon;
    // Coalesce frames while a weapon loads. Parallel completions must not capture a hip
    // transform as the hand grip after another completion has reparented the socket.
    pendingWeapon = (async () => {
      let applied;
      do {
        const requested = latestWeapon;
        if (disposed) return;
        await originalSet?.(requested);
        if (disposed) return;
        if (requested?.enabled) {
          socket.scale.set(1, 1, 1); socket.updateMatrix(); handMatrix.copy(socket.matrix); apply();
        }
        applied = requested;
      } while (applied !== latestWeapon);
    })().finally(() => { pendingWeapon = null; });
    return pendingWeapon;
  };
  const originalDispose = body.dispose?.bind(body);
  body.dispose = () => { disposed = true; body.posturePreviews?.clear(); originalDispose?.(); };
  return body;
}
