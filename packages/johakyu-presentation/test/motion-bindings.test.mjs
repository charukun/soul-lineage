import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileJohakyuCatalogTrial,resolveJohakyuMotion} from '../src/motion-bindings.js';
const manifest=JSON.parse(readFileSync(new URL('../src/manifest.json',import.meta.url)));
test('all seven canonical basic weapons bind existing authored Knight and Warrior clips',()=>{
  for(const weapon of ['fist','sword','dagger','great','spear','axe','staff']){
    const sequence=compileJohakyuCatalogTrial({weapon});assert.equal(sequence.length,3);
    for(const {phase,techniqueId,steps} of sequence){
      assert.equal(techniqueId,`basic.${weapon}`);assert.equal(steps.length,3);
      for(const step of steps){assert.equal(step.scope,'review-trial');assert.equal(step.clock,'canonical-attack-progress');
        for(const model of ['adventurers/Knight','skeletons/Skeleton_Warrior'])assert.equal(resolveJohakyuMotion({...step,phase,availableClips:manifest.models[model].animations}).supported,true,model+'/'+weapon+'/'+step.clip);
      }
    }
  }
});
test('unsupported weapons, unregistered techniques and absent clips fail closed',()=>{
  assert.throws(()=>compileJohakyuCatalogTrial({weapon:'imaginary'}),/Unregistered/);
  assert.throws(()=>compileJohakyuCatalogTrial({loadout:{jo:'invented.ultimate'}}),/Unregistered/);
  assert.equal(resolveJohakyuMotion({weapon:'sword',kind:'imaginary'}).supported,false);
  assert.equal(resolveJohakyuMotion({weapon:'sword',kind:'slash',availableClips:['Idle']}).reason,'missing-authored-clip');
  assert.equal(resolveJohakyuMotion({weapon:'sword',kind:'slash',phase:'unknown'}).supported,false);
});
test('charges retain canonical progress ownership and never add another attack timer',()=>{
  for(const charge of ['none','breath','deep','focus']){
    const binding=resolveJohakyuMotion({weapon:'great',kind:'heavy',charge,phase:'kyu'});
    assert.equal(binding.supported,true);assert.equal(binding.charge,charge);assert.equal(binding.clock,'canonical-attack-progress');
  }
});
