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
export const INCAPACITATION_SECONDS=.68;
export const INCAPACITATION_PHASES=Object.freeze(['impact','buckle','drop','contact','settle']);
const clamp=value=>Math.max(0,Math.min(1,value));
export const smooth=value=>{const x=clamp(value);return x*x*(3-2*x);};
const pulse=(progress,at,width=.055)=>Math.max(0,1-Math.abs(progress-at)/width);
const collapseKeys=[
 [0,[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
 [.12,[.06,-.045,0,-.18,.10,-.06,.10,-.06,-.04,.08,.02,.04,0,0,.06]],
 [.34,[.22,.08,.03,.28,.16,.14,-.10,.07,.10,.75,.18,.28,.10,0,.30]],
 [.62,[.82,.16,.09,.46,.12,.28,-.18,.09,-.18,1,.55,.68,.72,0,.76]],
 [.82,[1.52,.10,.13,.18,.05,.10,.16,-.04,-.28,.62,.95,1,.90,1,1]],
 [1,[1.45,.06,.13,.12,0,.06,.08,0,-.24,.54,1,.95,.35,0,1]]
];
function interpolate(keys,p){
 const next=keys.findIndex(([at])=>at>=p),i=Math.max(1,next),[a,av]=keys[i-1],[b,bv]=keys[i];
 const t=smooth((p-a)/(b-a));return av.map((x,j)=>x+(bv[j]-x)*t);
}
export function sampleDevourMotion(progress){
 const p=clamp(Number.isFinite(progress)?progress:0),v=interpolate(keys,p);
 const [drop,pitch,twist,roll,headPitch,headYaw,headRoll,jaw,handX,handY,handZ,preyLift,throat]=v;
 return{progress:p,phase:DEVOUR_PHASES[p<.17?0:p<.30?1:p<.44?2:p<.76?3:p<.92?4:5],
  drop,pitch,twist,roll,headPitch,headYaw,headRoll,jaw,handX,handY,handZ,preyLift,throat,
  stance:smooth(Math.min(p/.17,(1-p)/.12)),hold:smooth(p/.30)*(1-smooth((p-.88)/.12))};
}

/** Full-body presentation state from the fatal combat pose into a stable down pose. */
export function sampleIncapacitationMotion(progress,side=1){
 const p=clamp(Number.isFinite(progress)?progress:0),s=side<0?-1:1,v=interpolate(collapseKeys,p);
 const [rootRoll,rootPitch,rootY,bodyPitch,bodyTwist,bodyRoll,headPitch,headYaw,headRoll,legBend,legSpread,armDrop,brace,contact,poseWeight]=v;
 return{progress:p,side:s,phase:INCAPACITATION_PHASES[p<=.12?0:p<=.34?1:p<=.62?2:p<.90?3:4],
  rootRoll:rootRoll*s,rootPitch,rootY,bodyPitch,bodyTwist:bodyTwist*s,bodyRoll:bodyRoll*s,
  headPitch,headYaw:headYaw*s,headRoll:headRoll*s,legBend,legSpread,armDrop,brace,contact,poseWeight};
}

/**
 * Presentation-only state for a defeated human. The same normalized capture clock
 * drives both the predator and prey. During an immediate post-KO feed, lower/reach
 * gives the collapse enough screen time before the prey is visibly pulled upward.
 */
export function samplePreyMotion(progress=null,downProgress=1,captureWeight=1,fallSide=1){
 const feeding=Number.isFinite(progress),p=feeding?clamp(progress):0,weight=feeding?clamp(captureWeight):0;
 const collapseProgress=Math.max(clamp(downProgress),feeding?clamp(p/.17):0),fall=sampleIncapacitationMotion(collapseProgress,fallSide);
 const predator=sampleDevourMotion(p),capture=smooth((p-.15)/.19)*weight;
 const bite=(feeding?Math.max(...DEVOUR_BITE_BEATS.map(at=>pulse(p,at))):0)*weight;
 const swallow=(feeding?smooth((p-.70)/.22):0)*weight;
 const settle=(feeding?smooth((p-.90)/.10):0)*weight;
 const slack=Math.max(fall.poseWeight,capture),s=fall.side;
 return {progress:p,feeding,down:fall.progress,capture,bite,swallow,settle,slack,fallPhase:fall.phase,side:s,
  rootRoll:fall.rootRoll*(1-.17*capture)+s*(.10*bite+.08*swallow),
  rootPitch:fall.rootPitch*(1-.35*capture),rootY:fall.rootY+.07*capture,
  bodyPitch:fall.bodyPitch+.18*capture-.11*swallow,
  bodyTwist:fall.bodyTwist*(1-.45*capture)+s*(.08*capture+.06*bite),
  bodyRoll:fall.bodyRoll*(1-.35*capture)-s*.10*capture+s*.07*bite,
  headPitch:fall.headPitch-.18*capture+.16*bite,
  headYaw:fall.headYaw-s*.08*capture,
  headRoll:fall.headRoll*(1-.25*capture)+s*.18*capture-s*.13*bite,
  legBend:fall.legBend*(1-.25*capture)+.20*capture,
  legSpread:fall.legSpread*(1-.20*capture),armDrop:fall.armDrop,brace:fall.brace*(1-capture),contact:fall.contact*(1-capture),
  weaponDrop:fall.armDrop*(.65+.35*fall.progress),
  lift:(predator.preyLift*capture)+.34*swallow,
  forward:.66-predator.preyLift*.35-.18*swallow,
  lateral:1.15-.14*capture-.55*swallow,
  compression:.14*swallow+.035*settle};
}

export function preyCapturePoint(origin,capture,motion){
 const ox=Number.isFinite(origin?.x)?origin.x:0,oz=Number.isFinite(origin?.z)?origin.z:0,k=motion?.capture||0;
 if(!capture||k<=0)return{x:ox,z:oz};
 const growth=Math.max(.28,Math.min(3.2,Number(capture.growthScale)||1)),size=(capture.form==='brute'?1.12:capture.form==='stalker'?1.04:1)*growth;
 const yaw=capture.yaw||0,cs=Math.cos(yaw),sn=Math.sin(yaw),lateral=motion.lateral*Math.max(.42,Math.min(1.7,size));
 const tx=capture.x+cs*lateral+sn*motion.forward*size,tz=capture.z-sn*lateral+cs*motion.forward*size;
 return{x:ox+(tx-ox)*k,z:oz+(tz-oz)*k};
}
