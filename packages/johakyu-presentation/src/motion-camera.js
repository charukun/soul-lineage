// Camera direction belongs to the motion, so new techniques can define their own shot.
export const MOTION_CAMERA = Object.freeze({
  // Finisher is framed from the side of the hero-target line so the defeated target's burst stays visible.
  'finisher.execution': Object.freeze({distance:6.4,height:2.65,focusHeight:.72,angle:1.25,targetBlend:.68,basis:'target'}),
  // Zanshin is a pulled-back frontal shot of the hero, independent of the defeated target.
  'phase:zanshin': Object.freeze({distance:13.5,height:3.7,focusHeight:1.08,angle:0,targetBlend:0,basis:'actor'}),
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
