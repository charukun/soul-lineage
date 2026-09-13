import { Quaternion, Vector3, Matrix4 } from 'three';
import { normalizeHumanoidPose, retargetHumanoidPose, selfIntersectionRisks, bodyCompensation, weaponCalibration } from '@soul/animations';

const V = a => new Vector3(...(a??[0,0,0]));
const Q = a => new Quaternion(...(a??[0,0,0,1]));
const SIDES=['left','right'];
/** Avoid extracting a skewed rotation from non-uniform body scale. */
export function hierarchyQuaternion(node) {
  const chain=[];for(let n=node;n;n=n.parent)chain.push(n);
  const q=Q();for(let i=chain.length-1;i>=0;i--)q.multiply(chain[i].quaternion);return q.normalize();
}
export function captureMotionRest(bones,height) {
  if(!(height>.1&&height<100)||!bones.hips)throw new Error('Invalid motion rest rig');
  return {height,hips:bones.hips.position.toArray(),bones:Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{local:b.quaternion.toArray(),position:b.position.toArray(),parentWorld:hierarchyQuaternion(b.parent).toArray()}]))};
}
export function captureNormalizedMotion(bones,rest) {
  return normalizeHumanoidPose({rotations:Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,b.quaternion.toArray()])),hips:bones.hips.position.toArray()},rest);
}
export function applyNormalizedMotion(bones,pose,rest) {
  const raw=retargetHumanoidPose(pose,rest);
  for(const [name,q]of Object.entries(raw.rotations))bones[name]?.quaternion.fromArray(q);
  bones.hips.position.fromArray(raw.hips);
}

/** Shared anatomical clearance/IK adapter, opt-in per presentation consumer.
 * Must run AFTER modular lengths and primary animation, BEFORE springs/attachments.
 * Local source metres keep age/root scale out of the solver. World simulation,
 * collision shapes and authored timing never enter this module.
 */
export function createMotionQualityAdapter(actor,{height,torsoRatio=.38,armRatio=.105}={}) {
  const {bones,root}=actor;root.updateWorldMatrix(true,true);
  const inverse=new Matrix4(),point=name=>bones[name]?root.worldToLocal(bones[name].getWorldPosition(V())):null;
  const shoulderWidth=point('leftUpperArm').distanceTo(point('rightUpperArm'));
  const rest=actor.motionRest??captureMotionRest(bones,height),lastCorrections=[];
  const sourcePoints=()=>Object.fromEntries(Object.keys(bones).map(n=>[n,point(n).toArray()]));
  function dimensions() {
    const identity=actor.appearanceController?.identity,profile=actor.appearanceController?.profile;
    const body=bodyCompensation({arms:identity?.proportions.arms??1,shoulders:identity?.proportions.shoulders??1,clothingMargin:profile?.outfit&&profile.outfit!=='uniform'?.012:0});
    return {torsoRadius:shoulderWidth*torsoRatio+body.clothingMargin,armRadius:shoulderWidth*armRatio,body};
  }
  function inspect(weapon=null) {root.updateWorldMatrix(true,true);return {...selfIntersectionRisks({points:sourcePoints(),...dimensions(),weapon}),corrections:[...lastCorrections]};}
  function aim(name,child,target) {
    const b=bones[name];b.parent.updateWorldMatrix(true,false);inverse.copy(b.parent.matrixWorld).invert();
    const origin=b.position,from=bones[child].getWorldPosition(V()).applyMatrix4(inverse).sub(origin).normalize();
    const to=root.localToWorld(target.clone()).applyMatrix4(inverse).sub(origin).normalize();
    b.quaternion.premultiply(Q().setFromUnitVectors(from,to)).normalize();b.updateWorldMatrix(false,true);
  }
  function solve(side,target,pole) {
    const an=side+'UpperArm',bn=side+'LowerArm',cn=side+'Hand',a=point(an),b=point(bn),c=point(cn);
    const l1=a.distanceTo(b),l2=b.distanceTo(c),axis=target.clone().sub(a),dist=Math.max(Math.abs(l1-l2)+1e-5,Math.min(axis.length(),l1+l2-1e-5));
    axis.normalize();const end=a.clone().addScaledVector(axis,dist),bend=pole.clone().addScaledVector(axis,-pole.dot(axis));
    if(bend.lengthSq()<1e-10)bend.set(0,0,1).addScaledVector(axis,-axis.z);bend.normalize();
    const x=(l1*l1-l2*l2+dist*dist)/(2*dist),y=Math.sqrt(Math.max(0,l1*l1-x*x));
    const elbow=a.clone().addScaledVector(axis,x).addScaledVector(bend,y);
    aim(an,bn,elbow);
    // Orient the elbow hinge from the measured rest arm and bend plane. A shortest
    // swing alone preserves arbitrary axial roll and can turn a sleeve inside out.
    const restWorld=Q(rest.bones[an].parentWorld).multiply(Q(rest.bones[an].local));
    const restAxis=V(rest.bones[bn].position??bones[bn].position.toArray()).normalize();
    const hinge=restAxis.clone().applyQuaternion(restWorld).cross(V([0,0,1])).normalize().applyQuaternion(restWorld.invert());
    const currentHinge=hinge.applyQuaternion(hierarchyQuaternion(bones[an])).applyQuaternion(hierarchyQuaternion(root).invert());
    const upper=elbow.clone().sub(a).normalize(),normal=upper.clone().cross(end.clone().sub(elbow).normalize()),bendStrength=Math.min(1,Math.max(0,(normal.length()-.02)/.12));normal.normalize();
    currentHinge.addScaledVector(upper,-currentHinge.dot(upper)).normalize();
    if(normal.lengthSq()>.1&&currentHinge.lengthSq()>.1){
      const angle=Math.atan2(upper.dot(currentHinge.clone().cross(normal)),currentHinge.dot(normal));
      bones[an].quaternion.multiply(Q().setFromAxisAngle(bones[bn].position.clone().normalize(),angle*bendStrength)).normalize();
      bones[bn].quaternion.slerp(Q(rest.bones[bn].local),bendStrength);root.updateWorldMatrix(true,true);
    }
    aim(bn,cn,end);return elbow;
  }
  function worldHand(side,q) {const b=bones[side+'Hand'];b.quaternion.copy(hierarchyQuaternion(b.parent).invert().multiply(q)).normalize();b.updateWorldMatrix(false,true);}
  function shareWristTwist(side) {
    const lower=bones[side+'LowerArm'],hand=bones[side+'Hand'],axis=hand.position.clone().normalize();
    const delta=hand.quaternion.clone().multiply(Q(rest.bones[side+'Hand'].local).invert());
    const projection=delta.x*axis.x+delta.y*axis.y+delta.z*axis.z;
    let angle=2*Math.atan2(projection,delta.w);if(angle>Math.PI)angle-=Math.PI*2;if(angle<-Math.PI)angle+=Math.PI*2;
    // Periodic transfer avoids a +60/-60 degree jump when the wrist crosses pi.
    const move=Math.PI/3*Math.sin(angle);
    if(Math.abs(move)<1e-5)return;
    const handQ=hierarchyQuaternion(hand);lower.quaternion.multiply(Q().setFromAxisAngle(axis,move)).normalize();lower.updateWorldMatrix(false,true);worldHand(side,handQ);
    lastCorrections.push({side,method:'forearm-wrist-twist-sharing',radians:move});
  }
  function correctArm(side) {
    const handName=side+'Hand',upperName=side+'UpperArm',lowerName=side+'LowerArm';
    const initial=inspect().issues.filter(i=>i.category==='self intersection'&&i.affectedBones.some(b=>b.startsWith(side))&&i.code!=='arms-cross');
    if(!initial.length){const handQ=hierarchyQuaternion(bones[handName]);solve(side,point(handName),point(lowerName).sub(point(upperName)));worldHand(side,handQ);return;}
    const a=point(upperName),b=point(lowerName),originalHand=point(handName),target=originalHand.clone(),handQ=hierarchyQuaternion(bones[handName]),dim=dimensions();
    const start=point('hips'),end=point(bones.upperChest?'upperChest':bones.chest?'chest':'spine'),axisTorso=end.clone().sub(start),u=Math.max(0,Math.min(1,target.clone().sub(start).dot(axisTorso)/axisTorso.lengthSq())),center=start.clone().addScaledVector(axisTorso,u);
    const radial=target.clone().sub(center),minRadius=dim.torsoRadius+dim.armRadius+.004;
    if(radial.length()<minRadius){if(radial.lengthSq()<1e-9)radial.set(side==='left'?1:-1,0,.3);target.copy(center).addScaledVector(radial.normalize(),minRadius);}
    const points=sourcePoints(),l1=a.distanceTo(b),l2=b.distanceTo(originalHand),maxReach=(l1+l2)*.995;
    const torsoUp=end.clone().sub(start).normalize(),across=point('leftUpperArm').sub(point('rightUpperArm')).normalize();
    const forward=across.cross(torsoUp).normalize(),baseTarget=target.clone();
    const evaluate=(angle,advance)=>{
      const candidate=baseTarget.clone().addScaledVector(forward,advance),axis=candidate.clone().sub(a).normalize();
      if(candidate.distanceTo(a)>maxReach)candidate.copy(a).addScaledVector(axis,maxReach);
      const dist=Math.max(Math.abs(l1-l2)+1e-5,candidate.distanceTo(a)),x=(l1*l1-l2*l2+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,l1*l1-x*x));
      const original=b.clone().sub(a),bend=original.addScaledVector(axis,-original.dot(axis)).normalize().applyAxisAngle(axis,angle);
      const elbow=a.clone().addScaledVector(axis,x).addScaledVector(bend,h);
      const risk=selfIntersectionRisks({points:{...points,[lowerName]:elbow.toArray(),[handName]:candidate.toArray()},...dim}).issues
        .filter(i=>i.code!=='arms-cross'&&i.category==='self intersection'&&i.affectedBones.some(b=>b.startsWith(side)));
      const penetration=risk.reduce((sum,i)=>sum+i.penetration*i.penetration,0);
      return {cost:penetration*10000+angle*angle*.008+(candidate.distanceTo(originalHand)/shoulderWidth)**2*.15,angle,advance,target:candidate,bend};
    };
    let best=evaluate(0,0);
    // First preserve the hand; when that arc is obstructed, search a small forward
    // clearance band in the character's current torso frame. The full blade swing,
    // wrist direction and timing remain authored. No Shino ID or fixed limb lengths.
    for(let step=0;step<=10;step++)for(let i=-16;i<=16;i++){
      const result=evaluate(i*Math.PI/16,shoulderWidth*.6*step/10);if(result.cost<best.cost)best=result;
    }
    for(let angleStep=Math.PI/32,positionStep=shoulderWidth*.015;angleStep>.003;angleStep/=2,positionStep/=2){
      for(const angleSign of [-1,0,1])for(const positionSign of [-1,0,1]){
        const result=evaluate(best.angle+angleStep*angleSign,Math.max(0,Math.min(shoulderWidth*.6,best.advance+positionStep*positionSign)));
        if(result.cost<best.cost)best=result;
      }
    }
    solve(side,best.target,best.bend);worldHand(side,handQ);
    lastCorrections.push({side,method:'anatomical-arm-clearance',radians:best.angle,handDisplacement:best.target.distanceTo(originalHand)});
  }
  return {rest,inspect,point,solve,worldHand,
    apply(pose){applyNormalizedMotion(bones,pose,rest);},
    correct(){lastCorrections.length=0;root.updateWorldMatrix(true,true);for(const side of SIDES){correctArm(side);shareWristTwist(side);}return inspect();},
    reset(){lastCorrections.length=0;},
    /** Grip points are measured in the RAW hand rest frame; both hands share one weapon profile. */
    calibrateWeapon(object,profile,socket,{appearanceScale=1}={}) {
      const p=weaponCalibration(profile),hand=bones.rightHand;root.updateWorldMatrix(true,true);
      const worldPosition=hand.localToWorld(V(socket.position)),worldRotation=hierarchyQuaternion(hand).multiply(Q(socket.quaternion)).multiply(Q(p.rotation));
      if(p.twoHanded&&bones.leftHand){
        // One common grip must lie in BOTH reach spheres, including palm offsets.
        const primary=root.worldToLocal(worldPosition.clone()),supportDelta=V(p.supportGrip).sub(V(p.grip)).multiplyScalar(p.scale*appearanceScale).applyQuaternion(worldRotation);
        const delta=root.worldToLocal(worldPosition.clone().add(supportDelta)).sub(primary);
        const constraints=SIDES.map(side=>{
          const socketQ=side==='left'?socket.supportQuaternion??socket.quaternion:socket.quaternion;
          const handQ=worldRotation.clone().multiply(Q(socketQ).invert());worldHand(side,handQ);root.updateWorldMatrix(true,true);
          const wrist=point(side+'Hand'),palm=root.worldToLocal(bones[side+'Hand'].localToWorld(V(side==='left'?socket.supportPosition??socket.position:socket.position)));
          const upper=point(side+'UpperArm'),lower=point(side+'LowerArm');
          return {side,handQ,offset:palm.sub(wrist),center:upper.add(palm).sub(side==='left'?delta:V()),radius:(point(side+'UpperArm').distanceTo(lower)+lower.distanceTo(wrist))*.985};
        });
        for(let i=0;i<20;i++)for(const c of constraints){const d=primary.clone().sub(c.center);if(d.length()>c.radius)primary.copy(c.center).addScaledVector(d.normalize(),c.radius);}
        const right=constraints.find(c=>c.side==='right');solve('right',primary.clone().sub(right.offset),V([-.6,-1,0]));worldHand('right',right.handQ);
        root.updateWorldMatrix(true,true);worldPosition.copy(hand.localToWorld(V(socket.position)));
      }
      const world=new Matrix4().compose(worldPosition,worldRotation,V([1,1,1]));
      world.multiply(new Matrix4().makeScale(p.scale*appearanceScale,p.scale*appearanceScale,p.scale*appearanceScale)).multiply(new Matrix4().makeTranslation(...p.grip.map(x=>-x)));
      // Geometry-space grip is scaled with the mesh, so its centre stays in the palm.
      const parentInverse=new Matrix4().copy(object.parent?.matrixWorld??new Matrix4()).invert();
      object.matrix.copy(parentInverse.multiply(world));object.matrixAutoUpdate=false;object.matrixWorldNeedsUpdate=true;object.updateWorldMatrix(true,true);
      if(p.twoHanded&&bones.leftHand){
        const handQ=worldRotation.clone().multiply(Q(socket.supportQuaternion??socket.quaternion).invert());
        this.worldHand('left',handQ);root.updateWorldMatrix(true,true);
        const palm=root.worldToLocal(bones.leftHand.localToWorld(V(socket.supportPosition??socket.position))),wrist=point('leftHand');
        const support=root.worldToLocal(V(p.supportGrip).applyMatrix4(world)).sub(palm.sub(wrist));
        this.solve('left',support,V([.6,-1,0]));this.worldHand('left',handQ);
      }
      const supportError=p.twoHanded?bones.leftHand.localToWorld(V(socket.supportPosition??socket.position)).distanceTo(V(p.supportGrip).applyMatrix4(world)):0;
      return {a:root.worldToLocal(V(p.bladeBase).applyMatrix4(world)).toArray(),b:root.worldToLocal(V(p.bladeTip).applyMatrix4(world)).toArray(),radius:shoulderWidth*.035,supportError};
    }
  };
}
