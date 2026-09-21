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
