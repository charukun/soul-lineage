import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTO_HUNT_DELAY, withHuntSession} from '../src/hunt/session-loop.js';
import {withHuntProfile} from '../src/hunt/profile-store.js';
import {freshProgress, huntPlan, readProgress, speciesRule, PROGRESS_KEY} from '../src/hunt/balance.js';

const profile = (species = undefined, chapter = 0) => ({
  id:'actor', unlocked:[], equipped:[], form:'hollow', adaptations:{}, visits:{v:{status:'entered'}}, hunts:0, lives:[],
  currentLife:{number:1,hunts:0,eaten:0,battles:0,powers:[],moves:[]},
  ...(species ? {monsterSpecies:species} : {}),
  [PROGRESS_KEY]:{...freshProgress(), chapter}
});
const report = p => ({plan:huntPlan(p), carried:4, targetEaten:false, returnVerified:false});

class TransactionStore {
  constructor(p=profile()) { this.raw=JSON.stringify(p); this.writes=0; }
  read(){ return JSON.parse(this.raw); }
  write(p){ this.raw=JSON.stringify(p); this.writes++; return p; }
  change(fn){ const p=this.read(), result=fn(p); this.write(p); return result; }
  finish(id,status,eaten){ return this.change(p=>{ const v=p.visits[id]; if(!v||v.status!=='entered') return false; v.status=status; v.eaten=eaten; p.hunts++; return true; }); }
}
const Store = withHuntProfile(TransactionStore);

test('death atomically wipes life power and species while preserving visit history', () => {
  const p=profile('night-bat',3);
  Object.assign(p,{unlocked:['smith'],equipped:['smith'],form:'brute',adaptations:{hunter:{encounters:3,moves:['ember'],lastSeenAt:1}}});
  p[PROGRESS_KEY].essence=17; p[PROGRESS_KEY].returns=4; p[PROGRESS_KEY].upgrades={fang:2,heart:1,stride:2};
  const store=new Store(p);
  assert.equal(store.finish('v','defeated',2,report(store.read())),true);
  const after=store.read(), progress=readProgress(after);
  assert.equal(after.visits.v.status,'defeated');
  assert.deepEqual(after.unlocked,[]); assert.deepEqual(after.equipped,[]); assert.deepEqual(after.adaptations,{}); assert.equal(after.form,'hollow');
  assert.equal('monsterSpecies' in after,false);
  assert.equal(progress.essence,0); assert.equal(progress.chapter,0); assert.equal(progress.returns,0); assert.deepEqual(progress.upgrades,{fang:0,heart:0,stride:0});
  assert.equal(progress.lastResult.fullLoss,true); assert.equal(progress.lastResult.lost,4); assert.equal(progress.lastResult.bankedLost,17);
  assert.equal(store.finish('v','defeated',2,report(after)),false);
  assert.equal(store.read().huntProgression.lastResult.bankedLost,17);
});

test('species can be chosen once per life and becomes selectable after death', () => {
  const store=new Store(profile());
  assert.equal(store.species('maw-stalker'),true); assert.equal(store.read().monsterSpecies,'maw-stalker');
  assert.equal(store.species('maw-stalker'),false); assert.throws(()=>store.species('grave-ogre'),/この生/);
  const p=store.read(); p.visits.v={status:'entered'}; store.raw=JSON.stringify(p);
  assert.equal(store.finish('v','defeated',1,report(store.read())),true); assert.equal(store.read().monsterSpecies,undefined);
  assert.equal(store.species('night-bat'),true); assert.equal(store.read().monsterSpecies,'night-bat');
});

test('species materially differ in movement, retreat rate and disengage grace', () => {
  assert.ok(speciesRule('night-bat').moveScale > speciesRule('night-creature').moveScale);
  assert.ok(speciesRule('grave-ogre').moveScale < speciesRule('night-creature').moveScale);
  assert.ok(speciesRule('night-bat').escapeRate > speciesRule('grave-ogre').escapeRate);
  assert.ok(speciesRule('night-bat').grace > speciesRule('grave-ogre').grace);
});

class SessionPort {
  constructor(v,p,ports){
    this.village=structuredClone(v); this.profile=p; this.ports=ports; this.monsterSpecies=p.monsterSpecies||'night-creature';
    this.eaten=0; this.targetEaten=false; this.finished=false; this.fight=null; this.devour=null; this.escapeHold=0; this.safeTime=0;
    this.player={x:0,z:0,hp:120,maxhp:120,autoRoam:false}; this.recipe={id:'native',tempo:1,steps:[]}; this.lastInput=null;
  }
  has(k){return this.profile.unlocked.includes(k);}
  syncGrowth(){const g=this.growth();this.player.maxhp=this.getMaxHP();this.player.hp=Math.min(this.player.hp,this.player.maxhp);this.player.moveScale=g.moveScale;}
  skillSet(){return{weapon:'fist',loadout:{jo:this.recipe,ha:this.recipe,kyu:this.recipe}};}
  emit(type,data={}){this.lastEvent={type,...data};this.ports?.event?.(this.lastEvent);}
  engage(n){this.fight={npc:n,retreat:0};}
  combatantCount(){return this.fight?1:0;}
  nearestEscape(){const e=this.village.entry||{x:0,z:0};return{...e,label:'村口',distance:Math.hypot(this.player.x-e.x,this.player.z-e.z)};}
  tick(dt,input){this.lastInput={...input};if(!this.fight&&input?.amount>0){this.player.x+=(input.x||0)*input.amount*dt;this.player.z+=(input.z||0)*input.amount*dt;}}
  consume(n){n.eaten=true;this.eaten++;this.emit('consume',{role:n.role,reward:{}});}
  finish(status){this.finished=true;this.ports?.finish?.(status,this.eaten);}
}
const Session=withHuntSession(SessionPort,(id,preferred)=>preferred||'night-creature');
const village = (npcs=[], scale='small') => ({id:'g',source:'generated',raidScale:scale,entry:{x:0,z:20},shelter:{x:0,z:-23,r:3.1},npcs});
const npc = (id,role,x,z,hp=38,extra={}) => ({id,role,name:role,x,z,maxhp:hp,hp,dead:false,eaten:false,marked:false,...extra});

test('generated villages contain deep strong enemies but automatic hunting prefers ordinary prey', () => {
  const p=profile('night-creature',2);
  const s=new Session(village([npc('easy','traveller',2,8,38),npc('hard','hunter',0,-5,64)],'medium'),p);
  const hard=s.village.npcs.find(n=>n.id==='hard');
  assert.equal(hard.elite,true); assert.ok(hard.maxhp>64); assert.match(hard.name,/^強敵・/);
  assert.equal(s.nextHuntPrey().npc.id,'easy');
});

test('idle hunt starts quickly and steers toward a villager instead of random wandering', () => {
  const s=new Session(village([npc('prey','traveller',8,0)]),profile('night-creature'));
  s.tick(AUTO_HUNT_DELAY-.05,{x:0,z:0,amount:0}); assert.equal(s.lastInput.amount,0);
  s.tick(.06,{x:0,z:0,amount:0}); assert.ok(s.lastInput.amount>.5); assert.ok(s.lastInput.x>0); assert.equal(s.player.autoRoam,true);
});

test('goal completion stops autonomous hunting so the player can decide to return', () => {
  const s=new Session(village([npc('prey','traveller',8,0)]),profile('night-creature'));
  s.eaten=2;
  s.tick(AUTO_HUNT_DELAY+.1,{x:0,z:0,amount:0});
  assert.equal(s.lastInput.amount,0); assert.equal(s.lastInput.active,true);
});

test('long-return session steering heads to the exit and manual input cancels it', () => {
  const s=new Session(village([npc('prey','traveller',8,0)]),profile('night-bat'));
  s.eaten=1; s.player.x=7; s.player.z=20;
  assert.equal(s.startAutoReturn(),true); s.tick(.1,{x:0,z:0,amount:0});
  assert.ok(s.lastInput.x<0); assert.equal(s.autoReturn,true);
  s.tick(.1,{x:1,z:0,amount:1,active:true}); assert.equal(s.autoReturn,false); assert.equal(s.lastInput.x,1);
});

test('fast species build retreat faster and receive a longer reacquisition grace', () => {
  const make = species => { const s=new Session(village([npc('enemy','hunter',0,0,64)]),profile(species)); s.player.x=5; s.player.z=0; s.fight={npc:s.village.npcs[0],retreat:.5}; return s; };
  const bat=make('night-bat'), ogre=make('grave-ogre');
  bat.tick(.03,{x:1,z:0,amount:1,active:true}); ogre.tick(.03,{x:1,z:0,amount:1,active:true});
  assert.ok(bat.fight.retreat>.5); assert.ok(ogre.fight.retreat<.5);
  bat.emit('disengage'); ogre.emit('disengage'); assert.ok(bat.safeTime>ogre.safeTime);
});
