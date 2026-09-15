import * as T from '../vendor/three.js';

/** Delta IK preserves the bone's rest-space axial twist, including raw VRM rigs. */
export function aimBone(bone, child, target) {
  const origin=bone.getWorldPosition(new T.Vector3());
  const from=child.getWorldPosition(new T.Vector3()).sub(origin), to=target.clone().sub(origin);
  if (from.lengthSq()<1e-12 || to.lengthSq()<1e-12) return;
  const world=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(bone.getWorldQuaternion(new T.Quaternion()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert()).multiply(world).normalize();
  bone.updateWorldMatrix(false,true);
}
export function solveTwoBone(a,b,c,target,pole) {
  const origin=a.getWorldPosition(new T.Vector3()), l1=origin.distanceTo(b.getWorldPosition(new T.Vector3())), l2=b.getWorldPosition(new T.Vector3()).distanceTo(c.getWorldPosition(new T.Vector3()));
  const direction=target.clone().sub(origin);
  if (direction.lengthSq()<1e-12 || l1+l2<1e-5) return Infinity;
  const reach=T.MathUtils.clamp(direction.length(),Math.abs(l1-l2)+1e-5,(l1+l2)*.997);
  direction.normalize(); const destination=origin.clone().addScaledVector(direction,reach);
  const bend=pole.clone().addScaledVector(direction,-pole.dot(direction));
  if(bend.lengthSq()<1e-10) bend.set(0,0,1).addScaledVector(direction,-direction.z);
  bend.normalize();
  const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const elbow=origin.clone().addScaledVector(direction,along).addScaledVector(bend,height);
  aimBone(a,b,elbow);aimBone(b,c,destination);
  return c.getWorldPosition(new T.Vector3()).distanceTo(target);
}

