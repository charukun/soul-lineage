import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterExpressions, CHARACTER_EXPRESSION_CONTRACT as contract} from '../src/character-expressions.js';

function fixture() {
  const names = ['blink', 'smile', 'mouth-open'];
  const mesh = {isMesh:true, name:'face', morphTargetDictionary:Object.fromEntries(names.map((n,i)=>[n,i])), morphTargetInfluences:[.2,.3,.4], geometry:{attributes:{position:{count:4}}, morphAttributes:{position:names.map(()=>({count:4}))}}};
  return {mesh, root:{traverse:fn=>fn(mesh)}};
}
test('expression changes compose with animation without modifying neutral geometry', () => {
  const {root,mesh}=fixture(), geometry=mesh.geometry, api=createCharacterExpressions(root,contract);
  assert.deepEqual(mesh.morphTargetInfluences,[0,0,0]);
  api.set('blink',.75); assert.deepEqual(mesh.morphTargetInfluences,[.75,0,0]);
  api.set('smile'); assert.deepEqual(mesh.morphTargetInfluences,[0,1,0]);
  api.set('neutral'); assert.deepEqual(mesh.morphTargetInfluences,[0,0,0]);
  assert.equal(mesh.geometry,geometry);
  assert.throws(()=>api.set('smile',NaN)); assert.throws(()=>api.set('smile',1.1)); assert.throws(()=>api.set('unknown'));
});
test('missing or malformed targets fail instead of claiming morph support', () => {
  const {root,mesh}=fixture(); delete mesh.morphTargetDictionary.blink;
  assert.throws(()=>createCharacterExpressions(root,contract),/Missing geometric expression blink/);
  mesh.morphTargetDictionary.blink=0; mesh.geometry.morphAttributes.position[0].count=3;
  assert.throws(()=>createCharacterExpressions(root,contract),/Invalid geometric expression blink/);
});
