import test from 'node:test';
import assert from 'node:assert/strict';
import {DEVOUR_BITE_BEATS,sampleDevourMotion,samplePreyMotion} from '../src/web/devour-motion.js';

test('predator and prey share finite normalized capture timing',()=>{
 for(let i=0;i<=400;i++){
  const p=i/400,predator=sampleDevourMotion(p),prey=samplePreyMotion(p,1,1);
  assert.equal(predator.progress,p);
  assert.equal(prey.progress,p);
  for(const value of [...Object.values(predator),...Object.values(prey)])if(typeof value==='number')assert.ok(Number.isFinite(value));
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
