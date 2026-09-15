import * as T from '../vendor/three.js';
import { solveTwoBone } from './limb-ik.js';
const v=()=>new T.Vector3();
/** Rest-space anatomical hinge axes, with mirrored left/right closure and an
 * opposing thumb. Works on either normalized or visible raw humanoid bones. */
export function createHandClosure(bones,side,{proximal=.65,thumbWrap=false}={}){
 const wrist=bones[side+'Hand'], index=bones[side+'IndexProximal'],little=bones[side+'LittleProximal'],middle=bones[side+'MiddleProximal'];
 if(!wrist||!index||!little||!middle)return()=>{};
 const across=index.getWorldPosition(v()).sub(little.getWorldPosition(v())),palmWidth=across.length();across.normalize();
 const long=middle.getWorldPosition(v()).sub(wrist.getWorldPosition(v())),palmLength=long.length();long.normalize();
 const normal=long.clone().cross(across).normalize(),sign=side==='left'?-1:1,rest=new Map();
 const normalLocal=normal.clone().applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion()).invert());
 const longLocal=long.clone().applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion()).invert()),restScale=wrist.getWorldScale(v()).length();
 for(const finger of ['Index','Middle','Ring','Little','Thumb'])for(const seg of ['Metacarpal','Proximal','Intermediate','Distal']){
  const name=side+finger+seg,b=bones[name];if(b){const inverse=b.getWorldQuaternion(new T.Quaternion()).invert();rest.set(name,{b,q:b.quaternion.clone(),axis:across.clone().applyQuaternion(inverse),opposition:normal.clone().applyQuaternion(inverse)});}
 }
 return(amount=1)=>{
  amount=T.MathUtils.clamp(amount,0,1);
  for(const[name,{b,q,axis,opposition}]of rest){
   const thumb=name.includes('Thumb'),angle=thumb?(name.endsWith('Metacarpal')?.4:name.endsWith('Proximal')?.8:.6):name.endsWith('Proximal')?proximal:name.endsWith('Intermediate')?1.3:.92;
   b.quaternion.copy(q);if(thumb&&name.endsWith('Metacarpal'))b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(opposition,-.8*amount));
   b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axis,sign*angle*amount));
  }
  wrist.updateWorldMatrix(true,true);
  const a=bones[side+'ThumbMetacarpal'],b=bones[side+'ThumbProximal'],c=bones[side+'ThumbDistal'],indexMid=bones[side+'IndexIntermediate'];
  if(a&&b&&c&&indexMid&&amount>.5){
   const outward=normalLocal.clone().applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion())).multiplyScalar(-sign);
   const target=indexMid.getWorldPosition(v()).addScaledVector(outward,.009);
   if(thumbWrap){
    // Oppose across the near side of the handle. Reaching straight for the
    // index joint puts an anatomically short thumb through the cylinder axis.
    const scale=wrist.getWorldScale(v()).length()/restScale;
    target.addScaledVector(outward,palmWidth*.37*scale-.009);
    target.addScaledVector(longLocal.clone().applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion())),-palmLength*.27*scale);
   }
   const saved=[a.quaternion.clone(),b.quaternion.clone()];
   solveTwoBone(a,b,c,target,outward);
   const u=T.MathUtils.clamp((amount-.5)/.3,0,1),weight=u*u*(3-2*u);
   for(const [i,node]of [a,b].entries())node.quaternion.copy(saved[i].slerp(node.quaternion.clone(),weight));
   wrist.updateWorldMatrix(true,true);
  }
 };
}
