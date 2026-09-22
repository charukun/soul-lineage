import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuDomainActor} from '../src/domain.js';
import {johakyuStageCapability,johakyuTechniqueCapability} from '../src/execution-capability.js';

const actor=overrides=>createJohakyuDomainActor({id:'hero',side:'hero',hp:100,maxHp:100,stamina:100,staminaCap:100,...overrides});

test('execution capability turns canonical stamina and six-part injury into stage and technique decisions',()=>{
  const healthy=actor({});
  const slash=johakyuStageCapability(healthy,{weapon:'sword',phase:'jo',kind:'slash',footwork:'forward',staminaCost:8});
  assert.equal(slash.allowed,true);assert.equal(slash.reason,null);assert.equal(slash.body.functionalArms,2);assert.equal(slash.body.functionalLegs,2);

  const exhausted=actor({stamina:8});
  assert.equal(johakyuStageCapability(exhausted,{weapon:'sword',kind:'slash',footwork:'forward',staminaCost:3}).reason,'stamina-policy');

  const armHurt=actor({injuries:{leftArm:{severity:.72},rightArm:{severity:.74}}});
  assert.equal(johakyuStageCapability(armHurt,{weapon:'sword',kind:'slash',footwork:'stay',staminaCost:2}).reason,'arm-injury');

  const oneArm=actor({injuries:{leftArm:{severity:.72},rightArm:{severity:.1}}});
  assert.equal(johakyuStageCapability(oneArm,{weapon:'sword',kind:'slash',footwork:'stay',staminaCost:2}).allowed,true);
  assert.equal(johakyuStageCapability(oneArm,{weapon:'sword',kind:'slash',footwork:'stay',staminaCost:2,requiresTwoHands:true}).reason,'arm-injury');

  const legHurt=actor({injuries:{leftLeg:{severity:.72},rightLeg:{severity:.1}}});
  assert.equal(johakyuStageCapability(legHurt,{weapon:'sword',kind:'guard',footwork:'forward',staminaCost:1}).allowed,true);
  assert.equal(johakyuStageCapability(legHurt,{weapon:'sword',kind:'guard',footwork:'rush',staminaCost:1}).reason,'leg-injury');

  const torsoHurt=actor({stamina:15,injuries:{torso:{severity:.7}}});
  const taxed=johakyuStageCapability(torsoHurt,{weapon:'sword',kind:'slash',footwork:'stay',staminaCost:10});
  assert.ok(taxed.stamina.effectiveCost>taxed.stamina.baseCost,'torso injury must raise effective stamina demand');

  const sequence=johakyuTechniqueCapability(actor({stamina:18}),{weapon:'sword',phase:'ha',stages:[
    {kind:'guard',footwork:'stay',staminaCost:3},
    {kind:'counter',footwork:'stay',staminaCost:8},
    {kind:'thrust',footwork:'chase',staminaCost:8},
  ]});
  assert.equal(sequence.canStart,true);assert.equal(sequence.canContinue,false);assert.equal(sequence.blockedStageIndex,2);assert.equal(sequence.reason,'stamina-policy');
});

test('weapon defense needs a functional grip in every phase, not just offensive motion',()=>{
  const defenses=['guard','brace','parry'];
  for(const phase of ['jo','ha','kyu','uke'])for(const kind of defenses){
    for(const weapon of ['great','spear','axe','staff'])for(const injuredArm of ['leftArm','rightArm']){
      const state=actor({injuries:{[injuredArm]:{severity:.68}}}),before=structuredClone(state);
      const cap=johakyuStageCapability(state,{weapon,phase,kind,staminaCost:2});
      assert.equal(cap.allowed,false,`${weapon}/${phase}/${kind}/${injuredArm}`);
      assert.equal(cap.reason,'arm-injury');assert.equal(cap.offense,false);
      assert.equal(cap.body.armDemand,2);assert.equal(cap.body.functionalArms,1);
      assert.deepEqual(state,before,'rejected defense must not spend stamina, mutate injury or advance time');
      assert.equal(johakyuStageCapability(actor({}),{weapon,phase,kind,staminaCost:2}).allowed,true);
    }
    for(const weapon of ['fist','sword','dagger'])for(const injuredArm of ['leftArm','rightArm']){
      const state=actor({injuries:{[injuredArm]:{severity:.68}}});
      const cap=johakyuStageCapability(state,{weapon,phase,kind,staminaCost:2});
      assert.equal(cap.allowed,true,`${weapon}/${phase}/${kind} retains its remaining arm`);
      assert.equal(cap.body.armDemand,1);assert.equal(cap.equipment.requiresTwoHands,false);
    }
  }
});

test('defensive grip preserves non-arm alternatives and cannot be weakened by a caller flag',()=>{
  const noArms=actor({injuries:{leftArm:{severity:.72},rightArm:{severity:.74}}});
  for(const weapon of ['fist','sword','dagger','great','spear','axe','staff']){
    for(const kind of ['guard','brace','parry']){
      assert.equal(johakyuStageCapability(noArms,{weapon,kind,staminaCost:1}).reason,'arm-injury');
    }
    for(const [kind,footwork] of [['ready','stay'],['retreat','retreat'],['slip','sideL']]){
      const cap=johakyuStageCapability(noArms,{weapon,kind,footwork,staminaCost:1});
      assert.equal(cap.allowed,true,`${weapon}/${kind} does not receive force through injured arms`);
      assert.equal(cap.body.armDemand,0);
    }
  }
  const oneArm=actor({injuries:{leftArm:{severity:.72}}});
  for(const weapon of ['great','spear','axe','staff'])for(const kind of ['slash','guard','brace','parry','counter']){
    const cap=johakyuStageCapability(oneArm,{weapon,kind,requiresTwoHands:false});
    assert.equal(cap.reason,'arm-injury');assert.equal(cap.equipment.requiresTwoHands,true);
  }
  assert.equal(johakyuStageCapability(oneArm,{weapon:'sword',kind:'guard',requiresTwoHands:true}).reason,'arm-injury');
  const tired=actor({stamina:8});
  assert.equal(johakyuStageCapability(tired,{weapon:'great',kind:'guard',staminaCost:2}).allowed,true,'low stamina alone must not turn defense into offense');
  assert.equal(johakyuStageCapability(tired,{weapon:'great',kind:'guard',staminaCost:9}).reason,'stamina');
  assert.equal(johakyuStageCapability(oneArm,{weapon:'bow',kind:'guard'}).reason,'motion','unsupported weapon semantics remain fail-closed');
});

test('technique lookahead and execution recheck share the same defensive grip requirement',()=>{
  const stages=[{kind:'ready',footwork:'stay',staminaCost:0},{kind:'parry',footwork:'stay',staminaCost:2,requiresTwoHands:false},{kind:'counter',footwork:'forward',staminaCost:6}];
  const healthy=actor({});
  assert.equal(johakyuTechniqueCapability(healthy,{weapon:'great',stages}).canContinue,true);
  const wounded=actor({injuries:{rightArm:{severity:.68}}}),before=structuredClone(wounded);
  const forecast=johakyuTechniqueCapability(wounded,{weapon:'great',stages,requiresTwoHands:false});
  assert.equal(forecast.canStart,true);assert.equal(forecast.canContinue,false);
  assert.equal(forecast.reason,'arm-injury');assert.equal(forecast.blockedStageIndex,1);
  assert.equal(forecast.remainingStamina,wounded.stamina,'unexecutable defense is not paid for');
  const continuation=johakyuTechniqueCapability(wounded,{weapon:'great',stages,fromStage:1});
  assert.equal(continuation.canStart,false);assert.equal(continuation.blockedStageIndex,1);
  assert.equal(johakyuStageCapability(wounded,{weapon:'great',...stages[1]}).reason,forecast.reason);
  assert.equal(johakyuTechniqueCapability(wounded,{weapon:'sword',stages}).canContinue,true,'a one-handed loadout retains a physically available answer');
  assert.deepEqual(wounded,before,'forecast and final gate are pure decisions');
});
