import test from 'node:test';
import assert from 'node:assert/strict';
import {DEVOUR_BITE_BEATS,INCAPACITATION_PHASES,INCAPACITATION_SECONDS,devourActorScale,devourInteractionFrame,devourInteractionSide,preyCapturePoint,sampleDevourContact,sampleDevourMotion,sampleIncapacitationMotion,samplePreyMotion} from '../src/web/devour-motion.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('predator and prey share finite normalized capture timing',()=>{
 for(let i=0;i<=400;i++){
  const p=i/400,predator=sampleDevourMotion(p),prey=samplePreyMotion(p,1,1);
  assert.equal(predator.progress,p);
  assert.equal(prey.progress,p);
  for(const value of [...Object.values(predator),...Object.values(prey)])if(typeof value==='number')assert.ok(Number.isFinite(value));
 }
});

test('incapacitation uses five full-body phases with weight transfer before ground contact',()=>{
 assert.equal(INCAPACITATION_SECONDS,.68);
 assert.deepEqual(INCAPACITATION_PHASES,['impact','buckle','drop','contact','settle']);
 const impact=sampleIncapacitationMotion(.08),buckle=sampleIncapacitationMotion(.24),drop=sampleIncapacitationMotion(.48),contact=sampleIncapacitationMotion(.72),settle=sampleIncapacitationMotion(1);
 assert.equal(impact.phase,'impact');assert.equal(buckle.phase,'buckle');assert.equal(drop.phase,'drop');assert.equal(contact.phase,'contact');assert.equal(settle.phase,'settle');
 assert.ok(buckle.legBend>impact.legBend,'knees should give way before the body reaches the ground');
 assert.ok(drop.rootRoll>buckle.rootRoll&&drop.armDrop>buckle.armDrop,'pelvis and arms should follow the knee buckle');
 assert.ok(contact.contact>=.5&&contact.rootRoll>drop.rootRoll,'shoulder/hip contact should have its own beat');
 assert.ok(settle.armDrop>.9&&settle.legSpread>.95,'the final pose should remain visibly slack');
});

test('incapacitation sampler stays continuous across the whole fall',()=>{
 let previous=sampleIncapacitationMotion(0);
 for(let i=1;i<=1000;i++){
  const current=sampleIncapacitationMotion(i/1000);
  for(const key of ['rootRoll','rootPitch','bodyPitch','bodyTwist','bodyRoll','headPitch','headYaw','headRoll','legBend','armDrop','brace'])
   assert.ok(Math.abs(current[key]-previous[key])<.02,`${key} jumped at ${i/1000}`);
  previous=current;
 }
});

test('fall side mirrors silhouette without changing collapse timing',()=>{
 for(const p of [.08,.24,.48,.72,1]){
  const left=sampleIncapacitationMotion(p,-1),right=sampleIncapacitationMotion(p,1);
  assert.equal(left.progress,right.progress);assert.equal(left.phase,right.phase);
  assert.ok(Math.abs(left.rootRoll+right.rootRoll)<1e-12);
  assert.ok(Math.abs(left.bodyTwist+right.bodyTwist)<1e-12);
  assert.equal(left.legBend,right.legBend);assert.equal(left.armDrop,right.armDrop);
 }
});

test('immediate feeding finishes KO contact and hand reach before prey translation',()=>{
 const falling=samplePreyMotion(.10,.12,1,1),contact=samplePreyMotion(.14,.20,1,1),reach=samplePreyMotion(.25,.37,1,1),pull=samplePreyMotion(.32,.47,1,1);
 assert.equal(falling.capture,0);assert.equal(contact.capture,0);assert.equal(reach.capture,0);
 assert.ok(falling.down>.5,'capture clock should advance the collapse even when renderer dt is sparse');
 assert.ok(contact.contact>.8,'ground contact must be readable before the prey is lifted');
 assert.ok(sampleDevourContact(.25).grip>0,'hands should already be establishing contact before translation');
 assert.ok(pull.capture>0&&pull.down===1,'prey translation begins only after the grip beat');
});

test('devour contact weights establish grip before bite and keep the lock through swallow',()=>{
 const reach=sampleDevourContact(.20),pull=sampleDevourContact(.34),bite=sampleDevourContact(.51),swallow=sampleDevourContact(.82);
 assert.ok(reach.reach>.8&&reach.grip<.1);
 assert.ok(pull.grip>.85&&pull.haul>.2);
 assert.ok(bite.grip>.95&&bite.mouth>.95&&bite.bite>.99);
 assert.ok(swallow.lock>.95&&swallow.swallow>.5,'mouth/prey relation should stay locked into swallow');
});

test('predator-only frame reaches toward the valid prey distance instead of grabbing itself',()=>{
 const capture={x:1,z:-2,yaw:.3,scale:1},motion=samplePreyMotion(.24,1,1,devourInteractionSide(capture));
 const frame=devourInteractionFrame(capture,capture,motion),rootDistance=Math.hypot(frame.root.x-capture.x,frame.root.z-capture.z);
 assert.equal(motion.capture,0);
 assert.ok(rootDistance>.6&&rootDistance<.8,'reach target should approximate the existing DEVOUR_REACH envelope');
});

test('bite socket reaches the mouth while two grip points remain distinct',()=>{
 const capture={x:1.5,z:-2.2,yaw:.37,form:'hollow',growthScale:1},origin={x:4,z:-1,yaw:-.2},side=devourInteractionSide(capture);
 for(const beat of DEVOUR_BITE_BEATS){
  const motion=samplePreyMotion(beat,1,1,side),frame=devourInteractionFrame(origin,capture,motion);
  assert.ok(distance(frame.bite,frame.mouth)<1e-9,`bite ${beat} must meet mouth`);
  assert.ok(distance(frame.upper,frame.lower)>.25,'upper and waist grips must not collapse into one fake point');
  assert.ok(frame.grip>.95&&frame.gripReach>.95);
 }
});

test('predator scale changes feeding height instead of reusing one floating pose',()=>{
 const origin={x:3,z:1,yaw:0},progress=.51;
 const small={x:0,z:0,yaw:0,scale:.28},large={x:0,z:0,yaw:0,scale:2.4};
 const smallFrame=devourInteractionFrame(origin,small,samplePreyMotion(progress,1,1,devourInteractionSide(small)));
 const largeFrame=devourInteractionFrame(origin,large,samplePreyMotion(progress,1,1,devourInteractionSide(large)));
 assert.equal(devourActorScale(small),.28);assert.equal(devourActorScale(large),2.4);
 assert.ok(smallFrame.mouth.y<.5&&smallFrame.root.y<.45,'small predator should feed near the ground');
 assert.ok(largeFrame.mouth.y>3&&largeFrame.root.y>2,'large predator should actually hoist prey toward its mouth');
 assert.ok(smallFrame.gripReach<.05,'tiny predator must not fake an impossible two-hand reach');
 assert.equal(largeFrame.gripReach,1);
});

test('shared contact frame remains continuous during pull, bite and swallow',()=>{
 const capture={x:.4,z:-.8,yaw:-.5,scale:1.15},origin={x:2.2,z:1.1,yaw:.2},side=devourInteractionSide(capture);
 let previous=devourInteractionFrame(origin,capture,samplePreyMotion(.28,1,1,side));
 for(let i=281;i<=950;i++){
  const p=i/1000,current=devourInteractionFrame(origin,capture,samplePreyMotion(p,1,1,side));
  assert.ok(distance(current.root,previous.root)<.08,`root jumped at ${p}`);
  assert.ok(distance(current.upper,previous.upper)<.08,`upper grip jumped at ${p}`);
  assert.ok(distance(current.mouth,previous.mouth)<1e-12,'mouth anchor must not drift independently');
  previous=current;
 }
});

test('incapacitation falls continuously and capture keeps the prey committed through swallow',()=>{
 const standing=samplePreyMotion(null,0),fallen=samplePreyMotion(null,1);
 assert.equal(standing.rootRoll,0);
 assert.ok(fallen.rootRoll>1.4&&fallen.rootRoll<1.5);
 const pull=samplePreyMotion(.44,1),late=samplePreyMotion(.97,1);
 assert.ok(pull.capture>.95);
 assert.ok(late.capture>.95);
 assert.ok(late.swallow>.95);
 assert.ok(late.lift>.3,'prey must not fall back to the floor immediately before consume');
 assert.ok(late.forward<pull.forward,'swallow should draw the prey further toward the predator');
 assert.ok(late.lateral<pull.lateral,'swallow should pull the prey inward rather than leave it beside the predator');
});

test('bite beats drive the defeated body and cancellation can ease back to the same fallen pose',()=>{
 for(const beat of DEVOUR_BITE_BEATS)assert.ok(samplePreyMotion(beat,1).bite>.99);
 const held=samplePreyMotion(.68,1,1),half=samplePreyMotion(.68,1,.5),released=samplePreyMotion(.68,1,0);
 assert.ok(held.lift>half.lift&&half.lift>released.lift);
 assert.ok(Math.abs(released.rootRoll-samplePreyMotion(null,1).rootRoll)<1e-12);
 assert.equal(released.capture,0);
 assert.equal(released.bite,0);
 assert.equal(released.swallow,0);
});

test('shared prey anchor follows the held pose and does not retreat during swallow',()=>{
 const origin={x:4,z:-2,yaw:0},capture={x:0,z:0,yaw:.4,form:'hollow',growthScale:1},side=devourInteractionSide(capture);
 const early=preyCapturePoint(origin,capture,samplePreyMotion(.05,1,1,side));
 const bite=preyCapturePoint(origin,capture,samplePreyMotion(.68,1,1,side));
 const late=preyCapturePoint(origin,capture,samplePreyMotion(.97,1,1,side));
 for(const point of [early,bite,late])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.z));
 assert.deepEqual(early,{x:origin.x,z:origin.z},'lower/reach should not drag the defeated body before contact');
 assert.ok(Math.hypot(late.x-bite.x,late.z-bite.z)<.25,'swallow must keep the captured body in the established contact envelope');
});
