const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const safe=n=>Number.isFinite(Number(n))?Number(n):0;
const addRotation=(bone,x=0,y=0,z=0)=>{if(!bone)return;bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;};

function weaponDirection(frame){
  const pose=frame?.pose,hand=pose?.hand,tip=pose?.tip;if(!Array.isArray(hand)||!Array.isArray(tip))return null;const x=safe(tip[0])-safe(hand[0]),y=safe(tip[1])-safe(hand[1]),z=safe(tip[2])-safe(hand[2]),h=Math.hypot(x,z);return{yaw:Math.atan2(x,z),pitch:Math.atan2(y,Math.max(.001,h)),reach:Math.hypot(x,y,z)};
}
function leftDirection(frame){
  const pose=frame?.pose,left=pose?.left;if(!Array.isArray(left))return null;const x=safe(left[0])+.32,y=safe(left[1])-1.46,z=safe(left[2]),h=Math.hypot(x,z);return{yaw:Math.atan2(x,z),pitch:Math.atan2(y,Math.max(.001,h))};
}

/**
 * Maps the exact Tidebreak simulation snapshot that owns contact timing onto the
 * imported Rinne skeleton. Different proportions are retargeted, but attack
 * progress, body channels and weapon direction come from the same simulation
 * frame used by collision/damage.
 */
export function applyTidebreakPose(bones,frame){
  if(!frame||!bones)return false;const pose=frame.pose||{},progress=clamp(safe(frame.progress),0,1),attack=String(frame.attack||''),active=Boolean(attack);
  addRotation(bones.spine,clamp(safe(pose.pitch),-.55,.55),clamp(safe(pose.twist),-.85,.85),clamp(safe(pose.roll),-.55,.55));
  addRotation(bones.hips||bones.pelvis,0,clamp(safe(pose.pelvisYaw),-.65,.65),0);
  addRotation(bones.head,clamp(safe(pose.headPitch),-.35,.35),clamp(safe(pose.headLag),-.45,.45),clamp(safe(pose.headRoll),-.35,.35));
  const crouch=clamp(-safe(pose.crouch),-.15,.42);addRotation(bones.leftUpperLeg,crouch*.18,0,0);addRotation(bones.rightUpperLeg,crouch*.18,0,0);addRotation(bones.leftLowerLeg,-crouch*.22,0,0);addRotation(bones.rightLowerLeg,-crouch*.22,0,0);
  const weapon=weaponDirection(frame);if(weapon){const swing=active?Math.sin(progress*Math.PI):.35;addRotation(bones.rightUpperArm,-clamp(weapon.pitch,-1.15,1.15)*.68-.12*swing,clamp(weapon.yaw,-1.2,1.2)*.62,-clamp(weapon.yaw,-1.2,1.2)*.22);addRotation(bones.rightLowerArm,-.22-.32*swing,0,clamp(weapon.yaw,-1,1)*.12);}
  const left=leftDirection(frame);if(left){addRotation(bones.leftUpperArm,-clamp(left.pitch,-1.1,1.1)*.5-.18,clamp(left.yaw,-1.1,1.1)*.48,clamp(left.yaw,-1.1,1.1)*.18);addRotation(bones.leftLowerArm,-.32,0,0);}
  if(active){const impact=Math.sin(progress*Math.PI),guard=['guard','parry','counter','brace','ward','slip'].includes(attack);if(guard){addRotation(bones.spine,-.04*impact,0,.03*impact);addRotation(bones.leftUpperArm,-.18*impact,0,-.12*impact);}else{addRotation(bones.spine,.08*impact,0,0);addRotation(bones.rightUpperLeg,-.08*impact,0,0);addRotation(bones.leftUpperLeg,.05*impact,0,0);}}
  return true;
}

export function tidebreakFrameFromSnapshot(actor,{targetId=null,intent='attack',sector='front'}={}){
  if(!actor)return null;return{attack:actor.attack||null,progress:clamp(safe(actor.progress),0,1),slot:actor.slot||null,skill:actor.skill||null,guarding:Boolean(actor.guarding),stun:safe(actor.stun),pose:actor.pose||null,targetId,intent,sector};
}
