import test from 'node:test';
import assert from 'node:assert/strict';
import {Story,PLACES} from '../src/game/story.js';
import {readStorySave,createStorySave} from '../src/game/story-save.js';
import {LifeClock} from '../public/simulator/src/life-clock.js';
const actor=(x=0,z=0)=>({x,z,hp:340,maxhp:340,dead:false,weapon:'sword'});
function setup(){const story=new Story(),clock=new LifeClock(),hero=actor(-5,1.6),enemies=[];return{story,clock,hero,enemies,frame(){return{life:clock.snapshot(),hero,enemies};},step(n){clock.advance(n);return story.tick(n,this.frame());}};}
test('birth gifts cap at two; release keeps age, inventory and clears birth action',()=>{
  const s=setup();assert.equal(s.story.gift('bell'),true);assert.equal(s.story.gift('bell'),false);assert.equal(s.story.gift('stone'),true);assert.equal(s.story.gift('feather'),false);s.step(30);assert.equal(s.clock.ageYears,.5);s.story.release();assert.equal(s.clock.ageYears,.5);assert.deepEqual(s.story.state.gifts,['bell','stone']);assert.equal(s.story.gift('feather'),false);
});
test('four-year release uses current 60-second clock, even crossing birthdays at x20',()=>{
  const s=setup();s.clock.setRate(20);s.step(11);assert.equal(s.story.state.phase,'birth');assert.deepEqual(s.step(1),['released']);assert.equal(s.clock.ageYears,4);
});
test('activities require a live actor at the right facility and real elapsed time',()=>{
  const s=setup();s.story.release();assert.equal(s.story.startActivity('study','school',s.frame()),false);Object.assign(s.hero,PLACES.find(p=>p.id==='school'));assert.equal(s.story.startActivity('read','school',s.frame()),false);assert.equal(s.story.startActivity('study','school',s.frame()),true);s.clock.setRate(20);s.step(7);assert.equal(s.story.state.experiences.study,0);s.step(1);assert.equal(s.story.state.experiences.study,1);assert.equal(s.clock.ageYears,8/3);
  s.story.startActivity('study','school',s.frame());s.hero.x=-40;s.step(1);assert.equal(s.story.state.activity,null);assert.equal(s.story.state.experiences.study,1);
});
test('crossed experience unlocks a discovery once and leaves it pending for full notebooks',()=>{
  const s=setup();s.story.release();Object.assign(s.story.state.experiences,{study:2,observe:2});s.step(0);assert.deepEqual(s.story.state.pendingDiscoveries,['attention']);s.step(0);assert.deepEqual(s.story.state.discoveries,['attention']);assert.equal(s.story.state.pendingDiscoveries.length,1);
});
test('boarding requires age 15, scheduled world year and physical proximity; return cooldown survives travel',()=>{
  const s=setup();s.story.release();Object.assign(s.hero,PLACES.find(p=>p.id==='port'));s.step(840);assert.equal(s.story.travel(s.frame()),false);s.step(60);s.hero.x=0;assert.equal(s.story.travel(s.frame()),false);s.hero.x=166;assert.equal(s.story.travel(s.frame()),true);assert.equal(s.story.state.zone,'frontier');assert.equal(s.story.travel(s.frame()),false);Object.assign(s.hero,{x:-5,z:3});assert.equal(s.story.travel(s.frame()),true);Object.assign(s.hero,PLACES.find(p=>p.id==='port'));assert.equal(s.story.travel(s.frame()),false);s.step(60);assert.equal(s.story.travel(s.frame()),false);assert.equal(s.story.nextDeparture(s.clock.snapshot()),20);s.step(240);assert.equal(s.story.travel(s.frame()),true);
});
test('five fronts then final encounter; no advance until all enemies are defeated',()=>{
  const s=setup();s.story.release();s.step(900);Object.assign(s.hero,PLACES.find(p=>p.id==='port'));s.story.travel(s.frame());s.enemies.push(actor());assert.equal(s.story.nextFront(s.frame()),false);
  for(let front=0;front<=5;front++){s.enemies[0].dead=false;s.step(0);assert.equal(s.story.state.cleared,false);s.enemies[0].dead=true;s.step(0);assert.equal(s.story.state.cleared,true);assert.equal(s.story.nextFront(s.frame()),front<5);}
  assert.equal(s.story.state.victories,6);
});
test('rescue is spatial, carrying can be dropped, delivery counts once',()=>{
  const s=setup();s.story.release();s.story.state.zone='frontier';s.story.state.rescue={status:'waiting',x:1,z:-3};assert.equal(s.story.rescue(s.frame()),false);Object.assign(s.hero,{x:1,z:-3});assert.equal(s.story.rescue(s.frame()),true);assert.equal(s.story.state.rescue.status,'carried');s.story.rescue(s.frame());assert.equal(s.story.state.rescue.status,'waiting');s.story.rescue(s.frame());Object.assign(s.hero,{x:-5,z:3});s.story.rescue(s.frame());assert.equal(s.story.state.rescued,1);assert.equal(s.story.rescue(s.frame()),false);
});
test('incapacitation recovers in same life; lifespan ends once even during rescue wait',()=>{
  const s=setup();s.story.release();s.story.state.zone='frontier';Object.assign(s.hero,{hp:0,dead:true});s.step(39);assert.equal(s.story.state.zone,'frontier');assert.deepEqual(s.step(1),['recover']);assert.equal(s.story.state.zone,'village');assert.equal(s.clock.lives,1);
  s.clock.setRate(20);s.step(268);assert.equal(s.story.state.phase,'ended');assert.equal(s.story.state.history.length,1);s.step(10);assert.equal(s.story.state.history.length,1);assert.equal(s.clock.ageYears,90);
});
test('rebirth preserves history and world clock without imposing source single-skill inheritance',()=>{
  const s=setup();s.clock.setRate(20);s.step(270);s.story.memento('大切な技');assert.equal(s.story.rebirth(s.clock.snapshot()),true);s.clock.rebirth();assert.equal(s.story.state.generation,2);assert.equal(s.story.state.bornAt,5400);assert.equal(s.story.state.history[0].memento,'大切な技');assert.equal(s.clock.worldSeconds,5400);assert.equal(s.clock.rate,20);assert.equal(s.story.state.phase,'birth');assert.equal(s.story.rebirth(s.clock.snapshot()),false);
});
function envelope(){const s=setup();s.step(3);return createStorySave(s.story,{version:1,life:s.clock.toJSON(),notebook:{format:'tidebreak-atelier',version:10,recipes:[]},hero:s.hero,enemies:[]});}
test('save round-trip keeps position, life, gifts, experiences and independent notebook',()=>{
  const value=envelope();value.story.gifts=['bell'];value.runtime.hero.x=3;const result=readStorySave(JSON.parse(JSON.stringify(value)));assert.deepEqual(result,value);result.story.gifts.push('stone');assert.equal(value.story.gifts.length,1);
});
test('invalid or mixed save envelopes are rejected before mutation',()=>{
  for(const mutate of [v=>v.version=2,v=>v.runtime.life.lives=2,v=>v.runtime.life.rate=21,v=>v.runtime.life.worldSeconds+=1,v=>v.runtime.hero.hp=-1,v=>v.runtime.hero.x=1000,v=>v.story.zone='frontier',v=>v.story.gifts=['bell','stone','feather'],v=>v.story.pendingDiscoveries=['attention'],v=>v.story.experiences.study=null,v=>v.story.history=[{generation:1}]]){const value=envelope();mutate(value);assert.throws(()=>readStorySave(value));}
});
test('village population stays bounded over many world years and after reloading',()=>{
  const s=setup();s.story.release();s.clock.setRate(20);for(let i=0;i<269;i++)s.step(1);assert.ok(s.story.state.residents.length<=30);assert.ok(s.story.state.residents.every(r=>s.clock.worldSeconds-r.bornAt<5400));assert.deepEqual(new Story(s.story.snapshot()).snapshot(),s.story.snapshot());
});
