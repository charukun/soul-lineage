import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ELDER_REFERENCE_MODEL as model} from '@soul/assets/elder-reference';
const bytes=readFileSync(new URL('../public/simulator/assets/ELDER_REFERENCE_V1.vrm',import.meta.url));
const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length).toString());

test('elder candidate is the complete exact-hash local DCC asset',()=>{
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(bytes.length,model.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),model.sha256);
 assert.equal(model.productionReady,false);assert.equal(model.productionStage,'PRIMARY');
 assert.equal(doc.extensions.VRMC_vrm.meta.name,'Rinne_Elderly_Man_DCC');
 assert.equal(Object.keys(doc.extensions.VRMC_vrm.humanoid.humanBones).length,54);
 assert.ok(doc.extensions.VRMC_vrm.meta.allowRedistribution);
 assert.ok(![...(doc.buffers||[]),...(doc.images||[])].some(row=>row.uri),'Asset must be self contained');
});

test('exported skin, hair and garments carry real UVs and humanoid weights',()=>{
 const mats=doc.materials.map(m=>m.name);for(const prefix of ['Skin_','Hair_','Cloth_','Leather_'])assert.ok(mats.some(n=>n.startsWith(prefix)));
 const meshNodes=doc.nodes.filter(n=>Number.isInteger(n.mesh));assert.ok(meshNodes.length>=4);assert.ok(meshNodes.length<=20,'Material batching must keep the candidate bounded');
 const bin=20+length+8;
 for(const node of meshNodes){
  assert.ok(Number.isInteger(node.skin),`Unbound visible surface ${node.name}`);
  for(const primitive of doc.meshes[node.mesh].primitives){
   for(const attr of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])assert.ok(Number.isInteger(primitive.attributes[attr]),`${node.name}: ${attr}`);
   const weights=doc.accessors[primitive.attributes.WEIGHTS_0],view=doc.bufferViews[weights.bufferView];assert.equal(weights.componentType,5126);
   for(let i=0;i<weights.count;i++){
    const offset=bin+(view.byteOffset||0)+(weights.byteOffset||0)+i*(view.byteStride||16);let sum=0;
    for(let j=0;j<4;j++){const w=bytes.readFloatLE(offset+j*4);assert.ok(Number.isFinite(w)&&w>=0&&w<=1);sum+=w;}
    assert.ok(Math.abs(sum-1)<1e-4,`${node.name} vertex ${i}: ${sum}`);
   }
  }
 }
});
