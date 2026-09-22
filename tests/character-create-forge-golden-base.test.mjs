import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Golden Base GLB contains skin, morph targets, Golden Rig and required sockets',()=>{
  const path='packages/assets/characters/forge/golden-base-v1/build/character.glb';
  const bytes=readFileSync(path),jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength));
  assert.equal(doc.skins[0].name,'rinne.golden.humanoid.v1');
  const head=doc.meshes.find(m=>m.name==='head');
  assert.deepEqual(head.extras.targetNames,['Blink','Smile','MouthOpen']);
  assert.equal(head.primitives[0].targets.length,3);
  for(const name of ['head','leftHand','rightHand','weapon'])assert.ok(doc.nodes.some(node=>node.extras?.socket===name));
  assert.ok(doc.meshes.every(mesh=>!['clothing','rearHair'].includes(mesh.name)));
  assert.ok(doc.meshes.every(mesh=>mesh.primitives[0].attributes.WEIGHTS_0!==undefined));
});
