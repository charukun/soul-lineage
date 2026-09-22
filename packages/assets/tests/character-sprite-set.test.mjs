import test from 'node:test';
import assert from 'node:assert/strict';
import {SPRITE_SET_SCHEMA,SPRITE_SET_DIRECTIONS as DIRECTIONS,SPRITE_SET_ACTIONS,assertCharacterSpriteSet,resolveSpriteSetDirection,spriteSetGrounding,spriteSetUV} from '../src/character-sprite-set.js';
import {createSpriteSetPlayback} from '../src/character-sprite-playback.js';

function fixture(){
  const hash='a'.repeat(64),m={schema:SPRITE_SET_SCHEMA,id:'test.actor',label:'test',revision:1,stage:'local-draft',directions:[...DIRECTIONS],render:{worldHeight:2,pivot:[.5,.9],frameSize:[16,16]},provenance:{schemaVersion:1,originalSourceSha256:hash,author:'unknown',license:'unknown',rightsState:'unknown',derivedProcessing:[]},approval:{productionApproved:false},assets:{},actions:{}};
  for(const action of SPRITE_SET_ACTIONS){m.assets[action]={file:action+'.png',sha256:hash,byteLength:32,width:64,height:128,mediaType:'image/png',hasTransparency:true,provenance:{originalSourceSha256:hash,importedFileSha256:hash,processing:[]}};m.actions[action]={asset:action,rows:8,columns:4,fps:4,directionOrder:[...DIRECTIONS],events:[{frame:0,name:'start'},{frame:2,name:'middle'}]};}
  return m;
}
test('formal profile includes core and starter parkour, with arbitrary character IDs',()=>{
  const m=fixture();assert.equal(assertCharacterSpriteSet(m,{playable:true}),m);delete m.actions.attack;assert.throws(()=>assertCharacterSpriteSet(m,{playable:true}),/core/);assert.doesNotThrow(()=>assertCharacterSpriteSet(m));
});
test('schema rejects malformed dimensions, direction order, frame events and unknown approval',()=>{
  for(const change of [m=>m.directions.reverse(),m=>m.actions.walk.directionOrder.reverse(),m=>m.assets.walk.width++,m=>m.actions.attack.events.push({frame:4,name:'bad'}),m=>m.assets.idle.provenance.importedFileSha256='b'.repeat(64),m=>{m.stage='approved';m.approval={productionApproved:true,receipt:'untrusted'};},m=>m.assets.idle.file='../idle.png',m=>{m.actions.attack.loop=true;m.actions.attack.oneShot=true;}]){const m=fixture();change(m);assert.throws(()=>assertCharacterSpriteSet(m));}
});
test('direction order has all eight signed views without mirroring',()=>{
  for(let i=0;i<8;i++){assert.equal(resolveSpriteSetDirection(0,i*Math.PI/4),DIRECTIONS[i]);assert.equal(resolveSpriteSetDirection(.7,.7+i*Math.PI/4),DIRECTIONS[i]);}
  assert.equal(resolveSpriteSetDirection(0,-Math.PI/2),'left');assert.equal(resolveSpriteSetDirection(0,Math.PI/2),'right');
});
test('hysteresis is stable on both sides of boundaries, including wrap-around',()=>{
  let view='front';for(const offset of [.01,-.01,.025,-.025])view=resolveSpriteSetDirection(0,Math.PI/8+offset,view);assert.equal(view,'front');
  view=resolveSpriteSetDirection(0,Math.PI/8+.11,view);assert.equal(view,'frontRight');
  for(const offset of [.01,-.01,.025,-.025])view=resolveSpriteSetDirection(0,Math.PI/8+offset,view);assert.equal(view,'frontRight');
  assert.equal(resolveSpriteSetDirection(0,-Math.PI+.02,'back'),'back');
});
test('common and action pivots place the declared ground point exactly at zero',()=>{
  const m=fixture();m.actions.rest.pivot=[.6,.8];
  for(const action of SPRITE_SET_ACTIONS){const g=spriteSetGrounding(m,action);assert.ok(Math.abs(g.y+(.5-g.pivot[1])*g.height)<1e-10);assert.ok(Math.abs(g.x+(g.pivot[0]-.5)*g.width)<1e-10);assert.equal(g.height,2);}
});
test('UVs use direction rows and frame columns with a half-pixel inset',()=>{
  const m=fixture(),front=spriteSetUV(m,'walk','front',0),back=spriteSetUV(m,'walk','back',3);assert.ok(front.v0>back.v1);assert.ok(front.u1<back.u0);assert.equal(front.u0,.5/64);assert.throws(()=>spriteSetUV(m,'walk','unknown',0));assert.throws(()=>spriteSetUV(m,'walk','front',4));
});
test('one-shot holds final frame and emits completion exactly once',()=>{
  const p=createSpriteSetPlayback(fixture());p.play('attack');assert.equal(p.drainEvents().length,1);p.step(.51);assert.equal(p.snapshot().frame,2);assert.equal(p.drainEvents()[0].name,'middle');p.step(.5);assert.equal(p.snapshot().completed,true);assert.equal(p.snapshot().frame,3);assert.equal(p.drainEvents().filter(e=>e.type==='complete').length,1);p.step(1);assert.deepEqual(p.drainEvents(),[]);
});
test('loop events catch up across cycles, pause and reset are deterministic',()=>{
  const p=createSpriteSetPlayback(fixture());p.play('walk');p.drainEvents();p.step(2.25);assert.equal(p.snapshot().frame,1);assert.equal(p.snapshot().cycle,2);assert.equal(p.drainEvents().length,4);const before=p.snapshot();p.pause();p.step(1);assert.equal(p.snapshot().time,before.time);p.reset();assert.equal(p.snapshot().frame,0);assert.equal(p.snapshot().paused,true);p.pause(false);p.step(.25);assert.equal(p.snapshot().frame,1);
});
test('explicit playback mode, weapon variants and missing action behavior',()=>{
  const m=fixture();m.weaponVariants={sword:{attack:'turn'}};const p=createSpriteSetPlayback(m);p.play('attack',{weapon:'sword'});assert.equal(p.snapshot().action,'turn');p.play('attack',{loop:true});p.step(1.1);assert.equal(p.snapshot().completed,false);p.play('walk',{loop:false});p.step(1);assert.equal(p.snapshot().completed,true);assert.throws(()=>p.play('missing'));assert.throws(()=>p.step(Infinity));
});
test('disposal is idempotent, clears events and prevents further playback',()=>{
  const p=createSpriteSetPlayback(fixture());p.play('attack');p.dispose();p.dispose();assert.equal(p.snapshot().disposed,true);assert.deepEqual(p.drainEvents(),[]);assert.throws(()=>p.step(.1),/disposed/);assert.throws(()=>p.reset(),/disposed/);
});
