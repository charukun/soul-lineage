import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,serializeCharacter,deserializeCharacter,visualIdentityForCharacter,visualRole,compareVisualIdentities,validateVisualIdentity,YEAR_MS,BASE_APPEARANCE_PARTS} from '../src/index.js';
const record=(seed,age=22,parents=[])=>createCharacter({id:`qc.${seed}`,seed,ageMs:age*YEAR_MS,parents});
test('new visual channels are deterministic and never mutate canonical Character/JSON/genetics',()=>{
 for(let seed=0;seed<240;seed++){
  const c=record(seed,seed%90),before=serializeCharacter(c),a=visualIdentityForCharacter(c);
  assert.deepEqual(a,visualIdentityForCharacter(deserializeCharacter(before)));
  assert.equal(serializeCharacter(c),before);assert.ok(Object.isFrozen(a.face));validateVisualIdentity(a);
 }
 const parents=[record(501),record(502)],child=record(503,7,parents),before=serializeCharacter(child);
 for(const role of ['resident','knight','smith','hunter'])visualIdentityForCharacter(child,{role});
 assert.equal(serializeCharacter(child),before);assert.deepEqual(child.parents,parents.map(p=>p.id));
});
test('role changes clothing/gear, not inherited facial shape or body identity',()=>{
 const c=record(170),hunter=visualIdentityForCharacter(c,{role:'hunter'}),knight=visualIdentityForCharacter(c,{role:'knight'});
 assert.deepEqual(hunter.face,knight.face);assert.deepEqual(hunter.proportions,knight.proportions);
 assert.equal(hunter.gear,'quiver');assert.equal(knight.gear,'armor');assert.notEqual(hunter.parts.outfit,knight.parts.outfit);
});
test('age and actual workplace constrain child/elder/role silhouettes without changing profession',()=>{
 assert.equal(visualRole('resident','carpenter',35),'artisan');assert.equal(visualRole('resident','logging',40),'laborer');
 assert.equal(visualRole('mayor','logging',75),'mayor');assert.equal(visualRole('resident','',75),'elder');
 for(const age of [0,3,6]){const v=visualIdentityForCharacter(record(4,age),{role:'knight'});assert.equal(v.role,'child');assert.equal(v.gear,'none');}
 const a=visualIdentityForCharacter(record(4,7)),b=visualIdentityForCharacter(record(4,75));
 assert.ok(a.proportions.head>b.proportions.head);assert.ok(a.face.eyeHeight>b.face.eyeHeight);
});
test('explicit legacy parts and Shino baseline remain accepted without expanding v1 slots',()=>{
 const c=record(10),v=visualIdentityForCharacter(c,{role:'knight',parts:BASE_APPEARANCE_PARTS});
 assert.deepEqual(v.parts,BASE_APPEARANCE_PARTS);assert.equal(v.gear,'none');
 assert.throws(()=>validateVisualIdentity({...v,front:'invalid'}));
});
test('color-free 30-person diagnostics detect real duplicates, never claim visual approval',()=>{
 const rows=Array.from({length:30},(_,i)=>({id:`qc.${i}`,identity:visualIdentityForCharacter(record(1000+i))}));
 const report=compareVisualIdentities(rows);assert.ok(report.silhouettes>=24);assert.ok(report.hairstyles>=15);
 assert.ok(report.faceGroups>=8);assert.equal(report.visualApproval,'requires-rendered-review');
 const duplicated=compareVisualIdentities([{id:'a',identity:rows[0].identity},{id:'b',identity:{...rows[0].identity,cloth:[1,0,0]}}]);
 assert.deepEqual(duplicated.similar,[['a','b']]);
});
