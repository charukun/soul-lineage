/** A basic action owns its keys and clock. Weapon families adapt the pose before
 * anatomical IK; recipes, hit windows and the gameplay controller stay in charge. */
import {weaponSockets} from './rig-profiles.js';
export const WEAPON_MOTION_REVISION='weapon-grip-1';
export const WEAPON_MOTION_PROFILES=Object.freeze({
 sword:{label:'片手剣',center:1,lift:0,forward:0,stance:1,torque:1,weight:0,roll:0},
 great:{label:'大剣',center:.46,lift:.10,forward:-.06,stance:1.10,torque:1.12,weight:.045,roll:0},
 katana:{label:'刀',center:.62,lift:.045,forward:-.03,stance:1.04,torque:1,weight:.015,roll:Math.PI/2},
 spear:{label:'槍',center:.55,lift:-.02,forward:-.06,stance:1.08,torque:.84,weight:.02,roll:0},
 axe:{label:'戦斧',center:.48,lift:.10,forward:-.02,stance:1.14,torque:1.16,weight:.055,roll:0}
});
export function supportsAuthoredWeapon(weapon){return Object.hasOwn(WEAPON_MOTION_PROFILES,weapon);}
export function weaponPose(source,weapon,kind,phase){
 const profile=WEAPON_MOTION_PROFILES[weapon];
 if(!profile||weapon==='sword')return source;
 const pose=Object.fromEntries(Object.entries(source).map(([key,value])=>[key,Array.isArray(value)?value.slice():value]));
 const effort=Math.sin(Math.PI*phase)**2;
 pose.grip[0]*=profile.center;pose.grip[1]+=profile.lift;pose.grip[2]+=profile.forward;
 pose.blade[2]+=profile.roll;
 // Long blades load diagonally beside the leg rather than pointing into the floor.
 if(weapon==='great'||weapon==='katana'&&kind==='uppercut'){const floor=weapon==='great'?-.70:-.90;pose.blade[1]=floor+.04*Math.log1p(Math.exp((pose.blade[1]-floor)/.04));}
 pose.hips[1]*=profile.torque;pose.chest[1]*=profile.torque;
 pose.offset[1]-=profile.weight*effort;
 pose.spine[0]+=profile.weight*1.2*effort;
 for(const key of ['lead','rear'])if(pose[key])pose[key][0]*=profile.stance;
 if(pose.feet)pose.feet=Object.fromEntries(Object.entries(pose.feet).map(([side,foot])=>[side,{...foot,x:foot.x*profile.stance}]));
 // A pole thrust leads with the point, while cuts retain the authored arc.
 if(weapon==='spear'&&kind==='thrust'){pose.blade[0]*=.25;pose.blade[1]*=.35;pose.grip[0]-=.06;}
 return pose;
}
export const twoHandedWeapon=weapon=>!!weaponSockets[weapon]?.two;
