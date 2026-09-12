// Normalized to the actual capture clock, never wall time or frame count.
// drop, spine pitch/twist/roll, head pitch/yaw/roll, jaw, hand x/y/z, prey lift, throat.
const rest=[0,.16,0,0,-.096,0,0,0,.47,.71,.05,0,0];
const keys=[
 [0,rest],
 [.17,[-.30,.60,-.03,.025,.08,-.08,.05,.28,.30,.20,.62,0,0]],
 [.30,[-.38,1.02,-.04,.035,.03,-.05,.07,.55,.26,.18,.84,0,0]],
 [.44,[-.34,.95,.025,-.025,.02,.04,-.03,.88,.20,.34,.70,.16,0]],
 [.51,[-.36,1.10,-.055,.04,.17,-.08,.08,.025,.18,.32,.68,.14,0]],
 [.59,[-.31,.92,.10,-.06,-.15,.15,-.18,.08,.21,.40,.60,.20,0]],
 [.68,[-.34,1.06,-.07,.04,.13,-.10,.08,.025,.18,.36,.66,.16,0]],
 [.76,[-.21,.68,.035,-.03,-.24,.035,-.035,.04,.24,.48,.47,.12,.25]],
 [.84,[-.12,.38,0,.01,-.36,0,.02,0,.30,.54,.36,.04,1]],
 [.92,[-.04,.21,0,0,-.12,0,0,0,.40,.62,.20,0,.1]],
 [1,rest]
];
export const DEVOUR_PHASES=Object.freeze(['lower','reach','pull','bite','swallow','recover']);
export const smooth=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
export function sampleDevourMotion(progress){
 const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
 const next=keys.findIndex(([at])=>at>=p),i=Math.max(1,next),[a,av]=keys[i-1],[b,bv]=keys[i];
 const t=smooth((p-a)/(b-a)),v=av.map((x,j)=>x+(bv[j]-x)*t);
 const [drop,pitch,twist,roll,headPitch,headYaw,headRoll,jaw,handX,handY,handZ,preyLift,throat]=v;
 return{progress:p,phase:DEVOUR_PHASES[p<.17?0:p<.30?1:p<.44?2:p<.76?3:p<.92?4:5],
  drop,pitch,twist,roll,headPitch,headYaw,headRoll,jaw,handX,handY,handZ,preyLift,throat,
  stance:smooth(Math.min(p/.17,(1-p)/.12)),hold:smooth(p/.30)*(1-smooth((p-.88)/.12))};
}
