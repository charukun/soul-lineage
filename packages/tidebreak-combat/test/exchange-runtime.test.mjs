import test from 'node:test';
import assert from 'node:assert/strict';
import {createTidebreakRuntime} from '../index.js';
import {createTidebreakExchangeObserver} from '../exchange-observer.js';
import {johakyuExchangeHudState} from '../../johakyu-combat/src/exchange-policy.js';

function fixture(){
 const r=createTidebreakRuntime({seed:11,weapon:'sword'});
 r.configure({encounterReady:true,weapon:'sword',enemyWeapon:'sword',hp:1000,enemyHp:1000,positions:{hero:{x:0,z:0,yaw:0},enemy:{x:0,z:1.6,yaw:Math.PI}}});return r;
}
const recipe=(r,id,kind)=>({...r.loadout().jo,id,name:id,steps:[{kind,footwork:'stay',charge:'none'},{kind:'slash',footwork:'stay',charge:'none'},{kind:'none',footwork:'stay',charge:'none'}]});
function receive(kind){
 const r=fixture();r._test.start('enemy',recipe(r,'enemy-slash','slash'));r._test.start('hero',recipe(r,'hero-receive',kind),'ha');
 for(let i=0;i<5;i++)r.step(1/60);
 const before=r.state(),cursor=r._test.cursor(),after=r._test.contact('enemy');return {r,before,after,cursor};
}

for(const kind of ['guard','slip','counter'])test(`actual ${kind} retains enemy pressure and its canonical attack`,()=>{
 const {before,after,cursor,r}=receive(kind),exchange=after.exchanges[0];
 assert.equal(exchange.mode,'pressure');assert.equal(exchange.initiativeId,String(after.enemy.id));assert.equal(exchange.continuity,'retain');
 assert.equal(after.enemy.execution.attackId,before.enemy.execution.attackId);assert.equal(r._test.cursor(),cursor);
 assert.equal(after.hero.transition,false);assert.equal(johakyuExchangeHudState(exchange,{actorId:String(after.hero.id),phase:'ha'}),'maai');
 assert.ok(after.impacts.at(-1)?.execution.attackId,'contact provenance survives response processing');
});

test('actual strong parry preserves the successful stale cursor through recoil and counter, then starts normal jo',()=>{
 const {r,before,after,cursor}=receive('parry'),owner=String(after.hero.id);
 assert.equal(cursor,2,'fixture started the real hero ha sequence');assert.equal(r._test.cursor(),cursor,'no cursor reset at strong contact');
 assert.equal(after.exchanges[0].mode,'reversal');assert.equal(after.exchanges[0].initiativeId,owner);assert.equal(after.exchanges[0].continuity,'reverse');
 assert.equal(after.enemy.attack,null);assert.equal(after.enemy.reaction,true);assert.ok(Math.hypot(after.enemy.knockback.x,after.enemy.knockback.z)>=.6);
 assert.equal(after.hero.transition,true);assert.equal(after.impacts.at(-1).execution.attackId,before.enemy.execution.attackId);
 let counter=false,counterContact=false,completed=false,normal=false,maxRetreat=0;
 for(let i=0;i<300&&!normal;i++){
  const s=r.step(1/60),exchange=s.exchanges[0];maxRetreat=Math.max(maxRetreat,Math.hypot(s.enemy.x-after.enemy.x,s.enemy.z-after.enemy.z));
  if(s.hero.transition){assert.equal(exchange.mode,'reversal');assert.equal(johakyuExchangeHudState(exchange,{actorId:owner,phase:s.hero.slot,reaction:s.hero.transition}),'maai');assert.equal(r._test.cursor(),cursor);}
  for(const event of s.exchangeEvents){
   if(event.sourceId!==owner)continue;
   if(event.type==='counter-start'){counter=true;assert.equal(event.phase,'mind');assert.equal(event.exchange.mode,'reversal');}
   if(event.type==='hit'&&event.phase==='mind')counterContact=true;
   if(event.type==='counter-complete'){completed=true;assert.equal(event.exchange.mode,'reversal');assert.equal(r._test.cursor(),cursor);}
   if(event.type==='normal-start'){normal=true;assert.ok(counter&&completed);assert.equal(event.phase,'jo');assert.equal(s.hero.slot,'jo');assert.equal(johakyuExchangeHudState(exchange,{actorId:owner,phase:s.hero.slot}),'jo');}
  }
 }
 assert.ok(counterContact,'counter uses the real contact route');assert.ok(normal,'cleanup eventually reaches a fresh normal jo');assert.ok(maxRetreat>.12,'canonical recoil leads to physical withdrawal');
});

test('observer keeps 1v3 pairs independent and serial-protects old completion',()=>{
 const observer=createTidebreakExchangeObserver();
 observer.observe({type:'normal-start',sourceId:'hero',targetId:'a',phase:'jo'});
 observer.observe({type:'normal-start',sourceId:'b',targetId:'hero',phase:'enemy'});
 observer.observe({type:'normal-start',sourceId:'c',targetId:'hero',phase:'enemy'});
 observer.observe({type:'parry',sourceId:'hero',targetId:'a',strong:true});
 const stale=observer.observe({type:'kyu-complete',sourceId:'hero',targetId:'a',phase:'kyu',serial:1});
 assert.equal(stale.exchange.mode,'reversal');assert.equal(observer.between('b','hero').initiativeId,'b');assert.equal(observer.between('c','hero').initiativeId,'c');
 assert.equal(observer.snapshot().exchanges.length,3);observer.reset();assert.deepEqual(observer.snapshot(),{exchangeEvents:[],exchanges:[]});
});

test('a fresh configured runtime never restores pending exchange or attacks',()=>{
 const {r}=receive('parry');assert.equal(r.state().exchanges[0].mode,'reversal');
 const s=r.configure({encounterReady:true,weapon:'sword',hp:71,enemyHp:80});
 assert.equal(s.hero.hp,71);assert.equal(s.hero.attack,null);assert.equal(s.hero.transition,false);assert.deepEqual(s.exchanges,[]);assert.deepEqual(s.exchangeEvents,[]);
});
