const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
const smooth01=value=>{const t=clamp(Number(value)||0,0,1);return t*t*(3-2*t);};
const SWEEP=new Set(['slash','diagonal','back','crosscut','heavy','round','sweep','katanaKesa','katanaDraw','katanaReturn','spearwheel']);
const THRUST=new Set(['thrust','pierce','dash','bullrush','jab','straight','oneinch']);
const UPWARD=new Set(['uppercut','risingfist','sky']);
const LEAP=new Set(['leap','meteor']);
const COMBO=new Set(['barrage','rushfist','crosscut','round','spearwheel']);

function rotate(bone,x=0,y=0,z=0){if(!bone)return;bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;}
function shiftY(bone,value=0){if(bone)bone.position.y+=value;}
function styleFor(attack){
  if(SWEEP.has(attack))return 'sweep';
  if(THRUST.has(attack))return 'thrust';
  return 'strike';
}
function idleGuard(bones,time){
  const breath=Math.sin((Number(time)||0)*2.35);
  rotate(bones.hips,0,breath*.025);
  rotate(bones.spine,-.11-breath*.012,breath*.018);
  rotate(bones.head,0,-breath*.012);
  rotate(bones.leftUpperLeg,.12);rotate(bones.rightUpperLeg,-.07);
  rotate(bones.leftLowerLeg,-.14);rotate(bones.rightLowerLeg,-.1);
  rotate(bones.leftUpperArm,-.26,0,-.2);rotate(bones.rightUpperArm,-.42,0,.18);
  rotate(bones.leftLowerArm,-.5);rotate(bones.rightLowerArm,-.58);
}
function sweepPose(bones,{release,recover,strike,cinematic}){
  const arc=(release*1.05-recover*.32)*cinematic;
  rotate(bones.rightUpperArm,-.48-.72*arc,-.22-.34*arc,.28-.44*arc);
  rotate(bones.rightLowerArm,-.46-.35*strike);
  rotate(bones.leftUpperArm,-.18-.3*strike,0,-.24-.18*strike);
  rotate(bones.leftLowerArm,-.38);
}
function thrustPose(bones,{progress,recover,cinematic}){
  const drive=smooth01(clamp((progress-.12)/.46,0,1))*(1-recover*.5)*cinematic;
  rotate(bones.spine,-drive*.22);
  rotate(bones.rightUpperArm,-.72-.22*drive,-.12,.08);rotate(bones.rightLowerArm,-.12-.2*(1-drive));
  rotate(bones.leftUpperArm,-.3,0,-.3);rotate(bones.leftLowerArm,-.5);
  rotate(bones.rightUpperLeg,-drive*.2);rotate(bones.leftUpperLeg,drive*.15);
}
function strikePose(bones,{release,recover,cinematic}){
  const punch=(release-recover*.35)*cinematic;
  rotate(bones.rightUpperArm,-.5-.46*punch,-.22*punch,.22);
  rotate(bones.rightLowerArm,-.58*(1-punch)-.08);
  rotate(bones.leftUpperArm,-.32,0,-.3);rotate(bones.leftLowerArm,-.62);
}
const STYLE_POSE=Object.freeze({sweep:sweepPose,thrust:thrustPose,strike:strikePose});

export function applyReviewCombatMotion(bones,frame,sequence,time){
  if(!bones)return;
  const attack=String(frame?.attack||'');
  if(!attack){idleGuard(bones,time);return;}
  const progress=clamp(Number(frame?.progress)||0,0,1),cinematic=sequence?.stage==='execute'?1.16:1;
  const wind=smooth01(clamp(progress/.24,0,1)),release=smooth01(clamp((progress-.18)/.42,0,1));
  const recover=smooth01(clamp((progress-.62)/.38,0,1)),strike=Math.sin(clamp((progress-.08)/.78,0,1)*Math.PI);
  const twist=(release-wind*.72-recover*.35)*cinematic,grounded=1-Math.min(1,Math.abs(progress-.48)*1.8);
  rotate(bones.hips,-strike*.055,twist*.28);shiftY(bones.hips,-grounded*.025);
  rotate(bones.spine,-.08-strike*.12,twist*.52,Math.sin(progress*Math.PI*2)*.055*cinematic);
  rotate(bones.chest,-strike*.045,twist*.24);rotate(bones.head,strike*.025,-twist*.2);
  rotate(bones.leftUpperLeg,.14*grounded-.09*release);rotate(bones.rightUpperLeg,-.12*grounded-.13*release);
  rotate(bones.leftLowerLeg,-.18*grounded);rotate(bones.rightLowerLeg,-.15*grounded);
  STYLE_POSE[styleFor(attack)](bones,{progress,release,recover,strike,cinematic});
  if(UPWARD.has(attack)){rotate(bones.spine,strike*.2);rotate(bones.rightUpperArm,strike*.42);rotate(bones.rightLowerArm,-strike*.22);}
  if(COMBO.has(attack)){
    const switchSide=Math.sin(progress*Math.PI*4);
    rotate(bones.hips,0,switchSide*.16*strike);rotate(bones.spine,0,switchSide*.22*strike);
    rotate(bones.leftUpperArm,-Math.max(0,switchSide)*.34);rotate(bones.rightUpperArm,-Math.max(0,-switchSide)*.34);
  }
  if(LEAP.has(attack))shiftY(bones.hips,Math.sin(progress*Math.PI)*.16*cinematic);
}
