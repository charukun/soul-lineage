import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,rebirth,serializeLife,deserializeLife} from '../src/rebuild/domain.js';
import {grantFamilyMotion} from '../src/rebuild/family-origin.js';
import {unlockedBodyOptions,setBodyChoice} from '../src/combat-loadout.js';

test('family motion needs an explicit entitlement and survives save and rebirth',()=>{
  const life=createLife({seed:415});
  assert.equal(unlockedBodyOptions(life,'finisher').some(row=>row.id==='family.moonfall'),false);
  assert.equal(setBodyChoice(life,'finisher','family.moonfall'),false);
  life.family=grantFamilyMotion(life.family,'family.moonfall');
  life.family=grantFamilyMotion(life.family,'family.moonfall');
  assert.deepEqual(life.family.familyMotions,['family.moonfall']);
  const loaded=deserializeLife(serializeLife(life));
  assert.equal(unlockedBodyOptions(loaded,'finisher').some(row=>row.id==='family.moonfall'),true);
  assert.equal(setBodyChoice(loaded,'finisher','family.moonfall'),true);
  const child=rebirth(loaded);
  assert.equal(unlockedBodyOptions(child,'finisher').some(row=>row.id==='family.moonfall'),true);
  assert.equal(unlockedBodyOptions(child,'zanshin').some(row=>row.id==='family.moonstill'),false);
});
