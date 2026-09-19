import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveMotion} from '../src/adapters/motions.js';
import {SKILLS} from '../src/domain/rules.js';
function clips(id){
 const manifest=JSON.parse(readFileSync(new URL('../public/models/manifest.json',import.meta.url),'utf8'));
 const asset=manifest.find(m=>m.id===id);assert.ok(asset,`Missing asset ${id}`);
 const bytes=readFileSync(new URL('../public/'+asset.file,import.meta.url));
 const json=bytes.subarray(0,4).toString()==='glTF'?JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()):JSON.parse(bytes.toString());
 return new Map((json.animations||[]).map(a=>[a.name,a]));
}
test('all player actions and configured skills resolve to original animation data',()=>{
 const available=clips('RangerAnimations');
 const states=['Idle','Idle_Combat','Running_A','Running_B','Walking_A','Cheer','Death_A','Spawn_Ground_Skeletons','1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Chop',...SKILLS.map(s=>s.animation)];
 for(const state of states){const name=resolveMotion(true,available,state);assert.ok(available.get(name).channels.length>0,`${state} has no authored animation channels`);}
});
test('all ground and flying enemies have native locomotion, death and attack clips',()=>{
 for(const id of ['Ninja','Demon','Wizard','Dragon']){
  const available=clips(id);
  for(const state of ['Idle_Combat','Running_A','Spawn_Ground_Skeletons','Death_C_Skeletons','Spellcast_Shoot','1H_Melee_Attack_Chop','2H_Melee_Attack_Chop'])assert.ok(available.has(resolveMotion(false,available,state)),`${id}: ${state}`);
 }
});
