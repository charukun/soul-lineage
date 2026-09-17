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
const mix=(a,b,t)=>a+(b-a)*clamp(t);
const collapseKeys=[
 [0,[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]],
 [.12,[.06,-.045,0,-.18,.10,-.06,.10,-.06,-.04,.08,.02,.04,0,0,.06]],
 [.34,[.22,.08,.03,.28,.16,.14,-.10,.07,.10,.75,.18,.28,.10,0,.30]],
 [.62,[.82,.16,.09,.46,.12,.28,-.18,.09,-.18,1,.55,.68,.72,0,.76]],
 [.82,[1.52,.10,.13,.18,.05,.10,.16,-.04,-.28,.62,.95,1,.90,1,1]],
 [1,[1.45,.06,.13,.12,0,.06,.08,0,-.24,.54,1,.95,.35,0,1]]
];
function interpolate(samples,p){
 const next=samples.findIndex(([at])=>at>=p),i=Math.max(1,next),[a,av]=samples[i-1],[b,bv]=samples[i];
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

/** Contact weights shared by predator hands, prey body, mouth, particles and sound accents. */
export function sampleDevourContact(progress){
 const p=clamp(Number.isFinite(progress)?progress:0),bite=Math.max(...DEVOUR_BITE_BEATS.map(at=>pulse(p,at,.06)));
 const reach=smooth((p-.08)/.15),grip=smooth((p-.22)/.10)*(1-smooth((p-.90)/.08));
 const haul=smooth((p-.27)/.17)*(1-smooth((p-.91)/.07)),mouth=smooth((p-.40)/.08)*(1-smooth((p-.84)/.10));
 const swallow=smooth((p-.70)/.22),release=smooth((p-.90)/.10),recoil=bite*(1-swallow*.45);
 return{progress:p,reach,grip,haul,mouth,bite,swallow,release,recoil,lock:Math.max(mouth,swallow)};
}

export function devourActorScale(capture={}){
 if(Number.isFinite(capture.scale))return Math.max(.28,Math.min(3.6,capture.scale));
 const growth=Math.max(.28,Math.min(3.2,Number(capture.growthScale)||1));
 const form=capture.form==='brute'?1.12:capture.form==='stalker'?1.04:1;
 return growth*form;
}
export function devourInteractionSide(capture={}){
 const x=Number(capture.x)||0,z=Number(capture.z)||0,yaw=Number(capture.yaw)||0;
 const wave=Math.sin(x*12.9898+z*78.233+yaw*37.719)*43758.5453;
 return wave-Math.floor(wave)>=.5?1:-1;
}
function localXZ(capture,lx,lz){
 const yaw=Number(capture?.yaw)||0,cs=Math.cos(yaw),sn=Math.sin(yaw),x=Number(capture?.x)||0,z=Number(capture?.z)||0;
 return{x:x+cs*lx+sn*lz,z:z-sn*lx+cs*lz};
}
function socketAt(root,yaw,roll,scale,[lx,ly,lz]){
 const cr=Math.cos(roll),sr=Math.sin(roll),rx=(lx*cr-ly*sr)*scale,ry=(lx*sr+ly*cr)*scale,rz=lz*scale;
 const cs=Math.cos(yaw),sn=Math.sin(yaw);
 return{x:root.x+cs*rx+sn*rz,y:root.y+ry,z:root.z-sn*rx+cs*rz};
}

/**
 * Shared world-space contact frame. It deliberately owns no gameplay state: it only
 * explains where the visible prey, the two grips and the mouth should meet.
 */
export function devourInteractionFrame(origin={},capture={},motion=samplePreyMotion(null,1,0)){
 const p=clamp(Number(motion?.progress)||0),contact=sampleDevourContact(p),predatorScale=devourActorScale(capture),side=devourInteractionSide(capture);
 const captureWeight=clamp(Number(motion?.capture)||0),preyScale=Math.max(.82,1-(Number(motion?.compression)||0)*captureWeight);
 const sizeT=clamp((predatorScale-.28)/.92),biteHeight=mix(.46,1.38,sizeT),upperHeight=Math.max(.38,biteHeight-.16),lowerHeight=Math.max(.24,biteHeight-.55);
 const heldRoll=side*mix(1.38,1.18,sizeT),lock=contact.lock;
 const mouthLocal={x:0,y:Math.max(.43,1.60*predatorScale),z:.30*predatorScale};
 const biteOffsetX=-Math.sin(heldRoll)*biteHeight*preyScale,biteOffsetY=Math.cos(heldRoll)*biteHeight*preyScale;
 const targetRootX=mouthLocal.x-biteOffsetX+side*(1-lock)*.08;
 const targetRootY=Math.max(.06,mouthLocal.y-biteOffsetY-(1-lock)*.18*Math.min(1.2,predatorScale));
 const targetRootZ=mouthLocal.z-.035+(1-lock)*.17*predatorScale;
 const targetXZ=localXZ(capture,targetRootX,targetRootZ),ox=Number(origin?.x)||0,oz=Number(origin?.z)||0;
 const baseY=Math.max(0,Number(motion?.rootY)||0),root={
  x:mix(ox,targetXZ.x,captureWeight),
  y:mix(baseY,targetRootY,captureWeight),
  z:mix(oz,targetXZ.z,captureWeight),
  yaw:mix(Number(origin?.yaw)||Number(capture?.yaw)||0,Number(capture?.yaw)||0,captureWeight),
  roll:mix(Number(motion?.rootRoll)||0,heldRoll,captureWeight),
  scale:preyScale
 };
 const yaw=root.yaw;
 const upper=socketAt(root,yaw,root.roll,preyScale,[0,upperHeight,.025]);
 const lower=socketAt(root,yaw,root.roll,preyScale,[0,lowerHeight,-.015]);
 const biteSocket=socketAt(root,yaw,root.roll,preyScale,[0,biteHeight,.035]);
 const mouthXZ=localXZ(capture,mouthLocal.x,mouthLocal.z),mouth={x:mouthXZ.x,y:mouthLocal.y,z:mouthXZ.z};
 const gripReach=clamp((predatorScale-.34)/.62);
 return{progress:p,side,predatorScale,preyScale,root,upper,lower,bite:biteSocket,mouth,gripReach,...contact};
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
 const frame=devourInteractionFrame(origin,capture,motion);
 return{x:frame.root.x,z:frame.root.z};
}
