import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/simulator/vendor/three.js';
import {loadRuntime} from '../scripts/sword-capture-runtime.mjs';
import {SWORD_MOVES,swordAirHeight} from '../public/simulator/src/authored-sword.js';
import {weaponSockets} from '../public/simulator/src/rig-profiles.js';
import {REVIEW_WEAPONS,createReviewWeapon} from '../public/simulator/src/review-sword.js';
import {gripMatrix} from '../public/simulator/src/quality-math.js';
import {weaponPose} from '../public/simulator/src/weapon-motion.js';
import {sampleSlashPose} from '../public/simulator/src/authored-slash.js';

test('mesh-space handle centers survive mesh scale, actor scale and rotation',()=>{
 const position=new T.Vector3(.3,1.2,-.5),q=new T.Quaternion().setFromEuler(new T.Euler(.4,1.2,-.7));
 for(const spec of Object.values(weaponSockets))for(const scale of [.72,1,1.18]){
  const socket=new T.Matrix4().compose(position,q,new T.Vector3(scale,scale,scale));
  const mesh=gripMatrix(socket,spec);
  assert.ok(new T.Vector3(...spec.grip).applyMatrix4(mesh).distanceTo(position)<1e-10);
  const spacing=new T.Vector3(...spec.left).applyMatrix4(mesh).distanceTo(position);
  assert.ok(Math.abs(spacing-new T.Vector3(...spec.left).distanceTo(new T.Vector3(...spec.grip))*spec.scale*scale)<1e-10);
 }
});

test('five weapons reuse all nine actions with actual rendered handles in both palms',async()=>{
 const runtime=await loadRuntime(),c=runtime.current;runtime.api.weapons=REVIEW_WEAPONS;
 const actor={id:'weapon-grip',hero:true,weaponDraw:1,lifeAgeYears:22,x:.23,z:-.3,yaw:.8,air:0,vx:0,vz:0,combatReady:true};
 const reset=()=>{c.state=null;c.lastActual=null;c.blending=null;c.footLocks={};};
 const results={};
 try{
  for(const weapon of Object.keys(REVIEW_WEAPONS)){
   const spec=weaponSockets[weapon],mesh=createReviewWeapon(weapon),metrics={right:0,left:0,thumb:0,minBlade:Infinity};
   mesh.matrixAutoUpdate=false;actor.weapon=weapon;
   for(const [kind,move]of Object.entries(SWORD_MOVES)){
    reset();
    for(let i=0;i<=40;i++){
     const phase=i/40;actor.attack={id:kind,kind,t:phase*move.seconds,duration:move.seconds};actor._humanoidClock=actor.attack.t;actor.air=swordAirHeight(kind,phase);
     const result=runtime.render(actor);assert.ok(c.finite);mesh.matrix.fromArray(result.sm);mesh.updateMatrixWorld(true);
     if(result.weaponTip[1]<metrics.minBlade){metrics.minBlade=result.weaponTip[1];metrics.lowest=[kind,phase];}
     for(const side of spec.two?['right','left']:['right']){
      // Measure the visible raw palm against the actual rendered mesh transform,
      // not against a second copy of the normalized socket calculation.
      const point=new T.Vector3(...(side==='right'?spec.grip:spec.left)).applyMatrix4(mesh.matrixWorld);
      const gap=c.sockets[side].node.getWorldPosition(new T.Vector3()).distanceTo(point);
      metrics[side]=Math.max(metrics[side],gap);
      assert.ok(gap<.003,`${weapon}/${kind}/${i} ${side} handle gap ${gap}`);
      const thumb=c.raw[side+'ThumbDistal'].getWorldPosition(new T.Vector3()),index=c.raw[side+'IndexIntermediate'].getWorldPosition(new T.Vector3());
      const thumbOnMesh=thumb.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
      assert.ok(Math.hypot(thumbOnMesh.x,thumbOnMesh.z)>.040,`${weapon} ${side} thumb lies inside the handle axis`);
      metrics.thumb=Math.max(metrics.thumb,thumb.distanceTo(index));
      assert.ok(thumb.distanceTo(index)<.035,`${weapon} ${side} thumb fails to oppose the fingers`);
     }
    }
   }
   // Floor acceptance is checked after collecting every family below.
   results[weapon]=metrics;
   mesh.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
  }
  // Family tuning leaves the learned basic unchanged and gives two-hand weapons
  // a centered grip/body effort without inventing another attack ID or duration.
  const basic=sampleSlashPose(.5),snapshot=JSON.stringify(basic);
  for(const weapon of ['great','katana','spear','axe'])assert.notDeepEqual(weaponPose(basic,weapon,'slash',.5).grip,basic.grip);
  assert.equal(JSON.stringify(basic),snapshot);
  console.log(JSON.stringify({weaponGrips:results,actionsPerWeapon:9}));
  for(const [weapon,metrics]of Object.entries(results))assert.ok(metrics.minBlade>-.02,`${weapon} blade enters the floor ${metrics.minBlade}`);
 }finally{runtime.dispose(c);}
});
