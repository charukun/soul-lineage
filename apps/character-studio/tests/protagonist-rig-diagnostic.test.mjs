import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KAYKIT_HUMANOID_BONES,KAYKIT_HUMANOID_EDGES} from '@soul/rendering/kaykit-rig';

const files={
  male:'apps/character-studio/public/simulator/assets/PROTAGONIST_VILLAGER_V1.glb',
  female:'apps/review/public/library/model/3ced3b11942d57cd82763715c7196dfd4f53141e/HeroineDawn.glb',
  knight:'apps/review/public/library/model/717b56ca2b5ff5392679774725201ba03a3eefab/Knight.glb',
  rogue:'apps/review/public/library/model/c8827661105eef7b2bfbef3bc676d41a47625733/Rogue.glb'
};

function glb(path){
  const body=readFileSync(path);
  assert.equal(body.readUInt32LE(0),0x46546c67,path);
  const jsonLength=body.readUInt32LE(12);
  return JSON.parse(body.subarray(20,20+jsonLength).toString('utf8').trimEnd());
}
function topology(doc){
  assert.equal(doc.skins?.length,1,'one skin expected');
  const skin=doc.skins[0], jointSet=new Set(skin.joints), parent=new Map();
  doc.nodes.forEach((node,index)=>(node.children||[]).forEach(child=>parent.set(child,index)));
  const name=index=>doc.nodes[index]?.name||('#'+index);
  return {
    joints:skin.joints.length,
    names:skin.joints.map(name),
    edges:skin.joints.flatMap(index=>{
      const p=parent.get(index);
      return p!==undefined&&jointSet.has(p)?[[name(p),name(index)]]:[];
    })
  };
}

const docs=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,glb(path)]));
const rigs=Object.fromEntries(Object.entries(docs).map(([key,doc])=>[key,topology(doc)]));

test('male protagonist keeps the pinned Knight Rig_Medium skin topology',()=>{
  assert.equal(rigs.male.joints,41);
  assert.deepEqual(rigs.male.names,rigs.knight.names);
  assert.deepEqual(rigs.male.edges,rigs.knight.edges);
});

test('female protagonist keeps the pinned Rogue Rig_Medium skin topology',()=>{
  assert.equal(rigs.female.joints,41);
  assert.deepEqual(rigs.female.names,rigs.rogue.names);
  assert.deepEqual(rigs.female.edges,rigs.rogue.edges);
});

test('legacy 1.0 Rig_Medium contains IK/control joints that must not pollute the humanoid review overlay',()=>{
  const helpers=rigs.knight.names.filter(name=>/IK|control-|handslot|wrist|toes/i.test(name));
  assert.ok(helpers.length>=10,'legacy source should expose its authored helper/control joints');
  assert.equal(KAYKIT_HUMANOID_BONES.length,15);
  assert.equal(KAYKIT_HUMANOID_EDGES.length,14);
  for(const key of KAYKIT_HUMANOID_EDGES.flat()){
    assert.ok(KAYKIT_HUMANOID_BONES.includes(key),key);
    assert.doesNotMatch(key,/ik|control|wrist|handslot|toe/i);
  }
});
