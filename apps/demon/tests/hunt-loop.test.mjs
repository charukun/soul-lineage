import test from 'node:test';
import assert from 'node:assert/strict';
import {freshProgress, readProgress, huntPlan, chooseHunt, goalReady, growthFor, bodyStats, preyValue, settleProgress, buyUpgrade, upgradeQuote, PROGRESS_KEY} from '../src/hunt/balance.js';
import {withHuntProfile} from '../src/hunt/profile-store.js';
import {withHuntSession} from '../src/hunt/session-loop.js';
const fresh = () => ({id:'actor', unlocked:[], form:'hollow', visits:{v:{status:'entered'}}, hunts:0, lives:[], [PROGRESS_KEY]:freshProgress()});
const report = (p, patch = {}) => ({plan:huntPlan(p), carried:4, targetEaten:false, returnVerified:true, ...patch});

test('legacy saves receive additive defaults without mutating existing data', () => {
  const old = {id:'old', unlocked:['smith'], visits:{v:{status:'defeated'}}, lives:[{number:1}]};
  const before = structuredClone(old); assert.deepEqual(readProgress(old), freshProgress()); assert.deepEqual(old, before);
});
test('corrupt progression fails closed instead of resetting balance', () => {
  for (const patch of [{version:2}, {essence:-1}, {essence:Infinity}, {chapter:7}, {upgrades:{fang:5, heart:0, stride:0}}, {lastResult:{}}]) {
    const p = fresh(); Object.assign(p[PROGRESS_KEY], patch); const before = structuredClone(p);
    assert.throws(() => readProgress(p)); assert.deepEqual(p, before);
  }
  assert.throws(() => readProgress({[PROGRESS_KEY]:null}));
});
test('all species grow slowly and monotonically, with bounded collision size', () => {
  for (const species of ['night-creature','goblin-runt','horn-brute','maw-stalker','grave-ogre','night-bat']) {
    let previous = growthFor(0, species);
    assert.ok(growthFor(3, species).scale < 1);
    for (let n = 1; n < 50; n++) {
      const next = growthFor(n, species); assert.ok(next.scale >= previous.scale); assert.ok(next.scale <= 1.65);
      assert.ok(next.clearance <= .5); assert.ok(next.hpScale <= 1.28); previous = next;
    }
  }
});
test('body growth and actual native technique speed are separate', () => {
  const p = fresh(), a = bodyStats(p), b = bodyStats(p, 2);
  assert.ok(b.maxHP > a.maxHP); assert.ok(b.tempo > a.tempo); assert.equal(growthFor(2).powerScale, 1);
  p[PROGRESS_KEY].upgrades.fang = 4;
  assert.ok(bodyStats(p, 50).tempo <= 1.3); assert.equal(growthFor(2, 'night-creature', p).scale, growthFor(2).scale);
});
test('first two-prey extraction buys an immediate permanent upgrade', () => {
  const p = fresh(), r = settleProgress(p, 'escaped', 2, report(p));
  assert.equal(r.gained, 10); assert.equal(r.bonus, 6); assert.equal(readProgress(p).chapter, 1);
  const before = bodyStats(p); assert.equal(buyUpgrade(p, 'fang'), true); assert.equal(readProgress(p).essence, 2);
  assert.ok(bodyStats(p).tempo > before.tempo); assert.equal(bodyStats(p).techniqueSpeed, 109);
});
test('death loses carried rewards, not earlier upgrades, traits or chapter', () => {
  const p = fresh(); p.unlocked = ['smith']; p[PROGRESS_KEY].essence = 17; p[PROGRESS_KEY].upgrades.heart = 2;
  const r = settleProgress(p, 'defeated', 2, report(p));
  assert.equal(r.gained, 0); assert.equal(r.lost, 4); assert.equal(readProgress(p).essence, 17);
  assert.equal(readProgress(p).upgrades.heart, 2); assert.deepEqual(p.unlocked, ['smith']); assert.equal(readProgress(p).chapter, 0);
});
test('quit, empty exit, and unverified escaped status cannot mint rewards', () => {
  for (const [status, eaten, patch] of [['abandoned',2,{}], ['escaped',0,{carried:0}], ['completed',2,{returnVerified:false}]]) {
    const p = fresh(); const r = settleProgress(p, status, eaten, report(p, patch));
    assert.equal(r.gained, 0); assert.equal(readProgress(p).returns, 0); assert.equal(readProgress(p).chapter, 0);
  }
});
test('early return banks a partial haul without claiming mission bonus', () => {
  const p = fresh(), r = settleProgress(p, 'escaped', 1, report(p, {carried:2}));
  assert.equal(r.gained, 2); assert.equal(r.cleared, false); assert.equal(readProgress(p).chapter, 0);
});
test('named-prey mission needs both quota and marked prey', () => {
  const p = fresh(); p[PROGRESS_KEY].chapter = 2; const plan = huntPlan(p);
  assert.equal(goalReady(plan, 3, false), false); assert.equal(goalReady(plan, 2, true), false); assert.equal(goalReady(plan, 3, true), true);
  const r = settleProgress(p, 'completed', 3, report(p, {carried:9, targetEaten:false})); assert.equal(r.gained, 9); assert.equal(r.cleared, false);
});
test('forage offers a low-risk recovery route without skipping missions', () => {
  const p = fresh(); p[PROGRESS_KEY].chapter = 3;
  const plan = huntPlan(p, 'forage'); assert.equal(plan.scale, 'small'); assert.equal(plan.target, 'traveller');
  const r = settleProgress(p, 'escaped', 2, report(p, {plan})); assert.equal(r.gained, 6); assert.equal(readProgress(p).chapter, 3);
});
test('rewards resolve canonical bonus, not caller-supplied reward numbers', () => {
  const p = fresh(), plan = {...huntPlan(p), bonus:999999, quota:0};
  assert.equal(settleProgress(p, 'escaped', 2, report(p, {plan})).gained, 10);
  assert.throws(() => settleProgress(p, 'escaped', 1, report(p, {carried:999})));
});
test('all six missions are reachable and the final chapter stays bounded', () => {
  const p = fresh();
  for (let i=0;i<8;i++) {
    const plan = huntPlan(p); const r = settleProgress(p, 'completed', plan.quota, report(p, {plan, carried:plan.quota*2, targetEaten:true}));
    assert.equal(r.cleared, true); assert.equal(readProgress(p).chapter, Math.min(6, i+1));
  }
});
test('upgrades cannot overspend or exceed their caps', () => {
  const p = fresh(); assert.equal(buyUpgrade(p, 'heart'), false); p[PROGRESS_KEY].essence = 1000;
  for(let i=0;i<4;i++) assert.equal(buyUpgrade(p, 'heart'), true);
  assert.equal(buyUpgrade(p, 'heart'), false); assert.equal(upgradeQuote(p, 'heart').maxed, true);
  assert.equal(bodyStats(p).baseHP, 192); assert.throws(() => buyUpgrade(p, '__proto__'));
});
test('route selection preserves offered canonical IDs and source objects', () => {
  const p = fresh(), offers = [{id:'a', source:'generated', raidScale:'small'}, {id:'b', source:'generated', raidScale:'medium'}];
  const before = structuredClone(offers); assert.equal(chooseHunt(offers,p).id,'a');
  p[PROGRESS_KEY].chapter=2; assert.equal(chooseHunt(offers,p).id,'b'); assert.deepEqual(offers,before);
  assert.throws(() => chooseHunt([{id:'owner',source:'imported-local'}],p));
});

// Transaction port double: the production wrapper uses the unchanged ProfileStore transaction.
class TransactionStore {
  constructor(profile=fresh()) { this.raw=JSON.stringify(profile); this.writes=0; this.fail=false; }
  read() { return JSON.parse(this.raw); }
  write(p) { if(this.fail) throw Error('storage full'); this.raw=JSON.stringify(p); this.writes++; return p; }
  change(fn) { const p=this.read(), result=fn(p); this.write(p); return result; }
  finish(id,status,eaten) { return this.change(p => { if(p.visits[id]?.status!=='entered') return false; p.visits[id]={status,eaten}; p.hunts++; return true; }); }
}
const HuntStore = withHuntProfile(TransactionStore);
test('finish and reward use one atomic save; repeated finish has no reward', () => {
  const store=new HuntStore(), p=store.read(); assert.equal(store.finish('v','escaped',2,report(p)),true); assert.equal(store.writes,1);
  assert.equal(store.read().hunts,1); assert.equal(readProgress(store.read()).essence,10);
  assert.equal(store.finish('v','escaped',2,report(p)),false); assert.equal(readProgress(store.read()).essence,10);
});
test('failed save preserves entered visit and money; retry settles exactly once', () => {
  const store=new HuntStore(), before=store.raw, r=report(store.read()); store.fail=true;
  assert.throws(() => store.finish('v','escaped',2,r)); assert.equal(store.raw,before); assert.equal(store.huntSettlement,null);
  store.fail=false; assert.equal(store.finish('v','escaped',2,r),true); assert.equal(readProgress(store.read()).essence,10);
});
test('invalid receipt cannot leave a half-finished visit', () => {
  const store=new HuntStore(), before=store.raw;
  assert.throws(() => store.finish('v','escaped',2,null)); assert.equal(store.raw,before);
});
test('corrupt extension blocks every later write', () => {
  const p=fresh(); p[PROGRESS_KEY].essence=-1; const store=new HuntStore(p), before=store.raw;
  assert.throws(() => store.read()); assert.throws(() => store.upgrade('heart')); assert.equal(store.raw,before);
});

// Session port double checks adapter boundaries, not Tidebreak win rate or actual rendered play.
class SessionPort {
  constructor(v,p,ports) {
    Object.assign(this,{village:v,profile:p,ports,monsterSpecies:p.monsterSpecies,eaten:0,targetEaten:false,finished:false,fight:null,devour:null,escapeHold:0,count:0});
    this.player={x:0,z:0,hp:40,maxhp:40}; this.recipe={id:'native',name:'技',tempo:1,steps:[{kind:'slash',footwork:'forward',charge:'none'}]};
  }
  has(k){return this.profile.unlocked.includes(k);}
  syncGrowth(heal=true){const before=this.player.maxhp,g=this.growth();this.player.maxhp=Math.round(this.getMaxHP()*g.hpScale);if(heal)this.player.hp+=Math.max(0,this.player.maxhp-before);this.player.growthScale=g.scale;}
  skillSet(){return{weapon:'fist',loadout:{jo:this.recipe,ha:this.recipe,kyu:this.recipe}};}
  consume(n){n.eaten=true;this.eaten++;this.targetEaten||=!!n.marked;this.ports.consume?.(n.role,{});this.syncGrowth();this.player.hp=Math.min(this.player.maxhp,this.player.hp+42);this.emit('consume',{role:n.role,reward:{}});}
  emit(type,data){this.ports.event?.({type,...data});}
  engage(n){this.fight={npc:n};this.count++;}
  combatantCount(){return this.count;}
  nearestEscape(){return{x:0,z:0,distance:Math.hypot(this.player.x,this.player.z)};}
  finish(status){this.finished=true;this.ports.finish?.(status,this.eaten);}
}
const Session=withHuntSession(SessionPort, (id,preferred)=>preferred||'night-creature');
const village=()=>({id:'v',npcs:[]});
test('session starts with playable HP and stable species across village IDs', () => {
  const seen=[]; const S=withHuntSession(SessionPort,(id)=>{seen.push(id);return'night-bat';});
  const a=new S(village(),fresh()),b=new S({...village(),id:'other'},fresh());
  assert.deepEqual(seen,['actor','actor']);assert.equal(a.player.hp,108);assert.equal(a.player.hp,b.player.hp);
});
test('native recipe steps and source templates stay intact while tempo changes', () => {
  const p=fresh();p[PROGRESS_KEY].upgrades.fang=2;const s=new Session(village(),p);const original=structuredClone(s.recipe),skills=s.skillSet();
  assert.equal(skills.weapon,'fist');assert.equal(skills.loadout.jo.tempo,1.04);assert.deepEqual(skills.loadout.jo.steps,original.steps);assert.deepEqual(s.recipe,original);
  skills.loadout.jo.steps[0].kind='heavy';assert.equal(s.recipe.steps[0].kind,'slash');
});
test('each prey credits once; healing is bounded and emitted after actual adjustment', () => {
  let seen;const s=new Session(village(),fresh(),{event:e=>{seen=e;}});s.player.hp=30;const prey={role:'traveller',eaten:false};
  s.consume(prey);assert.equal(s.carried,2);assert.ok(s.player.hp<80);assert.equal(seen.reward.healed,s.player.hp-30);assert.equal(seen.reward.lootGain,2);
  s.consume(prey);assert.equal(s.carried,2);assert.equal(s.eaten,1);
});
test('named prey guarantees ability learning through the existing consume port', () => {
  let options;const s=new Session(village(),fresh(),{consume:(role,o)=>{options=o;}});s.consume({role:'traveller'});assert.equal(options.learnTrait,true);
});
test('physical extraction receipt requires stopped, cleared exit hold', () => {
  for (const patch of [{escapeHold:1.5},{escapeHold:1.7,fight:{}},{escapeHold:1.7,devour:{}},{escapeHold:1.7,far:true}]) {
    const s=new Session(village(),fresh());s.eaten=2;s.carried=4;Object.assign(s,patch);if(patch.far)s.player.x=5;s.finish('escaped');assert.equal(s.huntReceipt.returnVerified,false);
  }
  const s=new Session(village(),fresh());s.eaten=2;s.carried=4;s.escapeHold=1.7;s.finish('escaped');assert.equal(s.huntReceipt.returnVerified,true);
});
test('intro pressure escalates with greed without replacing primary combat', () => {
  const s=new Session(village(),fresh());
  assert.deepEqual(s.huntPressure(),{level:0,label:'低',cap:2});
  for(let i=0;i<5;i++)s.engage({id:i});assert.equal(s.count,2);
  s.count=0;s.fight=null;s.consume({role:'traveller',eaten:false});s.consume({role:'traveller',eaten:false});
  assert.equal(s.huntPressure().level,1);
  for(let i=0;i<5;i++)s.engage({id:'mid'+i});assert.equal(s.count,3);
  const forageProfile=fresh(), forageVillage={...village(),huntPlan:{route:'forage'}};
  const forage=new Session(forageVillage,forageProfile);forage.eaten=8;forage.carried=20;
  assert.deepEqual(forage.huntPressure(),{level:0,label:'低',cap:2});
});
test('prey values reward dangerous targets more than easy prey', () => {
  assert.ok(preyValue('knight')>preyValue('hunter'));assert.ok(preyValue('hunter')>preyValue('traveller'));assert.equal(preyValue('unknown'),0);
});

test('opening pressure changes generated maps only and leaves marked threats intact', () => {
  const npcs=[{role:'hunter',z:10,marked:false},{role:'smith',z:10,marked:true},{role:'hunter',z:-12,marked:false}];
  const s=new Session({id:'g',source:'generated',entry:{z:20},npcs:structuredClone(npcs)},fresh());
  assert.equal(s.village.npcs[0].role,'traveller');assert.equal(s.village.npcs[1].role,'smith');assert.equal(s.village.npcs[2].role,'hunter');
  const imported=new Session({id:'i',source:'imported-local',entry:{z:20},npcs:structuredClone(npcs)},fresh());assert.deepEqual(imported.village.npcs,npcs);
});
test('prey guidance never sends a novice into a sealed sanctuary', () => {
  const s=new Session({id:'g',shelter:{x:0,z:-23,r:3.1},npcs:[{id:'sealed',role:'hunter',x:0,z:-23,maxhp:64},{id:'near',role:'traveller',x:0,z:2,maxhp:38}]},fresh());
  assert.equal(s.nextHuntPrey().npc.id,'near');
});
