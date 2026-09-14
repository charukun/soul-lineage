import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceStrideMatch,orientationWarp,collisionClampTravel,selectAttackForRange,inertializeScalar,createImpactBeat,rootTravelMetadata,MOTION_WARP_PROFILES} from '../src/gameplay-motion-quality.js';

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

test('impact coordinator emits one immutable multi-channel beat',()=>{
 const beat=createImpactBeat({actorId:'hero',targetId:'enemy',kind:'slash',clock:3.2,serial:7});
 assert.equal(beat.id,'hero:enemy:slash:7');
 assert.deepEqual(beat.channels,['hit-stop','camera-impulse','hit-reaction','vfx','sfx']);
 assert.equal(Object.isFrozen(beat),true);
});

test('root travel metadata stays non-authoritative by default',()=>{
 const meta=rootTravelMetadata({kind:'slash',forward:.55,standoff:1.05});
 assert.equal(meta.authoritative,false);assert.equal(meta.owner,'animation-intent');
});
