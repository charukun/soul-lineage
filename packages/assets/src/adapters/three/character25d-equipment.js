import {createRinneWeapon,disposeRinneEquipment,resolveRinneEquipment,RINNE_EQUIPMENT_PROFILES} from './runtime-equipment.js';

// Fixed-length two-bone solve in the parent's local space. No limb scaling.
export function solveCharacter25DHand(THREE,rig,side,worldTarget) {
  const upper=rig.byName.get('upperArm.'+side),lower=rig.byName.get('lowerArm.'+side),hand=rig.byName.get('hand.'+side);
  upper.parent.updateWorldMatrix(true,false);
  const target=upper.parent.worldToLocal(worldTarget.clone()).sub(upper.position),l1=lower.position.length(),l2=hand.position.length();
  const d=Math.max(.0001,Math.min(target.length(),l1+l2-.00001)),axis=target.normalize();
  const bend=new THREE.Vector3(side==='R'?-1:1,0,-.35);bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<1e-6)bend.set(0,0,1);bend.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),elbow=axis.clone().multiplyScalar(along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  upper.quaternion.setFromUnitVectors(lower.position.clone().normalize(),elbow.clone().normalize());
  const forearm=axis.multiplyScalar(d).sub(elbow).applyQuaternion(upper.quaternion.clone().invert());
  lower.quaternion.setFromUnitVectors(hand.position.clone().normalize(),forearm.normalize());
  upper.updateWorldMatrix(true,true);
}

function calibration(base,override={}) {
  // Same geometry-space fields as @soul/animations.weaponCalibration; callers
  // can pass those existing calibration records directly, without alias copies.
  const p={...base,...override};
  for(const key of ['grip','supportGrip','bladeBase','bladeTip'])if(!Array.isArray(p[key])||p[key].length!==3||!p[key].every(Number.isFinite))throw new Error('Invalid equipment '+key);
  for(const key of ['rotation','supportRotation'])if(!Array.isArray(p[key])||p[key].length!==4||!p[key].every(Number.isFinite)||Math.hypot(...p[key])<.0001)throw new Error('Invalid equipment '+key);
  if(!Number.isFinite(p.scale)||p.scale<=0||p.scale>10||typeof p.twoHanded!=='boolean'||!['socket-depth','front','behind'].includes(p.occlusionMode))throw new Error('Invalid equipment presentation');
  return p;
}

export function createCharacter25DEquipment(THREE,{body,rig,sockets,height}) {
  const add=(name,parent)=>{const node=new THREE.Object3D();node.name='Character25D:'+name;parent.add(node);sockets[name]=node;return node;};
  sockets.rightHand=sockets.handR;sockets.leftHand=sockets.offhand=sockets.handL;
  // Preserve the legacy socket object, but make its ownership explicit.
  sockets.rightHand.add(sockets.weapon);sockets.weapon.position.set(0,0,0);
  const gripFrame=add('gripFrame',sockets.weapon),support=add('secondaryGripTarget',gripFrame);
  const hitbox=add('weaponHitboxAnchor',gripFrame),trail=add('trailOrigin',gripFrame);
  sockets.hitbox=hitbox;
  const shieldAnchor=add('shieldAnchor',sockets.leftHand),heldAnchor=add('heldItemAnchor',sockets.leftHand);
  let state={weapon:null,shield:false},main=null,shield=null,held=null,profile=null,shieldProfile=null,signature='';
  const point=new THREE.Vector3(),target=new THREE.Vector3(),q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0);
  const rightTarget=new THREE.Vector3(),leftTarget=new THREE.Vector3();
  function place(anchor,p){const s=p.scale/height;anchor.scale.setScalar(s);anchor.quaternion.fromArray(p.rotation).normalize();anchor.position.fromArray(p.grip).multiplyScalar(-s).applyQuaternion(anchor.quaternion);}
  function setEquipment(value={},overrides={}) {
    const next=resolveRinneEquipment(value),nextProfile=next.weapon?calibration(RINNE_EQUIPMENT_PROFILES[next.weapon],overrides[next.weapon]):null;
    if(nextProfile?.twoHanded)next.shield=false;
    const nextShield=next.shield?calibration(RINNE_EQUIPMENT_PROFILES.shield,overrides.shield):null;
    const key=JSON.stringify([next,nextProfile,nextShield]);if(key===signature)return;
    const nextMain=next.weapon?createRinneWeapon(THREE,next.weapon):null,nextModel=next.shield?createRinneWeapon(THREE,'shield'):null;
    disposeRinneEquipment(main);disposeRinneEquipment(shield);main=nextMain;shield=nextModel;state=next;profile=nextProfile;shieldProfile=nextShield;signature=key;
    if(main){place(gripFrame,profile);gripFrame.add(main);support.position.fromArray(profile.supportGrip);support.quaternion.fromArray(profile.supportRotation).normalize();hitbox.position.fromArray(profile.bladeBase);trail.position.fromArray(profile.bladeTip);}
    if(shield){place(shieldAnchor,shieldProfile);shieldAnchor.add(shield);}
    heldAnchor.visible=!shield&&!profile?.twoHanded;
  }
  function setHeldItem(item,p={grip:[0,0,0],rotation:[0,0,0,1],scale:1}) {
    if(!Array.isArray(p.grip)||p.grip.length!==3||!p.grip.every(Number.isFinite)||!Array.isArray(p.rotation)||p.rotation.length!==4||!p.rotation.every(Number.isFinite)||!Number.isFinite(p.scale)||p.scale<=0)throw new Error('Invalid held item calibration');
    const previous=held;held?.removeFromParent();held=item||null;place(heldAnchor,p);if(held)heldAnchor.add(held);return previous;
  }
  function orient(socket,rotation){socket.parent.getWorldQuaternion(parentQ);body.getWorldQuaternion(q);q.multiply(rotation);socket.quaternion.copy(parentQ.invert().multiply(q));}
  function pose(motion) {
    if(!main&&!shield&&!held)return;
    sockets.leftHand.quaternion.identity();
    body.updateWorldMatrix(true,true);
    const strike=motion.action==='attack'?Math.sin(Math.PI*Math.min(1,motion.time/.7)):0;
    if(main){
      const hand=rig.byName.get('hand.R');hand.getWorldPosition(target);body.worldToLocal(target);target.z+=.035;
      if(profile.twoHanded)target.set(-.055,.49,.09);
      target.y+=strike*.05;target.z+=strike*.10;
      if(profile.occlusionMode==='front')target.z+=.07;if(profile.occlusionMode==='behind')target.z-=.07;
      // Keep the full support pair in both arms' reach, including custom scales.
      const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.12-strike*.9,0,profile.twoHanded?.80:.42-strike*.18));
      const supportDelta=new THREE.Vector3().fromArray(profile.supportGrip).sub(new THREE.Vector3().fromArray(profile.grip)).multiplyScalar(profile.scale/height).applyQuaternion(new THREE.Quaternion().fromArray(profile.rotation).normalize()).applyQuaternion(rotation);
      for(let pass=0;pass<12;pass++)for(const side of profile.twoHanded?['R','L']:['R']){
        const shoulder=rig.byName.get('upperArm.'+side),elbow=rig.byName.get('lowerArm.'+side),wrist=rig.byName.get('hand.'+side);
        shoulder.getWorldPosition(point);body.worldToLocal(point);if(side==='L')point.sub(supportDelta);
        const radius=elbow.position.length()+wrist.position.length()-.004,delta=target.clone().sub(point);if(delta.length()>radius)target.copy(point).add(delta.setLength(radius));
      }
      body.localToWorld(target);solveCharacter25DHand(THREE,rig,'R',target);orient(sockets.weapon,rotation);
      body.updateWorldMatrix(true,true);
      if(profile.twoHanded){support.getWorldPosition(target);solveCharacter25DHand(THREE,rig,'L',target);support.getWorldQuaternion(q);rig.byName.get('hand.L').parent.getWorldQuaternion(parentQ);rig.byName.get('hand.L').quaternion.copy(parentQ.invert().multiply(q));}
    }
    if(shield){rig.byName.get('hand.L').getWorldPosition(target);body.worldToLocal(target);target.y+=.035;target.z+=.08;body.localToWorld(target);solveCharacter25DHand(THREE,rig,'L',target);orient(sockets.leftHand,new THREE.Quaternion().setFromAxisAngle(axis,-.25));}
    body.updateWorldMatrix(true,true);sockets.rightHand.getWorldPosition(rightTarget);sockets.leftHand.getWorldPosition(leftTarget);
  }
  function project(view) {
    if(!main&&!shield&&!held)return;
    // The same world-space grips drive the drawing's arm bones. Their local Z
    // is a socket-aware depth proxy: a far arm/weapon passes behind the torso,
    // a near arm/hand covers it. Depth is recomputed for every facing and pose.
    for(const [side,enabled,world] of [['R',main,rightTarget],['L',shield||held||profile?.twoHanded,leftTarget]]) {
      if(!enabled)continue;
      const upper=view.rig.byName.get('upperArm.'+side),physical=rig.byName.get('upperArm.'+side);
      physical.getWorldPosition(point);upper.parent.worldToLocal(point);
      // Only depth is transferred at the shoulder; preserve original UV joins.
      upper.position.z=point.z;
      solveCharacter25DHand(THREE,view.rig,side,world);
    }
    view.group.updateWorldMatrix(true,true);view.rig.skeleton.update();
  }
  const pos=node=>node.getWorldPosition(new THREE.Vector3()).toArray();
  function snapshot(){body.updateWorldMatrix(true,true);return {equipment:{...state},twoHanded:Boolean(profile?.twoHanded),hand:pos(sockets.rightHand),offhand:pos(sockets.leftHand),actualGrip:main?main.localToWorld(new THREE.Vector3().fromArray(profile.grip)).toArray():null,secondaryGrip:pos(support),trail:pos(trail),hitbox:pos(hitbox),occlusionMode:profile?.occlusionMode||null};}
  return {setEquipment,setHeldItem,pose,project,snapshot,dispose(){disposeRinneEquipment(main);disposeRinneEquipment(shield);main=shield=null;held?.removeFromParent();held=null;}};
}
