import test from 'node:test';
import assert from 'node:assert/strict';
import {MASTER_RESIDENT_LIMIT,hashResident,masterModelUrl,residentAppearance,residentMasterScore} from '../src/mura-master-characters.js';

test('resident appearance is deterministic, bounded and role-aware',()=>{
 const base={id:'resident-42',seed:4242,role:'resident',ageYears:22,x:0,z:0};
 const a=residentAppearance(base),b=residentAppearance({...base});
 assert.deepEqual(a,b);
 assert.equal(a.adultHeightMetres,1.72);
 assert.ok(a.scale>=.4&&a.scale<=1);
 assert.ok(a.height>=.9&&a.height<=1.1);
 assert.ok(a.width>=.88&&a.width<=1.12);
 for(const key of ['hair','eyes','skin','dye'])assert.equal(a[key].length,3);
 assert.equal(residentAppearance({...base,role:'mayor'}).dye.join(','),'1,1,1');
 assert.equal(residentAppearance({...base,role:'guard'}).dye.join(','),'0.9,0.55,0.44');
});

test('age drives child/adult/elder appearance without invalid values',()=>{
 const child=residentAppearance({id:'child',seed:1,ageYears:7});
 const adult=residentAppearance({id:'adult',seed:1,ageYears:30});
 const elder=residentAppearance({id:'elder',seed:1,ageYears:85});
 assert.ok(child.scale<adult.scale);
 assert.ok(child.headScale>adult.headScale);
 assert.ok(elder.gray>.8);
 assert.ok(elder.stoop>.1);
 assert.equal(child.canEquipWeapon,true);
 assert.equal(residentAppearance({id:'toddler',seed:1,ageYears:3}).canEquipWeapon,false);
});

test('mayor and guards receive stable near-detail priority',()=>{
 const target={x:0,z:0};
 assert.ok(residentMasterScore({x:60,z:0,role:'mayor'},target)<residentMasterScore({x:5,z:0,role:'resident'},target));
 assert.ok(residentMasterScore({x:20,z:0,role:'guard'},target)<residentMasterScore({x:20,z:0,role:'resident'},target));
 assert.equal(MASTER_RESIDENT_LIMIT,6);
});

test('review model resolves to the sibling Rinne deployment',()=>{
 assert.equal(masterModelUrl('https://example.test/soul-lineage/dev/village/'),'https://example.test/soul-lineage/dev/rinne/simulator/assets/SHINO_review.vrm');
 assert.equal(hashResident('same'),hashResident('same'));
 assert.notEqual(hashResident('same'),hashResident('different'));
});
