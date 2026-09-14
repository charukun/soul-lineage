import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localImpactBeat,localDirectionalReaction,localWeaponInertiaStep,localTerrainAdjustments,HUMANOID_DYNAMICS_REVISION} from '../public/simulator/src/humanoid-dynamics.js';
import {createImpactBeat,directionalHitReaction,weaponInertiaStep,terrainFootAdjustments} from '@soul/animations';

const close=(a,b,eps=1e-12)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('Rinne impact beat adapter matches shared v2 contract',()=>{
 const input={actorId:'attacker',targetId:'hero',kind:'slash',clock:2.4,serial:9,direction:{x:.4,z:-.8},strength:1.2,region:'torso'};
 assert.deepEqual(localImpactBeat(input),createImpactBeat(input));
});

test('Rinne directional reaction adapter matches shared contract',()=>{
 const input={incomingX:.8,incomingZ:-.2,targetYaw:.6,strength:1.3,region:'leg'};
 const local=localDirectionalReaction(input),shared=directionalHitReaction(input);
 for(const key of ['localRight','localForward','strength','pelvisYaw','pelvisRoll','spinePitch','spineRoll','chestYaw','headCounterYaw','supportShiftX','supportShiftZ','duration'])close(local[key],shared[key]);
 assert.equal(local.region,shared.region);
});

test('Rinne weapon inertia adapter matches shared bounded spring',()=>{
 let local={offset:0,velocity:0},shared={offset:0,velocity:0};
 for(let i=0;i<12;i++){
  const input={targetAngularVelocity:i<6?7:-3,dt:1/60,weapon:'great'};
  local=localWeaponInertiaStep({...local,...input});shared=weaponInertiaStep({...shared,...input});
  for(const key of ['offset','velocity','desired','maxAngle'])close(local[key],shared[key]);
 }
 assert.ok(Math.abs(local.offset)<=local.maxAngle+1e-12);
});

test('Rinne terrain adapter matches shared pelvis/foot split',()=>{
 const input={left:{currentY:.04,groundY:.20,normal:{x:.2,y:.95,z:.1}},right:{currentY:.03,groundY:-.05,normal:{x:0,y:1,z:0}}};
 const local=localTerrainAdjustments(input),shared=terrainFootAdjustments(input);
 close(local.pelvisY,shared.pelvisY);for(const side of ['left','right']){close(local[side].y,shared[side].y);for(const axis of ['x','y','z'])close(local[side].normal[axis],shared[side].normal[axis]);}
});

test('humanoid entry keeps dynamics and life layers below the operational runtime',async()=>{
 const entry=await readFile(new URL('../public/simulator/src/humanoid.js',import.meta.url),'utf8');
 const source=await readFile(new URL('../public/simulator/src/humanoid-dynamics.js',import.meta.url),'utf8');
 assert.equal(HUMANOID_DYNAMICS_REVISION,'mass-response-2');
 assert.match(entry,/HUMANOID_DYNAMICS_REVISION.*humanoid-dynamics/);
 assert.match(entry,/HUMANOID_LIFE_REVISION.*humanoid-life/);
 assert.match(entry,/HumanoidRuntime,HUMANOID_OPERATIONAL_REVISION.*humanoid-operational/);
 assert.match(source,/if\(!commit\|\|!result\?\.a\|\|!result\?\.b\|\|!result\?\.sm/);
 assert.match(source,/Array\.isArray\(value\)\|\|ArrayBuffer\.isView\(value\)/);
 assert.match(source,/writePoint\(result\.b,newB\)/);
 assert.match(source,/if\(result\.weaponTip\)writePoint\(result\.weaponTip,newB\)/);
 assert.match(source,/if\(!commit\|\|a\?\.air\|\|a\?\.dead\|\|a\?\.attack\|\|a\?\.recovery\)return/);
 assert.match(source,/__RINNE_IMPACT_BEAT__/);
 assert.match(source,/__RINNE_IMPACT_CHANNELS__/);
 assert.match(source,/dynamicsBalance/);
});
