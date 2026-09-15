import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const assetURL=new URL('../public/simulator/assets/ARCANIST_ATLAS_DCC.glb',import.meta.url);
const bytes=readFileSync(assetURL);
const adapter=readFileSync(new URL('../src/review/review-adapter.js',import.meta.url),'utf8');
const jsonLength=bytes.readUInt32LE(12);
const doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString().replace(/\u0000+$/,''));
const expectedSha='e61b1a9950c2c515579ee3a602bd4cd1961c114aca8f9619b1e1b29283f916db';
const requiredBones=['hips','spine','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];

test('Arcanist Atlas DCC is the exact real Blender PRIMARY candidate',()=>{
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(bytes.length,717248);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expectedSha);
  assert.equal(doc.asset.extras.rinneCharacter.id,'arcanist.atlas-dcc.v1');
  assert.equal(doc.asset.extras.rinneCharacter.productionStage,'PRIMARY');
  assert.equal(doc.asset.extras.rinneCharacter.modelingMode,'dcc-blender');
  assert.equal(doc.asset.extras.rinneCharacter.visualApproval,'pending');
  assert.equal(doc.extensions.VRMC_vrm.meta.name,'Arcanist Atlas DCC');
  for(const bone of requiredBones)assert.ok(doc.extensions.VRMC_vrm.humanoid.humanBones[bone],`missing ${bone}`);
});

test('Arcanist DCC keeps skinned UV surfaces and stays separate from Atlas BLOCKOUT',()=>{
  const meshNodes=doc.nodes.filter(node=>Number.isInteger(node.mesh));
  assert.ok(meshNodes.length>=20,'expected authored DCC surface set');
  for(const node of meshNodes){
    assert.ok(Number.isInteger(node.skin),`unbound DCC surface: ${node.name}`);
    for(const primitive of doc.meshes[node.mesh].primitives){
      for(const attr of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0']){
        assert.ok(Number.isInteger(primitive.attributes[attr]),`${node.name}: ${attr}`);
      }
    }
  }
  assert.match(adapter,/ARCANIST_ATLAS_STUDY \/ BLOCKOUT/);
  assert.match(adapter,/ARCANIST_ATLAS_DCC \/ PRIMARY/);
  assert.match(adapter,/arcanist\.atlas-study\.v1/);
  assert.match(adapter,/arcanist\.atlas-dcc\.v1/);
  assert.match(adapter,/visualApproval:'pending'/);
  assert.doesNotMatch(adapter,/productionReady:true/);
});
