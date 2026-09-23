// Camera direction belongs to the motion, so new techniques can define their own shot.
export const MOTION_CAMERA = Object.freeze({
  'finisher.execution': Object.freeze({distance:3.4,height:2.05,focusHeight:.85,angle:.58}),
  'phase:zanshin': Object.freeze({distance:11,height:4.5,focusHeight:1.05,angle:0}),
});

export function cameraForMotion(actor) {
  if (!actor || actor.dead || actor.downed) return null;
  const action=actor.canonicalRow?.action;
  if (action?.finisher) return {key:action.techniqueId||'finisher.execution',shot:MOTION_CAMERA[action.techniqueId]||MOTION_CAMERA['finisher.execution'],progress:action.progress||0};
  const cue=actor.canonicalRow?.phaseCue;
  if (cue?.phase==='zanshin') return {key:'phase:zanshin',shot:MOTION_CAMERA['phase:zanshin'],progress:cue.progress||0};
  const key=action?.techniqueId||action?.motion?.clip;
  return key&&MOTION_CAMERA[key]?{key,shot:MOTION_CAMERA[key],progress:action.progress||0}:null;
}
