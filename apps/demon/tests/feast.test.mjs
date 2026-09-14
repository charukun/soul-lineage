import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {RaidSession} from '@soul/raid';
import {ProfileStore} from '@soul/raid/profile';
import {feastEnvelope,feastReward,nextPrey,scentBearing} from '../src/web/feast-state.js';
import {FeastEffects} from '../src/web/feast-effects.js';
import {createCreature,animateCreature} from '../src/web/creatures.js';
import {NightAudio} from '../src/web/audio.js';

function fixture(){
 const data=new Map(),store=new ProfileStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},()=> 'feast-fixture');
 let game;game=new RaidSession({id:'feast',seed:12,name:'test',target:'smith',raidScale:'small'},store.read(),{consume(role){store.unlock(role);game.refreshProfile(store.read());}});
 game.player.x=0;game.player.z=0;return {game,store};
}
const consumeEvent=g=>g.events.filter(e=>e.type==='consume').at(-1);
test('successful capture reports real capped healing and persisted memory exactly once',()=>{
 const {game,store}=fixture(),n=game.village.npcs[0];game.player.hp=220;
 game.consume(n);const event=consumeEvent(game),r=feastReward(event);
 assert.equal(event.reward.healed,10);assert.equal(r.kind,'memory');assert.match(r.detail,/生命 \+10/);
 assert.equal(store.read().totalEaten,1);assert.equal(event.reward.equipped,true);
 game.consume(n);assert.equal(store.read().totalEaten,1);assert.equal(game.events.filter(e=>e.type==='consume').length,1);
 const duplicate=game.village.npcs.find(v=>v!==n&&v.role===n.role);game.consume(duplicate);
 assert.equal(feastReward(consumeEvent(game)).kind,'restore');assert.match(feastReward(consumeEvent(game)).detail,/満ちている/);
});
test('new form and permanent max health reflect the actual before/after profile',()=>{
 const {game}=fixture();game.consume(game.village.npcs[0]);game.player.hp=100;
 game.consume({...game.village.npcs[1],id:'smith',role:'smith'});
 const e=consumeEvent(game),r=feastReward(e);
 assert.equal(e.reward.maxHpGain,65);assert.equal(e.reward.healed,140);assert.equal(game.player.maxhp,295);
 assert.equal(r.kind,'form');assert.match(r.title,/夜這い 解放/);assert.match(r.progress,/あと2種/);
 assert.equal(game.profile.form,'stalker');
});
test('legacy equipment slots never suppress a permanently devoured power',()=>{
 const {game,store}=fixture();for(const role of ['traveller','bellkeeper','hunter'])store.unlock(role);game.refreshProfile(store.read());
 game.consume({...game.village.npcs[0],id:'smith',role:'smith'});const e=consumeEvent(game);
 assert.equal(e.reward.equipped,true);assert.equal(e.reward.maxHpGain,140);assert.match(feastReward(e).detail,/生命/);assert.equal(store.read().equipped.length,3);
 assert.equal(game.has('smith'),true);assert.equal(game.player.maxhp,370);assert.equal(game.profile.form,'brute');
});
test('cancelled feeding never creates a consume reward and restart uses a fresh clock',()=>{
 const {game,store}=fixture(),n=game.village.npcs[0];Object.assign(n,{dead:true,x:0,z:.7});
 game.village.colliders=[];game.village.gate.broken=true;game.devour={npc:n,t:0};
 game.tick(1/30,{x:0,z:0,amount:0});assert.ok(game.player.devourProgress>0);
 game.tick(1/30,{x:1,z:0,amount:1});assert.equal(game.player.devourProgress,null);assert.equal(n.capturedBy,undefined);
 assert.equal(store.read().totalEaten,0);assert.equal(consumeEvent(game),undefined);
 game.tick(1/30,{x:0,z:0,amount:0});game.tick(1/30,{x:0,z:0,amount:0});assert.ok(game.player.devourProgress<.03);
});
test('reward envelopes are finite, reduced motion has no dolly, and effects expire',()=>{
 for(let i=0;i<=100;i++)for(const age of [0,.05,.3,1,2,2.4,Infinity]){
  const s=feastEnvelope(i/100,age,{reducedMotion:true});assert.equal(s.camera,0);
  for(const value of Object.values(s))if(typeof value==='number')assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
 }
 assert.equal(feastEnvelope(null,2.4).release,false);assert.equal(feastEnvelope(null).feeding,false);
});
test('next prey prefers unknown memory and yields to return, battle and sealed sanctuary',()=>{
 const {game}=fixture();game.profile.unlocked=['traveller'];game.village.npcs=[
  {id:'known',role:'traveller',x:0,z:1}, {id:'fresh',role:'bellkeeper',x:4,z:4},
  {id:'sealed',role:'smith',x:0,z:-23}, {id:'eaten',role:'hunter',x:0,z:1,eaten:true}];
 const before=JSON.stringify(game.village.npcs);assert.equal(nextPrey(game,{revealed:true}).npc.id,'fresh');
 assert.equal(JSON.stringify(game.village.npcs),before);assert.equal(nextPrey(game,{returning:true}),null);
 game.fight={};assert.equal(nextPrey(game,{revealed:true}),null);game.fight=null;
 game.village.npcs[1].eaten=true;assert.equal(nextPrey(game,{revealed:true}).npc.id,'known');
 game.village.npcs[0].z=20;assert.equal(nextPrey(game),null);game.scent=2;assert.equal(nextPrey(game).npc.id,'known');
});
test('screen bearings agree with the real game camera right and forward axes',()=>{
 const p={x:0,z:0},a=.33;
 assert.ok(Math.abs(scentBearing(p,{x:-Math.sin(a),z:-Math.cos(a)}))<1e-12);
 assert.ok(Math.abs(scentBearing(p,{x:Math.cos(a),z:-Math.sin(a)})-Math.PI/2)<1e-12);
});
test('real Three effects keep a fixed object budget and clear particles/light on cancel and new village',()=>{
 const {game}=fixture(),scene=new T.Scene(),fx=new FeastEffects(scene,new T.Texture()),count=fx.root.children.length;
 game.player.devourProgress=.55;game.devour={npc:game.village.npcs[0]};fx.update(game);
 assert.equal(fx.root.visible,true);assert.equal(fx.souls.geometry.attributes.position.count,84);
 assert.ok([...fx.positions].every(Number.isFinite));
 game.player.devourProgress=null;game.devour=null;fx.update(game);assert.equal(fx.root.visible,false);assert.equal(fx.light.intensity,0);
 game.consume(game.village.npcs[0]);const e=consumeEvent(game);
 for(let i=0;i<40;i++){fx.event({...e,at:game.time});game.time+=.1;fx.update(game);assert.equal(fx.root.children.length,count);assert.ok([...fx.positions,...fx.wispPositions].every(Number.isFinite));}
 game.time+=3;fx.update(game);assert.equal(fx.root.visible,false);assert.equal(fx.light.intensity,0);
 fx.reset();assert.equal(fx.beacon.visible,false);fx.dispose();assert.equal(scene.children.length,0);
});
test('release opens real creature arms, keeps soles planted and yields to movement',()=>{
 for(const form of ['hollow','stalker','brute','wraith']){
  const g=createCreature(true),a={x:0,z:0,yaw:0,speed:0};
  animateCreature(g,a,0,{form});const rest=g.userData.limbs[0].arm.hand.position.clone();
  animateCreature(g,a,0,{form,feast:1});g.updateMatrixWorld(true);
  for(const {leg} of g.userData.limbs){const pos=leg.foot.getWorldPosition(new T.Vector3());assert.ok(pos.y>.065&&pos.y<.09,`${form} foot ${pos.y}`);}
  assert.ok(g.userData.limbs[0].arm.hand.position.distanceTo(rest)>.2);
  animateCreature(g,{...a,speed:1,walk:1},0,{form,feast:1});const walking=g.userData.limbs[0].arm.hand.position.clone();
  animateCreature(g,{...a,speed:1,walk:1},0,{form});assert.ok(g.userData.limbs[0].arm.hand.position.distanceTo(walking)<1e-12);
  animateCreature(g,a,0,{form,feast:0});assert.ok(g.userData.limbs[0].arm.hand.position.distanceTo(rest)<1e-12);
 }
});
test('audio bite accents cross each authored bite only once, including low frame rate',()=>{
 const a=new NightAudio(),calls=[];a.tone=(...args)=>calls.push(args);a.crunch=()=>calls.push('crunch');
 for(const p of [0,.29,.52,.53,.72,.74,null])a.feed(p);
 assert.equal(calls.filter(c=>c==='crunch').length,2);
 a.feed(.2);a.feed(null);assert.equal(calls.filter(c=>c==='crunch').length,2);
});
