/* Original review motion templates. Semantic humanoid retargeting + two-bone leg IK.
 * No mocap or third-party animation is represented as built into the source models.
 * Coordinates: VRM0 normalized bind space (forward -Z, left -X). */
import * as T from '../vendor/three.js';
const TAU=Math.PI*2, clamp=T.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function pulse(t,a,b,c,d){if(t<a||t>d)return 0;if(t<b)return smooth((t-a)/(b-a));if(t<c)return 1;return 1-smooth((t-c)/(d-c));}
export const motionInfo={
 'Idle':{duration:4,label:'戦闘待機',note:'半身、低い重心、前後に開いた足、胸と顔を守るガード。接地を保った呼吸と小さな荷重移動。'},
 'Walk':{duration:1.14,label:'歩行',note:'左右交互の支持脚、脚長に合わせた二関節IK、腕と胴の逆位相。'},
 'Run':{duration:.74,label:'走行',note:'短い接地と滞空、膝の引き上げ、前傾と腕振り。'},
 'Attack':{duration:2.3,label:'踏み込み強撃',note:'深い溜めから踏み込み、腰・胸・肩を連鎖させて全身を乗せた強撃。大きなフォロースルーと構えへの復帰。'},
 'Hit Reaction':{duration:1.8,label:'被弾 → 立て直し',note:'胸と頭の遅れ、膝の沈み込み、重心の回復。'},
 'T-Pose':{duration:1,label:'リグ確認',note:'元のニュートラル姿勢。'}
};
export function createRetargetedClips(vrm){
 const h=vrm.humanoid, bones={};
 const flip=vrm.meta.metaVersion==='1'?-1:1;
 const canonicalLocal=v=>{v.x*=flip;v.z*=flip;return v;};
 for(const name of Object.keys(h.normalizedHumanBones)){const n=h.getNormalizedBoneNode(name);if(n)bones[name]=n;}
 const required=['hips','spine','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];
 const missing=required.filter(n=>!bones[n]);if(missing.length)throw new Error('Humanoid必須ボーンが不足: '+missing.join(', '));
 const rest={};for(const[name,n]of Object.entries(bones))rest[name]={p:n.position.clone(),q:n.quaternion.clone()};
 const reset=()=>{for(const[name,n]of Object.entries(bones)){n.position.copy(rest[name].p);n.quaternion.copy(rest[name].q);}};
 reset();vrm.scene.updateMatrixWorld(true);
 const rootQ=vrm.scene.getWorldQuaternion(new T.Quaternion());
 const footRest={}, legLengths={};for(const side of ['left','right']){footRest[side]=canonicalLocal(vrm.scene.worldToLocal(bones[side+'Foot'].getWorldPosition(new T.Vector3())));legLengths[side]=rest[side+'LowerLeg'].p.length()+rest[side+'Foot'].p.length();}
 const hipRest=rest.hips.p.clone(), scale=(legLengths.left+legLengths.right)/1.55;
 const euler=new T.Euler(0,0,0,'YXZ');
 const rot=(name,x=0,y=0,z=0)=>{if(bones[name])bones[name].quaternion.setFromEuler(euler.set(x*flip,y,z*flip,'YXZ'));};
 const canonicalPoint=p=>vrm.scene.localToWorld(canonicalLocal(p.clone()));
 const canonicalDir=p=>canonicalLocal(p.clone()).applyQuaternion(rootQ).normalize();
 const aim=(bone,child,target)=>{const origin=bone.getWorldPosition(new T.Vector3()),pQ=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();const direction=target.clone().sub(origin).applyQuaternion(pQ).normalize();bone.quaternion.setFromUnitVectors(child.position.clone().normalize(),direction);bone.updateWorldMatrix(false,true);};
 function solveLimb(upper,lower,end,target,pole){
  const A=bones[upper],B=bones[lower],C=bones[end];
  const origin=A.getWorldPosition(new T.Vector3());
  const a=origin.distanceTo(B.getWorldPosition(new T.Vector3())),b=B.getWorldPosition(new T.Vector3()).distanceTo(C.getWorldPosition(new T.Vector3()));
  const v=target.clone().sub(origin),distance=clamp(v.length(),Math.abs(a-b)+.0001,a+b-.0001);v.normalize();
  const bend=pole.clone().addScaledVector(v,-pole.dot(v)).normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  const knee=origin.clone().addScaledVector(v,along).addScaledVector(bend,height);
  aim(A,B,knee);aim(B,C,target);
 }
 function leg(side,position,pitch=0){solveLimb(side+'UpperLeg',side+'LowerLeg',side+'Foot',canonicalPoint(position),canonicalDir(new T.Vector3(0,0,-1)));const foot=bones[side+'Foot'];foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(rootQ).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),pitch*flip));foot.updateWorldMatrix(false,true);}
 function hand(side,target){const sign=side==='left'?-1:1;solveLimb(side+'UpperArm',side+'LowerArm',side+'Hand',canonicalPoint(target),canonicalDir(new T.Vector3(sign,-.65,.2)));}
 function fingers(flex=.16){for(const side of ['left','right']){const s=side==='left'?-1:1;for(const finger of ['Index','Middle','Ring','Little'])for(const seg of ['Proximal','Intermediate','Distal'])rot(side+finger+seg,0,s*flex,0);rot(side+'ThumbMetacarpal',0,s*.2,0);rot(side+'ThumbProximal',0,s*flex*.65,0);rot(side+'ThumbDistal',0,s*flex*.6,0);}}
 function relaxedArms(swing=0,bend=.12){rot('leftUpperArm',0,-.05,1.38);rot('rightUpperArm',0,.05,-1.38);bones.leftUpperArm.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),swing*flip));bones.rightUpperArm.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-swing*flip));rot('leftLowerArm',0,-bend,0);rot('rightLowerArm',0,bend,0);rot('leftHand',0,-.06,.025);rot('rightHand',0,.06,-.025);}
 function evaluate(name,t){
  reset();if(name==='T-Pose')return;fingers();const Tm=motionInfo[name].duration,p=t/Tm,w=p*TAU;
  if(name==='Idle'){
   // Integer-frequency curves keep both pose and velocity continuous at the loop seam.
   const breath=Math.sin(w),sway=Math.sin(w-.35),pressure=Math.cos(w*2);
   const left=footRest.left.clone(),right=footRest.right.clone();
   left.z-=.12*scale;left.x-=.04*scale;
   right.z+=.09*scale;right.x+=.03*scale;
   bones.hips.position.y-=scale*(.072+.008*pressure);
   bones.hips.position.z-=flip*.04*scale;
   bones.hips.position.x+=flip*.006*scale*breath;
   rot('hips',-.05,.11+.025*sway,.012*breath);
   rot('spine',-.17,-.10+.035*sway,-.012*breath);
   rot('chest',.08+.008*breath,-.12+.04*sway,0);
   rot('head',.03,.08-.03*sway,.006*breath);
   rot('leftShoulder',0,0,.10);rot('rightShoulder',0,0,-.10);
   vrm.scene.updateMatrixWorld(true);
   // Fixed foot targets avoid sliding or unnecessary stepping during combat idle.
   leg('left',left,0);leg('right',right,0);
   vrm.scene.updateMatrixWorld(true);
   const shoulderY=vrm.scene.worldToLocal(bones.leftUpperArm.getWorldPosition(new T.Vector3())).y;
   const L=new T.Vector3(-.18*scale,shoulderY+(-.05+.01*breath)*scale,-(.18+.02*sway)*scale);
   const R=new T.Vector3(.14*scale,shoulderY+(-.08-.01*breath)*scale,-(.24-.02*sway)*scale);
   hand('left',L);hand('right',R);fingers(.78);
   rot('leftHand',-.08,-.14,.08);rot('rightHand',-.10,.16,-.06);
  }else if(name==='Walk'||name==='Run'){
   const run=name==='Run',stance=run?.38:.61,stride=(run?.64:.37)*scale,lift=(run?.19:.075)*scale;
   const step=(p*2)%1;
   const bob=run?(step<.76?-.080-.012*Math.sin(Math.PI*step/.76):-.080+.105*Math.sin(Math.PI*(step-.76)/.24)):(-.035+.007*Math.cos(w*2));
   bones.hips.position.x+=flip*(run?.008:.013)*scale*Math.sin(w);bones.hips.position.y+=bob*scale;
   rot('hips',run?-.04:0,.065*Math.cos(w),.028*Math.sin(w));rot('spine',run?-.15:-.035,-.05*Math.cos(w),-.014*Math.sin(w));rot('chest',0,-.085*Math.cos(w),0);rot('head',run?.09:.025,.027*Math.cos(w),.012*Math.sin(w));
   relaxedArms(-(run?.67:.38)*Math.cos(w+.28),run?1.35:.28);if(run)fingers(.62);
   vrm.scene.updateMatrixWorld(true);
   for(const [i,s]of ['left','right'].entries()){
    const f=(p+i*.5)%1,point=footRest[s].clone();let pitch=0;
    if(f<stance){let u=f/stance;point.z+=(-stride/2+stride*u);pitch=(u<.18?-.16*(1-u/.18):0)+(u>.72?.3*smooth((u-.72)/.28):0);point.y+=u>.78?.012*scale*smooth((u-.78)/.22):0;}
    else{const u=(f-stance)/(1-stance);point.z+=stride/2-stride*smooth(u);point.y+=lift*Math.pow(Math.sin(Math.PI*u),run?1:.8);pitch=(run?.48:.28)*Math.sin(Math.PI*u)-.13*smooth((u-.7)/.3);}
    leg(s,point,pitch);
   }
  }else if(name==='Attack'){
   const crouch=pulse(t,.04,.18,.38,.64),wind=pulse(t,.16,.38,.48,.72),drive=pulse(t,.54,.72,.82,1.04),impact=pulse(t,.73,.82,.86,1.02),follow=pulse(t,.84,1.02,1.22,1.55),recover=pulse(t,1.34,1.66,1.92,2.26);
   const power=Math.max(drive,impact),commit=Math.max(follow,power);
   bones.hips.position.y-=scale*(.035+.085*crouch+.035*commit-.018*recover);
   bones.hips.position.z-=flip*scale*(.035*wind+.24*drive+.10*follow-.02*recover);
   bones.hips.position.x+=flip*scale*(-.025*wind+.055*impact+.025*follow);
   rot('hips',-.08*crouch-.055*impact,-.42*wind+.68*drive+.24*follow-.12*recover,-.035*impact);
   rot('spine',-.12*crouch-.10*drive,-.28*wind+.42*drive+.20*follow-.08*recover,-.07*impact);
   rot('chest',-.08*crouch-.12*impact,-.22*wind+.36*drive+.25*follow-.10*recover,-.04*impact);
   rot('head',.05*crouch+.10*impact,.16*wind-.24*drive-.12*follow+.06*recover,.025*impact);
   relaxedArms();vrm.scene.updateMatrixWorld(true);
   const left=footRest.left.clone(),right=footRest.right.clone();
   left.z-=scale*(.16*crouch+.34*drive+.09*follow);left.x-=scale*(.035*crouch+.025*drive);
   right.z+=scale*(.12*crouch-.04*drive);right.x+=scale*(.04*crouch+.018*impact);
   left.y+=scale*.018*impact;right.y-=scale*.008*drive;
   leg('left',left,-.08*crouch+.12*impact);leg('right',right,.18*drive+.10*follow);
   vrm.scene.updateMatrixWorld(true);
   const shoulderY=vrm.scene.worldToLocal(bones.rightUpperArm.getWorldPosition(new T.Vector3())).y;
   const leftNeutral=canonicalLocal(vrm.scene.worldToLocal(bones.leftHand.getWorldPosition(new T.Vector3())));const rightNeutral=canonicalLocal(vrm.scene.worldToLocal(bones.rightHand.getWorldPosition(new T.Vector3())));
   const guardL=new T.Vector3(-.19*scale,shoulderY+.02*scale,-.16*scale);
   const windL=new T.Vector3(-.23*scale,shoulderY+.12*scale,-.06*scale);
   const strikeL=new T.Vector3(-.10*scale,shoulderY-.03*scale,-.30*scale);
   const guardR=new T.Vector3(.17*scale,shoulderY-.02*scale,-.14*scale);
   const windR=new T.Vector3(.34*scale,shoulderY+.17*scale,.04*scale);
   const strikeR=new T.Vector3(-.02*scale,shoulderY-.08*scale,-.63*scale);
   const leftTarget=leftNeutral.clone().lerp(guardL,.8*crouch).lerp(windL,.68*wind).lerp(strikeL,.78*commit);
   const rightTarget=rightNeutral.clone().lerp(guardR,.75*crouch).lerp(windR,.95*wind).lerp(strikeR,Math.min(1,1.12*power+.58*follow));
   hand('left',leftTarget);hand('right',rightTarget);
   rot('leftShoulder',-.08*drive,-.04*wind,.10*impact);rot('rightShoulder',-.24*drive,.12*wind,-.20*impact);
   rot('rightHand',-.12*wind+.18*impact,.08*follow,-.22*impact);
   fingers(.32+.92*Math.max(wind,commit));
  }else if(name==='Hit Reaction'){
   const recoil=pulse(t,.08,.19,.28,.72),settle=pulse(t,.27,.5,.65,1.6);
   bones.hips.position.y-=scale*(.018+.074*recoil+.036*settle);bones.hips.position.z+=flip*scale*.045*recoil;
   rot('hips',.1*recoil,.04*recoil,.035*recoil);rot('spine',.24*recoil-.08*settle,-.07*recoil,.045*recoil);rot('chest',.15*recoil-.10*settle,0,0);rot('head',.25*pulse(t,.13,.23,.36,.82)-.08*settle,-.08*recoil,-.04*recoil);
   relaxedArms(.1*recoil,.12+.9*recoil);rot('leftUpperArm',-.13*recoil,0,1.38-.36*recoil);rot('rightUpperArm',-.13*recoil,0,-1.38+.30*recoil);fingers(.16+.16*recoil);
   vrm.scene.updateMatrixWorld(true);for(const s of ['left','right'])leg(s,footRest[s]);
  }
  vrm.scene.updateMatrixWorld(true);
 }
 const clips={},report={mappedBones:Object.keys(bones),missing,scale,metaVersion:vrm.meta.metaVersion,axisConjugation:flip,method:'semantic Humanoid → VRM normalized bones; target-specific two-bone leg IK; 30 Hz baked quaternion tracks',authorship:'Original authored review templates; not source-model built-ins or motion capture',durations:{}};
 for(const [name,info] of Object.entries(motionInfo)){
  const steps=Math.ceil(info.duration*30),times=[],curves={};for(const n of Object.keys(bones))curves[n]=[];const hipValues=[];
  for(let i=0;i<=steps;i++){
   const time=i/steps*info.duration;times.push(time);evaluate(name,time);
   for(const[n,bone]of Object.entries(bones)){const arr=bone.quaternion.toArray();if(!arr.every(Number.isFinite))throw new Error('Nonfinite retarget quaternion: '+name+'/'+n);const values=curves[n];if(values.length){const dot=arr.reduce((v,q,k)=>v+q*values[values.length-4+k],0);if(dot<0)for(let k=0;k<4;k++)arr[k]*=-1;}values.push(...arr);}
   hipValues.push(...bones.hips.position.toArray());
  }
  const tracks=Object.keys(bones).map(n=>new T.QuaternionKeyframeTrack(bones[n].uuid+'.quaternion',times,curves[n]));tracks.push(new T.VectorKeyframeTrack(bones.hips.uuid+'.position',times,hipValues));clips[name]=new T.AnimationClip(name,info.duration,tracks);report.durations[name]=info.duration;
 }
 reset();vrm.scene.updateMatrixWorld(true);h.update();return{clips,report,bones,rest};
}
