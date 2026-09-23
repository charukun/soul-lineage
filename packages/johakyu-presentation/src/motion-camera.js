// Camera direction belongs to the motion, so new techniques can define their own shot.
export const MOTION_CAMERA = Object.freeze({
  // Finishers stay close, but focus the midpoint so the downed target remains part of the close-up.
  'finisher.execution': Object.freeze({distance:5.2,height:2.35,focusHeight:.78,angle:.62,targetBlend:.5}),
  // Zanshin pulls away while retaining the defeated target in the composition.
  'phase:zanshin': Object.freeze({distance:10.5,height:4.35,focusHeight:1,angle:0,targetBlend:.36}),
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
