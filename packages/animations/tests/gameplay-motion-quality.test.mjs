import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceStrideMatch,orientationWarp,collisionClampTravel,selectAttackForRange,inertializeScalar,createImpactBeat,rootTravelMetadata,MOTION_WARP_PROFILES,directionalHitReaction,weaponInertiaStep,estimateCenterOfMass,supportBalance,terrainFootAdjustments,WEAPON_INERTIA_PROFILES} from '../src/gameplay-motion-quality.js';

test('distance/stride matching is bounded and speed-responsive',()=>{
 const slow=distanceStrideMatch({speed:.2,cycleDistance:1.2}),fast=distanceStrideMatch({speed:4,cycleDistance:1.2});
 assert.deepEqual(slow,{playback:.72,strideScale:.78});
 assert.deepEqual(fast,{playback:1.28,strideScale:1.22});
});

test('orientation warp reaches shortest-path target by turn end',()=>{
 const target=-Math.PI+.1,from=Math.PI-.1;
 assert.ok(Math.abs(orientationWarp({fromYaw:from,toYaw:target,phase:.14})-(Math.PI+.1))<1e-9);
});

test('technique profiles preserve distinct approach envelopes',()=>{
 assert.ok(MOTION_WARP_PROFILES.thrust.maxDistance>MOTION_WARP_PROFILES.slash.maxDistance);
 assert.ok(MOTION_WARP_PROFILES.heavy.maxDistance<MOTION_WARP_PROFILES.slash.maxDistance);
 assert.ok(MOTION_WARP_PROFILES.slash.warpStart<MOTION_WARP_PROFILES.slash.contact);
});

test('collision clamp never extends intended travel',()=>{
 assert.equal(collisionClampTravel(.55,.31),.31);
 assert.equal(collisionClampTravel(.55,.9),.55);
 assert.equal(collisionClampTravel(.55,-1),0);
});

test('range helper prefers thrust at distance and slash close',()=>{
 const available=['slash','thrust','heavy'];
 assert.equal(selectAttackForRange({distance:1.8,angle:.1,available}),'thrust');
 assert.equal(selectAttackForRange({distance:.6,available}),'slash');
 assert.equal(selectAttackForRange({distance:1.25,angle:1,available}),'heavy');
});

test('inertialization converges without overshoot',()=>{
 const a=inertializeScalar(10,0,.085,.085),b=inertializeScalar(a,0,.085,.085);
 assert.equal(a,5);assert.equal(b,2.5);
});

test('impact coordinator emits one immutable multi-channel beat with directional evidence',()=>{
 const beat=createImpactBeat({actorId:'hero',targetId:'enemy',kind:'slash',clock:3.2,serial:7,direction:{x:1,z:0},strength:1.25,region:'torso'});
 assert.equal(beat.id,'hero:enemy:slash:7');
 assert.deepEqual(beat.channels,['hit-stop','camera-impulse','hit-reaction','vfx','sfx']);
 assert.deepEqual(beat.direction,{x:1,z:0});
 assert.equal(beat.version,2);assert.equal(Object.isFrozen(beat),true);
});

test('directional full-body reaction mirrors left/right and changes lower-body support',()=>{
 const right=directionalHitReaction({incomingX:1,incomingZ:0,targetYaw:0,strength:1,region:'torso'});
 const left=directionalHitReaction({incomingX:-1,incomingZ:0,targetYaw:0,strength:1,region:'torso'});
 assert.ok(right.spineRoll>0&&left.spineRoll<0);
 assert.equal(right.chestYaw,-left.chestYaw);
 const leg=directionalHitReaction({incomingX:1,incomingZ:0,targetYaw:0,strength:1,region:'leg'});
 assert.ok(Math.abs(leg.supportShiftX)>Math.abs(right.supportShiftX));
 assert.ok(leg.duration>right.duration);
});

test('weapon inertia is bounded and heavier weapons lag more',()=>{
 let sword={offset:0,velocity:0},great={offset:0,velocity:0};
 for(let i=0;i<8;i++){
  sword=weaponInertiaStep({...sword,targetAngularVelocity:6,dt:1/60,weapon:'sword'});
  great=weaponInertiaStep({...great,targetAngularVelocity:6,dt:1/60,weapon:'great'});
 }
 assert.ok(Math.abs(sword.offset)<=WEAPON_INERTIA_PROFILES.sword.maxAngle+1e-12);
 assert.ok(Math.abs(great.offset)<=WEAPON_INERTIA_PROFILES.great.maxAngle+1e-12);
 assert.ok(Math.abs(great.desired)>Math.abs(sword.desired));
});

test('center of mass and support margin detect unstable posture',()=>{
 const points={hips:[0,1,0],chest:[0,1.4,0],head:[0,1.8,0],leftHand:[-.3,1.2,0],rightHand:[.3,1.2,0],leftFoot:[-.15,0,0],rightFoot:[.15,0,0]};
 const com=estimateCenterOfMass(points),stable=supportBalance({com,supports:[points.leftFoot,points.rightFoot],footRadius:.18});
 assert.equal(stable.inside,true);
 const unstable=supportBalance({com:{...com,x:.8},supports:[points.leftFoot,points.rightFoot],footRadius:.18});
 assert.equal(unstable.inside,false);assert.ok(unstable.margin<0);
});

test('terrain foot adjustments split foot reach from bounded pelvis shift',()=>{
 const t=terrainFootAdjustments({left:{currentY:0,groundY:.18,normal:{x:.2,y:.96,z:0}},right:{currentY:0,groundY:-.06,normal:{x:0,y:1,z:0}}});
 assert.ok(Math.abs(t.pelvisY)<=.16);
 assert.ok(Math.abs(t.left.y)<=.22&&Math.abs(t.right.y)<=.22);
 assert.ok(Math.abs(Math.hypot(t.left.normal.x,t.left.normal.y,t.left.normal.z)-1)<1e-12);
});

test('root travel metadata stays non-authoritative by default',()=>{
 const meta=rootTravelMetadata({kind:'slash',forward:.55,standoff:1.05});
 assert.equal(meta.authoritative,false);assert.equal(meta.owner,'animation-intent');
});
