import test from 'node:test';
import assert from 'node:assert/strict';
import {DEVOUR_BITE_BEATS,INCAPACITATION_PHASES,INCAPACITATION_SECONDS,preyCapturePoint,sampleDevourMotion,sampleIncapacitationMotion,samplePreyMotion} from '../src/web/devour-motion.js';

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

test('immediate feeding finishes the KO contact beat before visible capture pull',()=>{
 const falling=samplePreyMotion(.10,.12,1,1),contact=samplePreyMotion(.14,.20,1,1),pull=samplePreyMotion(.25,.37,1,1);
 assert.equal(falling.capture,0);assert.equal(contact.capture,0);
 assert.ok(falling.down>.5,'capture clock should advance the collapse even when renderer dt is sparse');
 assert.ok(contact.contact>.8,'ground contact must be readable before the prey is lifted');
 assert.ok(pull.capture>0&&pull.down===1,'visible capture starts only after the collapse has completed');
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

test('shared prey anchor follows the same capture motion used by rendering and effects',()=>{
 const origin={x:4,z:-2},capture={x:0,z:0,yaw:.4,form:'hollow',growthScale:1};
 const early=preyCapturePoint(origin,capture,samplePreyMotion(.05,1));
 const bite=preyCapturePoint(origin,capture,samplePreyMotion(.68,1));
 const late=preyCapturePoint(origin,capture,samplePreyMotion(.97,1));
 for(const point of [early,bite,late])assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.z));
 assert.deepEqual(early,origin,'lower/reach should not drag the defeated body before contact');
 assert.ok(Math.hypot(late.x-capture.x,late.z-capture.z)<Math.hypot(bite.x-capture.x,bite.z-capture.z));
});
