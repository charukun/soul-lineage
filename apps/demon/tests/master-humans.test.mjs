import test from 'node:test';
import assert from 'node:assert/strict';
import {MASTER_HUMAN_LIMIT,hashHuman,humanAppearance,masterHumanModelUrl,masterHumanScore} from '../src/master-humans.js';

test('human appearance is deterministic and role-specific',()=>{
 const npc={id:'npc-7',role:'hunter'};
 const a=humanAppearance(npc),b=humanAppearance({...npc});
 assert.deepEqual(a,b);
 assert.equal(a.adultHeightMetres,2.02);
 assert.deepEqual(a.dye,[.56,.77,.62]);
 assert.ok(a.height>=.91&&a.height<=1.09);
 assert.ok(a.width>=.89&&a.width<=1.11);
 for(const key of ['hair','eyes','skin','dye'])assert.equal(a[key].length,3);
 assert.deepEqual(humanAppearance({id:'knight',role:'knight'}).dye,[.9,.55,.44]);
});

test('marked and combat roles receive near-detail priority',()=>{
 const player={x:0,z:0};
 assert.ok(masterHumanScore({x:20,z:0,marked:true,role:'traveller'},player)<masterHumanScore({x:5,z:0,role:'traveller'},player));
 assert.ok(masterHumanScore({x:20,z:0,role:'knight'},player)<masterHumanScore({x:20,z:0,role:'traveller'},player));
 assert.equal(MASTER_HUMAN_LIMIT,6);
});

test('review model resolves to sibling Rinne DEV deployment',()=>{
 assert.equal(masterHumanModelUrl('https://example.test/soul-lineage/dev/demon/'),'https://example.test/soul-lineage/dev/rinne/simulator/assets/SHINO_review.vrm');
 assert.equal(hashHuman('same'),hashHuman('same'));
 assert.notEqual(hashHuman('same'),hashHuman('different'));
});
