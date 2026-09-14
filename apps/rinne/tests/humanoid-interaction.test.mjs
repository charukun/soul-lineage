import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localPersonality,localLocomotion,localInteraction,localCondition,localMicro,localPairedImpact,localAdaptation,localSyncFrame,localReconcile} from '../public/simulator/src/motion-interaction-math.js';
import {resolveMotionPersonality,locomotionTransition,solveTwoBodyInteraction,conditionMotionProfile,microMotionSample,pairedImpactResponse,bodyMotionAdaptation,createMotionSyncFrame,reconcileMotionSync} from '../../../packages/animations/src/motion-runtime.js';

const close=(a,b,eps=1e-10)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
function sameNumeric(a,b){for(const key of Object.keys(a))if(typeof a[key]==='number')close(a[key],b[key]);}

test('Rinne personality and locomotion adapters match shared runtime',()=>{
 const a=localPersonality('aggressive',{tempo:1.2}),b=resolveMotionPersonality('aggressive',{tempo:1.2});assert.deepEqual(a,b);
 const input={speed:1.2,previousSpeed:.4,yaw:.7,previousYaw:.1,dt:1/60,plantedSide:'right'},la=localLocomotion(input),lb=locomotionTransition(input);sameNumeric(la,lb);assert.equal(la.state,lb.state);assert.equal(la.supportSide,lb.supportSide);
});

test('Rinne two-body and paired impact math match shared contracts',()=>{
 const interaction={actorA:{x:0,y:0,z:0,yaw:.2},actorB:{x:1,y:0,z:.4,yaw:-.1},anchorA:{x:.1,y:1,z:0},anchorB:{x:.8,y:1.05,z:.2},massA:1.4,massB:.8,maxTranslation:.2,maxYaw:.25};
 const a=localInteraction(interaction),b=solveTwoBodyInteraction(interaction);for(const side of ['a','b']){sameNumeric(a[side].offset,b[side].offset);close(a[side].yaw,b[side].yaw);}close(a.error.distance,b.error.distance);
 const impact={serial:4,direction:{x:.8,z:-.2},strength:1.4,massAttacker:1.2,massDefender:.9},ia=localPairedImpact(impact),ib=pairedImpactResponse(impact);sameNumeric(ia.impulse,ib.impulse);sameNumeric(ia.attacker.offset,ib.attacker.offset);sameNumeric(ia.defender.offset,ib.defender.offset);assert.equal(ia.singleDamageEvent,true);
});

test('Rinne condition micro and body adaptation match shared contracts',()=>{
 const condition={fatigue:.65,injuries:{leftLeg:.8,rightArm:.35,torso:.2}},ca=localCondition(condition),cb=conditionMotionProfile(condition);sameNumeric(ca,cb);assert.deepEqual(ca.injuries,cb.injuries);
 const micro={time:4.2,seed:'hero',fatigue:.6,personality:'timid'},ma=localMicro(micro),mb=microMotionSample(micro);sameNumeric(ma,mb);
 const body={height:1.12,width:.92,armLength:1.18,legLength:1.06},ba=localAdaptation(body),bb=bodyMotionAdaptation(body);sameNumeric(ba,bb);
});

test('Rinne motion sync and reconciliation match shared contract',()=>{
 const spec={actorId:'hero',sequence:9,clock:5.3,state:'attack',phase:.48,lockedTargetId:'e2',impactSerial:3,position:{x:1,z:-2},yaw:.4,condition:{fatigue:.3,injuries:{rightLeg:.2}}},a=localSyncFrame(spec),b=createMotionSyncFrame(spec);assert.deepEqual(a,b);
 const remote=createMotionSyncFrame({...spec,sequence:10,clock:5.6,impactSerial:4,position:{x:1.4,z:-2},yaw:.6}),ra=localReconcile(a,remote),rb=reconcileMotionSync(b,remote);sameNumeric(ra,rb);for(const key of ['remoteNewer','targetChanged','impactChanged','reseedPresentation'])assert.equal(ra[key],rb[key]);
});

test('final humanoid entry routes through interaction layer',async()=>{
 const entry=await readFile(new URL('../public/simulator/src/humanoid.js',import.meta.url),'utf8'),source=await readFile(new URL('../public/simulator/src/humanoid-interaction.js',import.meta.url),'utf8');
 assert.match(entry,/HumanoidRuntime,HUMANOID_INTERACTION_REVISION.*humanoid-interaction/);
 assert.match(source,/extends BaseHumanoidRuntime/);assert.match(source,/prepareInteractionState/);assert.match(source,/applyInteractionPlan/);assert.match(source,/applyPairedResponse/);assert.match(source,/motionSyncFrame/);assert.match(source,/reconcileMotion/);
});

test('interaction layer never owns authoritative actor world state or damage',async()=>{
 const source=await readFile(new URL('../public/simulator/src/humanoid-interaction.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/a\.x\s*=|a\.z\s*=|a\.yaw\s*=/,'presentation layer must not write authoritative actor transform');
 assert.doesNotMatch(source,/\.hp\s*=|damage\s*\(/,'presentation layer must not own damage');
 assert.match(source,/if\(!commit\)return null;const spec=interactionFor/);
 assert.match(source,/if\(!commit\|\|!a\?\.reaction/);
 assert.match(source,/if\(commit\)\{[\s\S]*this\._interaction\.history\.set/,'history only advances after a successful committed sample');
 const prepare=source.match(/prepareInteractionState\(a\)\{([\s\S]*?)\n \}/)?.[1];assert.ok(prepare);assert.doesNotMatch(prepare,/history\.set/,'preparation must remain side-effect free');
});

test('paired and interaction rigid offsets keep all returned samples and shadows aligned',async()=>{
 const source=await readFile(new URL('../public/simulator/src/humanoid-interaction.js',import.meta.url),'utf8');
 assert.match(source,/\['a','b','weaponBase','weaponTip'\]/);
 assert.match(source,/\['sm','leftSocket','rightSocket','carry'\]/);
 assert.match(source,/makeRotationY\(yaw\)/);assert.match(source,/rigidTransformResult\(result,origin,yaw,offset\)/);
 assert.match(source,/proxy\.matrix\.copy\(proxy\.userData\.source\.matrixWorld\)/);
 assert.match(source,/this\.api\.gazeTarget\?\.\(a\)/,'sync frame consumes the same locked target provider as gaze');
});
