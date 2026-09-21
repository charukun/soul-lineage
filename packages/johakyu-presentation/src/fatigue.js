/** Presentation mapping only. Canonical combat owns stamina bands and capability. */
export const FATIGUE_BREATH_ASSET=Object.freeze({
  id:'fatigue.breath.mikeask.v1',
  path:'audio/fatigue/d68f34ffbc9dc7c48ee89dc8a7ab86d66640d5e6/breathing-tired.wav',
  byteLength:559148,
  gitBlob:'d68f34ffbc9dc7c48ee89dc8a7ab86d66640d5e6'
});

const profiles=Object.freeze({
  fresh:Object.freeze({lean:0,drop:0,shoulder:0,breathHz:.24,breathLift:.004,sway:0,sweatInterval:0,audioGain:0,audioRate:1}),
  steady:Object.freeze({lean:.018,drop:.004,shoulder:.008,breathHz:.38,breathLift:.012,sway:.003,sweatInterval:0,audioGain:0,audioRate:1}),
  low:Object.freeze({lean:.072,drop:.018,shoulder:.026,breathHz:.62,breathLift:.026,sway:.008,sweatInterval:1.15,audioGain:.22,audioRate:.92}),
  critical:Object.freeze({lean:.185,drop:.052,shoulder:.058,breathHz:.92,breathLift:.048,sway:.018,sweatInterval:.42,audioGain:.52,audioRate:1.08})
});
const disabled=Object.freeze({band:'fresh',canonical:false,attackLocked:false,...profiles.fresh});

export function resolveFatiguePresentation(actor){
  const stamina=actor?.capability?.stamina,band=stamina?.band;
  if(!Object.hasOwn(profiles,band))return disabled;
  return Object.freeze({
    band,
    canonical:true,
    attackLocked:actor.capability?.canAttack===false,
    ratio:Number.isFinite(stamina.ratio)?stamina.ratio:null,
    ...profiles[band]
  });
}
