import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,YEAR_MS,BASE_APPEARANCE_PARTS} from '@soul/characters';
import {qualitySettings,qualityIdentity,qualityProfile,qualityReport} from '../src/character-quality-state.js';
import {createReviewCohort,reviewSettings,serializeReviewSession} from '../src/character-review-state.js';
import {serializeWorkspace,deserializeWorkspace} from '../src/character-workspace-state.js';
const c=createCharacter({id:'test',seed:42,ageMs:22*YEAR_MS});
test('baseline is opt-in viewing, reference Shino remains, explicit editing wins',()=>{
 assert.equal(qualityIdentity(c,0,{}),null);assert.notEqual(qualityIdentity(c,1,{}),null);
 assert.equal(qualityIdentity(c,1,{mode:'baseline'}),null);
 assert.deepEqual(qualityProfile(c,1,{},BASE_APPEARANCE_PARTS),BASE_APPEARANCE_PARTS);
 const a=qualityIdentity(c,1,{role:'knight',reference:false}),b=qualityIdentity(c,1,{role:'hunter',reference:false});
 assert.deepEqual(a.face,b.face);assert.notEqual(a.gear,b.gear);
});
test('filtered quality report preserves original cohort index and visible count',()=>{
 const records=createReviewCohort(reviewSettings({count:6}));
 const reference=qualityReport([records[0]],{},new Map(),[0]);
 assert.equal(reference.count,0);assert.equal(reference.referenceCount,1);
 const second=qualityReport([records[1]],{},new Map(),[1]);
 assert.equal(second.count,1);assert.equal(second.referenceCount,0);
 assert.equal(second.roles,1);
 assert.throws(()=>qualityReport([records[0]],{},new Map(),[]));
});
test('optional quality workspace JSON preserves canonical records and legacy workspace documents',()=>{
 const settings=reviewSettings({count:6}),records=createReviewCohort(settings),session=serializeReviewSession({settings,records});
 const legacy=deserializeWorkspace(serializeWorkspace(session));assert.deepEqual(legacy.session.records,records);
 const q=qualitySettings({role:'hunter',marked:[records[2].id]});
 const next=deserializeWorkspace(serializeWorkspace(session,[],q));assert.deepEqual(next.quality,q);assert.deepEqual(next.session.records,records);
 assert.throws(()=>qualitySettings({marked:['missing']},new Set(['test'])));assert.throws(()=>qualitySettings({mode:'unapproved'}));
});
