import { THREE as T } from '@soul/rendering';
import { solveTwoBone } from './pose-transfer.js';
const v=()=>new T.Vector3();
/** Rest-space anatomical hinge axes, with mirrored left/right closure and an
 * opposing thumb. Works on either normalized or visible raw humanoid bones. */
export function createHandClosure(bones,side){
 const wrist=bones[side+'Hand'], index=bones[side+'IndexProximal'],little=bones[side+'LittleProximal'],middle=bones[side+'MiddleProximal'];
 if(!wrist||!index||!little||!middle)return()=>{};
 const across=index.getWorldPosition(v()).sub(little.getWorldPosition(v())).normalize();
 const long=middle.getWorldPosition(v()).sub(wrist.getWorldPosition(v())).normalize();
 const normal=long.clone().cross(across).normalize(),sign=side==='left'?-1:1,rest=new Map();
 const normalLocal=normal.clone().applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion()).invert());
 for(const finger of ['Index','Middle','Ring','Little','Thumb'])for(const seg of ['Metacarpal','Proximal','Intermediate','Distal']){
  const name=side+finger+seg,b=bones[name];if(b){const inverse=b.getWorldQuaternion(new T.Quaternion()).invert();rest.set(name,{b,q:b.quaternion.clone(),axis:across.clone().applyQuaternion(inverse),opposition:normal.clone().applyQuaternion(inverse)});}
 }
 return(amount=1)=>{
  amount=T.MathUtils.clamp(amount,0,1);
  for(const[name,{b,q,axis,opposition}]of rest){
   const thumb=name.includes('Thumb'),angle=thumb?(name.endsWith('Metacarpal')?.4:name.endsWith('Proximal')?.8:.6):name.endsWith('Proximal')?.65:name.endsWith('Intermediate')?1.3:.92;
   b.quaternion.copy(q);if(thumb&&name.endsWith('Metacarpal'))b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(opposition,-.8*amount));
   b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axis,sign*angle*amount));
  }
  wrist.updateWorldMatrix(true,true);
  const a=bones[side+'ThumbMetacarpal'],b=bones[side+'ThumbProximal'],c=bones[side+'ThumbDistal'],indexMid=bones[side+'IndexIntermediate'];
  if(a&&b&&c&&indexMid&&amount>.5){
   const outward=normalLocal.clone().applyQuaternion(wrist.getWorldQuaternion(new T.Quaternion())).multiplyScalar(-sign);
   const target=indexMid.getWorldPosition(v()).addScaledVector(outward,.009);
   solveTwoBone(a,b,c,target,outward);wrist.updateWorldMatrix(true,true);
  }
 };
}
