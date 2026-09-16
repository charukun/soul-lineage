// Presentation variants for the real `slash` gameplay motion.
// They share one gameplay clock and one guard seam. This module only reshapes the
// full-body presentation path; hit, damage and actor/world authority remain external.
export const SLASH_VARIANTS=Object.freeze(['cross','return','finisher']);

const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const lerp=(a,b,t)=>a+(b-a)*t;
const ramp=(p,a,b)=>smooth((p-a)/(b-a));
const window=(p,a,b,c,d)=>ramp(p,a,b)*(1-ramp(p,c,d));
const copyPose=pose=>Object.fromEntries(Object.entries(pose).map(([name,value])=>[name,value.slice()]));

export function normalizeSlashVariant(value){
  return SLASH_VARIANTS.includes(value)?value:'cross';
}

function returnCut(pose,p){
  const out=copyPose(pose),body=Math.sin(Math.PI*p)**2;
  const load=window(p,.10,.24,.39,.50),release=window(p,.36,.48,.70,.84);
  // Reverse the rotational chain through pelvis -> chest -> weapon while counter-loading
  // the weapon hand outside the torso. Avoid a cross-body arm path that collapses clearance.
  for(const name of ['hips','spine','chest'])out[name][1]=lerp(out[name][1],-out[name][1]*1.05,body*.96);
  out.head[1]=lerp(out.head[1],-out.head[1]*.60,body*.72);
  out.offset[0]=lerp(out.offset[0],-out.offset[0]*.82,body*.90);
  out.offset[2]+=.030*release;
  out.grip[0]-=.55*load;
  out.grip[2]+=.035*release;
  out.blade[0]=lerp(out.blade[0],-out.blade[0],body);
  out.blade[2]=lerp(out.blade[2],-out.blade[2]*.90,body*.90);
  out.shield[0]+=.12*load;
  out.shield[2]+=.045*release;
  out.lead[0]+=.035*release;
  out.rear[0]-=.030*load;
  return out;
}

function finishingCut(pose,p){
  const out=copyPose(pose);
  const load=window(p,.08,.20,.40,.50),strike=window(p,.34,.48,.68,.80),brake=window(p,.58,.70,.90,.98);
  // Build a visibly different high preparation and vertical force chain. The sword
  // still crosses the shared contact clock at p=.5, but the energy arrives from a
  // raised guard and is absorbed by a deeper base after contact.
  out.hips[0]-=.055*strike;out.hips[1]*=1-.55*load;
  out.spine[0]-=.080*strike;out.spine[1]*=1-.62*load;
  out.chest[0]-=.070*strike;out.chest[1]*=1-.68*load;
  out.head[0]+=.035*load-.020*strike;out.head[1]*=1-.72*load;
  out.offset[1]-=.050*load+.045*strike;
  out.offset[2]+=.050*strike-.018*brake;
  out.grip[1]+=.56*load-.11*strike;
  out.grip[2]-=.080*load-.055*strike;
  out.blade[0]*=1-.88*load;
  out.blade[1]+=.52*load-.20*strike;
  out.blade[2]*=1-.70*load;
  out.shield[1]+=.16*load-.05*strike;
  out.shield[2]-=.055*load;
  out.lead[2]+=.055*strike;
  out.rear[2]-=.030*load;
  return out;
}

export function applySlashVariant(pose,p,variant='cross'){
  const id=normalizeSlashVariant(variant),phase=clamp(p);
  // Guarantee exact shared seams instead of relying on trigonometric near-zeroes.
  if(phase===0||phase===1)return copyPose(pose);
  if(id==='return')return returnCut(pose,phase);
  if(id==='finisher')return finishingCut(pose,phase);
  return copyPose(pose);
}
