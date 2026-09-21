import test from 'node:test';
import assert from 'node:assert/strict';
import {createTidebreakRuntime} from '../index.js';

test('inspiration keeps world time live while the hero is invulnerable and the target staggers',()=>{
  const runtime=createTidebreakRuntime({weapon:'sword'});
  runtime.configure({weapon:'sword',hp:120,maxhp:120,enemyHp:120,positions:{hero:{x:-1,z:0},enemy:{x:1,z:0}},encounterReady:true});
  const before=runtime.state(),targetId=before.enemy.id,hp=before.hero.hp;
  const armed=runtime.setInspirationState({active:true,targetId,duration:12.5,nearMissSeconds:.4});
  assert.equal(armed.inspiration.active,true);
  assert.equal(armed.hero.inspirationProtected,true);
  assert.equal(armed.enemy.inspirationStaggered,false);

  const forced=runtime._test.hit('hero',40);
  assert.equal(forced.hero.hp,hp,'direct damage is ignored during inspiration protection');

  for(let i=0;i<30;i++)runtime.step(1/60);
  const live=runtime.state();
  assert.ok(live.time>before.time+.45,'simulation time keeps advancing');
  assert.equal(live.inspiration.active,true);
  assert.equal(live.hero.inspirationProtected,true);
  assert.equal(live.enemy.inspirationStaggered,true);
  assert.ok(live.enemy.stun>0,'target remains in a real combat stagger');

  runtime.setInspirationState({active:false});
  const released=runtime._test.hit('hero',40);
  assert.equal(released.inspiration.active,false);
  assert.equal(released.hero.inspirationProtected,false);
  assert.ok(released.hero.hp<hp,'normal damage resumes when the inspiration window ends');
});
