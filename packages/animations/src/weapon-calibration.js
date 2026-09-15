import { normalizeQ } from './quality-math.js';
const vec=v=>Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&Math.abs(x)<=10);
export function weaponCalibration(input) {
  if(!input||typeof input.id!=='string'||input.id.length>96||input.version!==1||!vec(input.grip)||!vec(input.supportGrip)||!vec(input.bladeBase)||!vec(input.bladeTip)||!Number.isFinite(input.scale)||input.scale<=0||input.scale>10||typeof input.twoHanded!=='boolean')throw new Error('Invalid weapon calibration');
  let carry;
  if(input.carry){
    const c=input.carry;
    if(typeof c.bone!=='string'||c.bone.length>64||!vec(c.position)||!Number.isFinite(c.referenceHeight)||c.referenceHeight<=0||
      ![c.reach,c.transfer,c.release].every(Number.isFinite)||c.reach<0||c.reach>=c.transfer||c.transfer>=c.release||c.release>1)throw new Error('Invalid carry calibration');
    carry={...c,position:[...c.position],rotation:normalizeQ(c.rotation)};
  }
  return {...input,grip:[...input.grip],supportGrip:[...input.supportGrip],bladeBase:[...input.bladeBase],bladeTip:[...input.bladeTip],rotation:normalizeQ(input.rotation??[0,0,0,1]),...(carry?{carry}:{})};
}
// These are the existing simulator geometry-space grips, not replacement gameplay data.
export const REVIEW_SWORD_CALIBRATION=Object.freeze(weaponCalibration({version:1,id:'review-sword.v1',grip:[0,-.065,0],supportGrip:[0,-.065,0],bladeBase:[0,.21,0],bladeTip:[0,1.62,0],scale:.5,twoHanded:false,
  // Existing simulator carry: root-aligned offset, XYZ Euler (-2.10,.08,-.18).
  carry:{bone:'hips',position:[ -.24,.05,-.08 ],rotation:[-.8650098558992728,-.05808337490025697,-.07923247886480297,.492043173969779],referenceHeight:2.02,reach:.10,transfer:.25,release:.40}
}));
export function weaponTransferWeight(draw,carry) {
  if(!Number.isFinite(draw))throw new Error('Invalid weapon draw');
  if(!carry||draw<=carry.reach||draw>=carry.release)return 0;
  const t=draw<=carry.transfer?(draw-carry.reach)/(carry.transfer-carry.reach):(carry.release-draw)/(carry.release-carry.transfer);
  return t*t*(3-2*t);
}
export function bodyCompensation({height=1,width=1,arms=1,shoulders=1,ageScale=1,clothingMargin=0}={}) {
  if(![height,width,arms,shoulders,ageScale].every(x=>Number.isFinite(x)&&x>=.2&&x<=3)||!Number.isFinite(clothingMargin)||clothingMargin<0||clothingMargin>.2)throw new Error('Invalid body compensation');
  return {height,width,arms,shoulders,ageScale,clothingMargin,reachRatio:arms/shoulders,weaponScale:ageScale,layer:'presentation'};
}
