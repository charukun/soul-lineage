import { Quaternion, Vector3, Matrix4 } from 'three';
import { weaponCalibration, weaponTransferWeight } from '@soul/animations';

const V = a => new Vector3(...(a??[0,0,0]));
const Q = a => new Quaternion(...(a??[0,0,0,1]));

/** Carry placement and palm ownership transfer share the same measured socket. */
export function createWeaponTransferAdapter({bones,root,rest,point,solve,worldHand,shareWristTwist,lastCorrections,shoulderWidth,hierarchyQuaternion}) {
  function carryFrame(profile){
    const p=weaponCalibration(profile),c=p.carry;
    if(!c||!bones[c.bone])throw new Error('Missing weapon carry socket');
    return {profile:p,position:root.localToWorld(point(c.bone).add(V(c.position).multiplyScalar(rest.height/c.referenceHeight))),
      quaternion:hierarchyQuaternion(root).multiply(Q(c.rotation))};
  }
  function placeWeapon(object,profile,position,quaternion,appearanceScale){
    if(!Number.isFinite(appearanceScale)||appearanceScale<=0)throw new Error('Invalid weapon appearance scale');
    const world=new Matrix4().compose(position,quaternion,V([1,1,1]))
      .multiply(new Matrix4().makeScale(profile.scale*appearanceScale,profile.scale*appearanceScale,profile.scale*appearanceScale))
      .multiply(new Matrix4().makeTranslation(...profile.grip.map(x=>-x)));
    object.parent?.updateWorldMatrix(true,false);
    object.matrix.copy(new Matrix4().copy(object.parent?.matrixWorld??new Matrix4()).invert().multiply(world));
    object.matrixAutoUpdate=false;object.matrixWorldNeedsUpdate=true;object.updateWorldMatrix(true,true);
    return {a:root.worldToLocal(V(profile.bladeBase).applyMatrix4(world)).toArray(),b:root.worldToLocal(V(profile.bladeTip).applyMatrix4(world)).toArray(),radius:shoulderWidth*.035};
  }
  return {
    calibrateCarriedWeapon(object,profile,{appearanceScale=1}={}){
      root.updateWorldMatrix(true,true);const carry=carryFrame(profile);
      return placeWeapon(object,carry.profile,carry.position,carry.quaternion,appearanceScale);
    },
    /** Match the palm to the common carry socket around ownership transfer. The
     * weight is zero outside the profile's reach/release range (including skills).
     * Retarget the arm, not a floating sword between two unrelated sockets. */
    matchWeaponTransfer(profile,socket,draw){
      const p=weaponCalibration(profile),weight=weaponTransferWeight(draw,p.carry);
      if(!weight)return {weight,error:0};
      root.updateWorldMatrix(true,true);const carry=carryFrame(p),hand=bones.rightHand;
      const previous=Object.fromEntries(['rightUpperArm','rightLowerArm'].map(n=>[n,bones[n].quaternion.clone()]));
      const palm=hand.localToWorld(V(socket.position)),target=palm.clone().lerp(carry.position,weight);
      const handQ=hierarchyQuaternion(hand).slerp(carry.quaternion.clone().multiply(Q(p.rotation).invert()).multiply(Q(socket.quaternion).invert()),weight);
      worldHand('right',handQ);root.updateWorldMatrix(true,true);
      const palmOffset=root.worldToLocal(hand.localToWorld(V(socket.position))).sub(point('rightHand'));
      solve('right',root.worldToLocal(target).sub(palmOffset),point('rightLowerArm').sub(point('rightUpperArm')));
      worldHand('right',handQ);shareWristTwist('right');
      // Fade the solve itself as well, including its elbow-plane/twist choice.
      // A vanishing target offset must not reset the continuous track's twist.
      for(const [name,q]of Object.entries(previous))bones[name].quaternion.copy(q.slerp(bones[name].quaternion.clone(),weight));
      root.updateWorldMatrix(true,true);worldHand('right',handQ);
      const error=hand.localToWorld(V(socket.position)).distanceTo(carry.position);
      lastCorrections.push({side:'right',method:'weapon-socket-transfer',weight,error});return {weight,error};
    },
  };
}
