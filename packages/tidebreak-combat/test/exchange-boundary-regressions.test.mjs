import test from 'node:test';
import assert from 'node:assert/strict';
import {createTidebreakRuntime} from '../index.js';
const fixture=(ports={})=>{const r=createTidebreakRuntime({seed:11,weapon:'sword',...ports});r.configure({encounterReady:true,weapon:'sword',enemyWeapon:'sword',hp:1000,enemyHp:1000,positions:{hero:{x:0,z:0,yaw:0},enemy:{x:0,z:1.6,yaw:Math.PI}}});return r;};
const recipe=(r,id,kind)=>({...r.loadout().jo,id,name:id,steps:[{kind,footwork:'stay',charge:'none'},{kind:'slash',footwork:'stay',charge:'none'},{kind:'none',footwork:'stay',charge:'none'}]});
test('host capability refusal turns actual authored parry contact into weak deflection, not a free reversal',()=>{
 let consulted=false;const r=fixture({canParry:actor=>{consulted ||=actor.hero;return false;}});
 r._test.start('enemy',recipe(r,'enemy-slash','slash'));r._test.start('hero',recipe(r,'hero-parry','parry'),'ha');for(let i=0;i<5;i++)r.step(1/60);
 const before=r.state(),after=r._test.contact('enemy');assert.ok(consulted);assert.equal(after.enemy.execution.attackId,before.enemy.execution.attackId);
 assert.equal(after.exchanges[0].mode,'pressure');assert.equal(after.exchanges[0].initiativeId,String(after.enemy.id));assert.equal(after.exchanges[0].continuity,'retain');assert.equal(after.hero.transition,false);
});
test('native idle AI receives the owning pair instead of launching a competing normal sequence',()=>{
 const r=fixture();r._test.start('hero',recipe(r,'hero-pressure','slash'));let guarded=false,observed=0;
 for(let i=0;i<120;i++){const s=r.step(1/60),pair=s.exchanges.find(p=>p.initiativeId===String(s.hero.id)&&p.mode==='pressure');if(!pair)continue;observed++;guarded ||=s.enemy.guarding;assert.equal(s.enemy.execution,null);}
 assert.ok(observed>10);assert.ok(guarded,'guard is a real existing actor state, not only an Exchange label');
});
test('special one and finisher execution start do not manufacture a normal melee Exchange',()=>{
 for(const slot of ['one','finisher']){const r=fixture();r._test.start('hero',recipe(r,'special-'+slot,'slash'),slot);assert.equal(r.state().exchanges.length,0);}
});
