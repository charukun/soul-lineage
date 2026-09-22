import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTidebreakRuntime} from '../index.js';
import {createJohakyuExchangeState,reduceJohakyuExchange,johakyuExchangeHudState} from '@soul/johakyu-combat/exchange-policy';

function setup(kind,{capable=true}={}){
  const runtime=createTidebreakRuntime({seed:73917,weapon:'sword',canParry:()=>capable});
  runtime.configure({weapon:'sword',encounterReady:true,hp:2000,maxhp:2000,enemyHp:2000,positions:{hero:{x:0,z:0},enemy:{x:0,z:1.5}}});
  const recipe=k=>({...runtime.loadout().jo,id:'rinne-test-'+k,name:'Exchange fixture',steps:[{kind:k,footwork:'stay',charge:'none'},{kind:'none',footwork:'stay',charge:'none'},{kind:'none',footwork:'stay',charge:'none'}]});
  runtime._test.start('enemy',recipe('slash'),'jo');runtime._test.start('hero',recipe(kind),'ha');
  const [hero,enemy]=runtime._test.actors();hero.attack.t=hero.attack.motionDuration*.3;hero.invuln=enemy.invuln=0;
  return{runtime,hero,enemy};
}

test('native ordinary guard and capability-limited weak parry retain the executing attack',()=>{
  for(const [kind,capable] of [['guard',true],['parry',false]]){
    const {runtime,hero,enemy}=setup(kind,{capable}),attack=enemy.attack;
    const snapshot=runtime._test.hit('hero',7),facts=snapshot.exchangeEvents;
    assert.equal(enemy.attack,attack);assert.ok(!attack.deflected);assert.ok(!hero.parryMotion);
    assert.ok(facts.some(e=>e.type==='guard'||e.type==='parry'&&!e.strong));
    assert.equal(facts.some(e=>e.type==='parry'&&e.strong),false);
    let exchange=createJohakyuExchangeState({sourceId:String(enemy.id),targetId:String(hero.id)});
    for(const e of facts)exchange=reduceJohakyuExchange(exchange,e);
    assert.equal(exchange.initiativeId,String(enemy.id));assert.equal(exchange.mode,'pressure');assert.equal(exchange.continuity,'retain');
  }
});

test('native strong parry preserves stale defender cursor through recoil and counter, then starts normal jo',()=>{
  const {runtime,hero,enemy}=setup('parry'),cursor=runtime._test.cursor(),attack=enemy.attack,attackerId=attack.id;
  assert.equal(cursor,2,'fixture must start with a stale 急 cursor');
  const parried=runtime._test.hit('hero',7);
  assert.equal(runtime._test.cursor(),cursor,'successful parry is not a normal jo reset');
  assert.ok(hero.parryMotion);assert.ok(!enemy.attack||attack.deflected);assert.ok(!enemy.attack||enemy.attack.damage===0);
  assert.ok(enemy.reaction||enemy.kx||enemy.kz,'native full-body recoil/retreat remains live');
  const event=parried.exchangeEvents.find(e=>e.type==='parry'&&e.strong);
  assert.ok(event);assert.equal(event.attackId,attackerId);
  assert.equal(parried.impacts.at(-1).execution.phase,'jo','capture execution before native reaction teardown');
  let exchange=createJohakyuExchangeState({sourceId:String(enemy.id),targetId:String(hero.id)});
  for(const e of parried.exchangeEvents)exchange=reduceJohakyuExchange(exchange,e);
  assert.equal(exchange.mode,'reversal');assert.equal(exchange.initiativeId,String(hero.id));
  let counter=false,finished=false,normal=null;
  for(let i=0;i<360&&!normal;i++){
    const snapshot=runtime.step(1/60);
    for(const e of snapshot.exchangeEvents){
      exchange=reduceJohakyuExchange(exchange,e);
      if(e.sourceId!==String(hero.id))continue;
      if(e.type==='counter-start'){counter=true;assert.equal(runtime._test.cursor(),cursor);}
      if(e.type==='counter-complete')finished=true;
      if(e.type==='commit'&&!e.counter&&['jo','ha','kyu'].includes(e.phase))normal=e;
    }
    if(counter&&!finished)assert.equal(johakyuExchangeHudState(exchange,{actorId:String(hero.id),phase:snapshot.hero.slot,counter:snapshot.hero.counterTransition,reaction:snapshot.hero.reaction}),'maai');
  }
  assert.ok(counter&&finished,'counter action must really execute and finish');
  assert.ok(normal,'normal pressure must resume, not remain stuck in reversal');assert.equal(normal.phase,'jo');
});

test('native sequence completion and host integration do not infer kyu completion from an empty attack frame',()=>{
  const native=readFileSync(new URL('../index.js',import.meta.url),'utf8');
  const host=readFileSync(new URL('../../../apps/rinne/src/rebuild/combat-core.js',import.meta.url),'utf8');
  assert.match(native,/run\.slot==='kyu'\)nativeExchange\(a,target,\{type:'kyu-complete'/);
  assert.match(host,/next\.exchangeEvents/);assert.match(host,/heroKyuComplete/);
  assert.doesNotMatch(host,/rotateAfterKyu/);assert.match(host,/canParry:actor/);
  assert.match(native,/v\.id\?\.startsWith\('rinne-'\)/,'preserve authored host defense stages');
  assert.match(host,/applyChoreographyImpact/);assert.match(host,/chargeAttackStamina/);
});
