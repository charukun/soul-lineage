import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveJohakyuMotion} from '../src/motion-contract.js';
test('combat motion is semantic, rejects unbound actions and carries the common contact anchor',()=>{
 const slash=resolveJohakyuMotion({weapon:'sword',kind:'slash'});assert.equal(slash.supported,true);assert.equal(slash.contactProgress,.51);assert.equal(slash.bladeTrajectory,'right-to-left');assert.equal(slash.clip,undefined);assert.equal(slash.equipment,undefined);
 assert.equal(resolveJohakyuMotion({weapon:'sword',kind:'unknown'}).supported,false);
 assert.equal(resolveJohakyuMotion({weapon:'sword',kind:'parry'}).offense,false);
});
