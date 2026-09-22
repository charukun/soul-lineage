import test from 'node:test';
import assert from 'node:assert/strict';
import {facilityUpgradePreview,isFacilityUpgradeTarget} from '../src/web/facility-upgrade-ui.js';

const world={
 upgradeCost:()=>({wood:10,stone:5}),
 canAfford:()=>true,
 deficit:()=>[]
};
const built=(kind,level=1)=>({id:`test-${kind}`,kind,x:0,z:0,rot:0,material:'base',room:[],phase:'built',progress:1,level,recipe:{}});

test('upgrade preview shows the actual next-level housing and production gains',()=>{
 const home=facilityUpgradePreview(world,built('home'));
 assert.equal(home.level,1);
 assert.equal(home.nextLevel,2);
 assert.deepEqual(home.effects.find(effect=>effect.label==='定員'),{label:'定員',from:'3人',to:'4人'});

 const logging=facilityUpgradePreview(world,built('logging'));
 assert.deepEqual(logging.effects.find(effect=>effect.label==='就労枠'),{label:'就労枠',from:'2人',to:'3人'});
 assert.deepEqual(logging.effects.find(effect=>effect.label==='生産効率'),{label:'生産効率',from:'×1.00',to:'×1.45'});
});

test('upgrade preview exposes storage and quarry level benefits',()=>{
 const storage=facilityUpgradePreview(world,built('storage'));
 assert.deepEqual(storage.effects.find(effect=>effect.label==='保管上限への加算'),{label:'保管上限への加算',from:'+300',to:'+600'});

 const quarry=facilityUpgradePreview(world,built('quarry'));
 assert.match(quarry.bonuses.join(' '),/輝石/);
});

test('upgrade targeting follows the playable facility boundary',()=>{
 assert.equal(isFacilityUpgradeTarget(built('home')),true);
 assert.equal(isFacilityUpgradeTarget(built('campfire')),false);
 assert.equal(isFacilityUpgradeTarget(built('mayor')),false);
 assert.equal(isFacilityUpgradeTarget({...built('home'),phase:'building'}),false);

 const maxed=facilityUpgradePreview(world,built('home',3));
 assert.equal(maxed.maxed,true);
 assert.equal(maxed.nextLevel,3);
});
