import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {characterForgeReviewCandidates,requireCharacterForgeCandidate} from '@soul/assets/character-create-forge/catalog';

test('Forge review catalog discovers validated Character Packages without UI GLB paths',()=>{
  const ui=readFileSync('apps/review/src/character-forge.js','utf8');
  assert.match(ui,/@soul\/assets\/character-create-forge\/catalog/);
  assert.doesNotMatch(ui,/characters\/forge\/.*\.glb|build\/character\.glb/);
  const root='packages/assets/characters/forge';
  const ids=readdirSync(root,{withFileTypes:true}).filter(row=>row.isDirectory()&&existsSync(join(root,row.name,'manifest.json')))
    .map(row=>JSON.parse(readFileSync(join(root,row.name,'manifest.json'),'utf8')))
    .filter(m=>m.validationStatus==='passed'&&['review-candidate','approved'].includes(m.reviewStatus)).map(m=>m.id).sort();
  assert.deepEqual(characterForgeReviewCandidates.map(row=>row.manifest.id).sort(),ids);
  for(const id of ids)assert.equal(requireCharacterForgeCandidate(id).manifest.id,id);
});

test('Golden Base package carries reusable Golden Rig, morph and socket contract',()=>{
  const m=requireCharacterForgeCandidate('golden-base-v1').manifest;
  assert.equal(m.assetRole,'golden-base');
  assert.equal(m.skeleton.id,'rinne.golden.humanoid.v1');
  assert.equal(m.skeleton.profile,'Golden Rig');
  assert.ok(['Blink','Smile','MouthOpen'].every(name=>m.morphs.some(row=>row.name===name)));
  for(const name of ['head','leftHand','rightHand','weapon'])assert.ok(m.sockets.definitions[name]);
  assert.equal(m.productionReady,false);
  assert.equal(m.reviewStatus,'review-candidate');
});
