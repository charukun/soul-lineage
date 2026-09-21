import test from 'node:test';
import assert from 'node:assert/strict';
import {compileJohakyuSequence,createJohakyuCursor,johakyuIntent,NATIVE_MOTOR} from '../src/index.js';
import {BASIC_FORMS} from '@soul/game-data/combat-forms';
import {COMBAT_STRATEGY_PRESETS,normalizeCombatStrategy} from '@soul/game-data/combat-strategy';

test('canonical sequence contains three authored steps per phase, not third-hit relabelling',()=>{
  const sequence=compileJohakyuSequence(),cursor=createJohakyuCursor({actorId:'actor',sequence});
  const phases=[],kinds=[],ids=new Set();
  for(let i=0;i<9;i++){
    const action=cursor.begin();assert.equal(cursor.begin(),action);assert.ok(Object.isFrozen(action));
    assert.equal(cursor.complete('unknown'),false);assert.equal(cursor.snapshot().active,action);
    phases.push(action.phase);kinds.push(action.kind);ids.add(action.id);
    assert.equal(cursor.complete(action.id),true);assert.equal(cursor.complete(action.id),false);
  }
  assert.deepEqual(phases,['jo','jo','jo','ha','ha','ha','kyu','kyu','kyu']);
  assert.deepEqual(kinds,[...BASIC_FORMS.sword.kinds,...BASIC_FORMS.sword.kinds,...BASIC_FORMS.sword.kinds]);
  assert.equal(ids.size,9);assert.equal(cursor.snapshot().cycles,1);assert.equal(cursor.snapshot().phase,null);
  assert.equal(cursor.begin().phase,'jo');
});

test('different accepted phase recipes change real motion commands and unknown bindings fail closed',()=>{
  const sequence=compileJohakyuSequence({loadout:{jo:'action.guard-step',ha:'action.counter',kyu:'action.recover'}});
  assert.deepEqual(sequence[0].steps.map(s=>s.kind),['guard','bash','back']);
  assert.equal(sequence[0].steps[0].offense,false);assert.equal(sequence[1].steps[1].clip,'1H_Melee_Attack_Stab');
  assert.throws(()=>compileJohakyuSequence({loadout:{jo:'invented.skill'}}),/Unregistered/);
  assert.throws(()=>compileJohakyuSequence({loadout:{jo:'action.finish'}}),/not accepted/);
  assert.throws(()=>compileJohakyuSequence({weapon:'spear'}),/not accepted/);
});

test('an interruption preserves the uncompleted phase and cannot replay an old completion',()=>{
  const cursor=createJohakyuCursor({actorId:'hero'}),a=cursor.begin();
  assert.ok(cursor.cancel(a.id));assert.equal(cursor.complete(a.id),false);
  const b=cursor.begin();assert.notEqual(a.id,b.id);assert.equal(a.phase,b.phase);assert.equal(a.kind,b.kind);
});

test('attention creates different intentions from the same incoming attack',()=>{
  const context={distance:1.7,threat:true,threatProgress:.2,idleSeconds:0};
  assert.equal(johakyuIntent({...context,mind:'aggressive'}).mode,'attack');
  assert.equal(johakyuIntent({...context,mind:'patient'}).mode,'parry');
  assert.equal(johakyuIntent({...context,mind:'counter'}).mode,'parry');
  assert.equal(johakyuIntent({...context,mind:'evasive'}).mode,'space');
  assert.equal(johakyuIntent({...context,mind:{...COMBAT_STRATEGY_PRESETS.balanced,guard:.9}}).mode,'guard');
  assert.equal(johakyuIntent({distance:1.7,mind:'patient',idleSeconds:.1}).mode,'wait');
  assert.equal(johakyuIntent({distance:1.7,mind:'patient',idleSeconds:.5}).mode,'attack');
  assert.equal(johakyuIntent({distance:4,mind:'patient'}).mode,'approach');
  assert.deepEqual(normalizeCombatStrategy('counter'),COMBAT_STRATEGY_PRESETS.counter);
  assert.deepEqual(NATIVE_MOTOR,{heroDuration:.88,enemyDuration:1.22,impactFraction:.43,blendIn:.12,blendOut:.13});
});
