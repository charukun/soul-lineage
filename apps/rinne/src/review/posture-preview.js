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
      const actor = {id: 'lab-posture', hero: true, lifeAgeYears: 22, weapon: 'sword', combatReady: true, weaponTransition: true, x: 0, z: 0, yaw: 0, _humanoidClock: 0, _humanoidPhase: 0};
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
  const hand=body.bones?.rightHand,hips=body.bones?.hips,socket=hand?.getObjectByName('ReviewWeaponPolishedSocket');
  if(!hand||!hips||!socket)return body;
  const originalAfter=body.afterSample?.bind(body);let signature='',calibrated=null;
  const nodes=new Map(Object.values(body.bones).map(b=>[b.uuid,b]));
  function carryMatrix(row,handMatrix){
    const saved=Object.values(body.bones).map(b=>[b,b.position.clone(),b.quaternion.clone()]);
    try {
      for(const track of row.clip.tracks){const dot=track.name.lastIndexOf('.'),n=nodes.get(track.name.slice(0,dot)),p=track.name.slice(dot+1);if(n&&['position','quaternion'].includes(p))n[p].fromArray(track.createInterpolant().evaluate(row.transferTime));}
      body.root.updateMatrixWorld(true);
      return hips.matrixWorld.clone().invert().multiply(hand.matrixWorld).multiply(handMatrix);
    }finally{for(const[b,p,q]of saved){b.position.copy(p);b.quaternion.copy(q);}body.root.updateMatrixWorld(true);}
  }
  body.afterSample=(time,name,state)=>{
    const matrix=body.weaponHandMatrix?.();
    if(matrix){if(socket.parent!==hand)hand.add(socket);matrix.decompose(socket.position,socket.quaternion,socket.scale);}
    originalAfter?.(time,name,state);
    const row=body.posturePreviews?.get(name);const amount=row?postureAmount(row.kind,time):1;
    if(row&&matrix&&socket.visible&&amount<=.25){
      const key=row.name+':'+matrix.elements.join(',');if(key!==signature){calibrated=carryMatrix(row,matrix);signature=key;}
      hips.add(socket);calibrated.decompose(socket.position,socket.quaternion,socket.scale);socket.updateMatrixWorld(true);
    }
    body.postureDiagnostics=row?{kind:row.kind,amount,attachment:socket.parent===hips?'hips':'hand',time}:null;
  };
  const oldDispose=body.dispose?.bind(body);body.dispose=()=>{body.posturePreviews?.clear();oldDispose?.();};
  return body;
}
