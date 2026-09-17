// Normalized to the actual capture clock, never wall time or frame count.
// drop, spine pitch/twist/roll, head pitch/yaw/roll, jaw, hand x/y/z, prey lift, throat.
const rest=[0,.16,0,0,-.096,0,0,0,.47,.71,.05,0,0];
const keys=[
 [0,rest],
 [.17,[-.30,.60,-.03,.025,.08,-.08,.05,.28,.30,.20,.62,0,0]],
 [.30,[-.38,1.02,-.04,.035,.03,-.05,.07,.55,.26,.18,.84,0,0]],
 [.44,[-.34,.95,.025,-.025,.02,.04,-.03,.88,.20,.34,.70,.16,0]],
 [.51,[-.38,1.16,-.12,.075,.23,-.14,.12,.025,.18,.29,.68,.14,0]],
 [.59,[-.28,.84,.20,-.10,-.20,.22,-.22,.08,.24,.46,.54,.24,0]],
 [.68,[-.36,1.13,-.14,.08,.20,-.16,.12,.025,.18,.32,.68,.16,0]],
 [.76,[-.21,.68,.035,-.03,-.24,.035,-.035,.04,.24,.48,.47,.12,.25]],
 [.84,[-.12,.38,0,.01,-.36,0,.02,0,.30,.54,.36,.04,1]],
 [.92,[-.04,.21,0,0,-.12,0,0,0,.40,.62,.20,0,.1]],
 [1,rest]
];
export const DEVOUR_PHASES=Object.freeze(['lower','reach','pull','bite','swallow','recover']);
export const DEVOUR_BITE_BEATS=Object.freeze([.51,.68]);
const clamp=value=>Math.max(0,Math.min(1,value));
export const smooth=value=>{const x=clamp(value);return x*x*(3-2*x);};
const pulse=(progress,at,width=.055)=>Math.max(0,1-Math.abs(progress-at)/width);
export function sampleDevourMotion(progress){
 const p=clamp(Number.isFinite(progress)?progress:0);
 const next=keys.findIndex(([at])=>at>=p),i=Math.max(1,next),[a,av]=keys[i-1],[b,bv]=keys[i];
 const t=smooth((p-a)/(b-a)),v=av.map((x,j)=>x+(bv[j]-x)*t);
 const [drop,pitch,twist,roll,headPitch,headYaw,headRoll,jaw,handX,handY,handZ,preyLift,throat]=v;
 return{progress:p,phase:DEVOUR_PHASES[p<.17?0:p<.30?1:p<.44?2:p<.76?3:p<.92?4:5],
  drop,pitch,twist,roll,headPitch,headYaw,headRoll,jaw,handX,handY,handZ,preyLift,throat,
  stance:smooth(Math.min(p/.17,(1-p)/.12)),hold:smooth(p/.30)*(1-smooth((p-.88)/.12))};
}

/**
 * Presentation-only state for a defeated human. The same normalized capture clock
 * drives both the predator and prey, while captureWeight lets a cancelled grab
 * settle back to the ground instead of snapping to the simulation transform.
 */
export function samplePreyMotion(progress=null,downProgress=1,captureWeight=1){
 const down=smooth(downProgress),feeding=Number.isFinite(progress),p=feeding?clamp(progress):0,weight=feeding?clamp(captureWeight):0;
 const predator=sampleDevourMotion(p);
 const capture=smooth((p-.045)/.255)*weight;
 const bite=(feeding?Math.max(...DEVOUR_BITE_BEATS.map(at=>pulse(p,at))):0)*weight;
 const swallow=(feeding?smooth((p-.70)/.22):0)*weight;
 const settle=(feeding?smooth((p-.90)/.10):0)*weight;
 const slack=Math.max(down,capture);
 return {progress:p,feeding,down,capture,bite,swallow,settle,slack,
  rootRoll:1.45*down-.25*capture+.10*bite+.08*swallow,
  rootY:.13*down+.07*capture,
  bodyPitch:.12*down+.18*capture-.11*swallow,
  bodyRoll:.06*down-.10*capture+.07*bite,
  headPitch:.08*down-.18*capture+.16*bite,
  headRoll:-.24*down+.18*capture-.13*bite,
  lift:(predator.preyLift*capture)+.34*swallow,
  forward:.66-predator.preyLift*.35-.18*swallow,
  lateral:1.15-.14*capture-.55*swallow,
  compression:.14*swallow+.035*settle};
}
