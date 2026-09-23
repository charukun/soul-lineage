import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

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
function parents(doc){
  const out=new Map();
  doc.nodes.forEach((node,index)=>(node.children||[]).forEach(child=>out.set(child,index)));
  return out;
}
function nodeName(doc,index){return doc.nodes[index]?.name||('#'+index)}
function skinSummary(doc){
  assert.ok(doc.skins?.length,'skin required');
  const skin=doc.skins[0], jointSet=new Set(skin.joints), parent=parents(doc);
  const rows=skin.joints.map(index=>{
    const p=parent.get(index);
    return {
      index,
      name:nodeName(doc,index),
      parent:p===undefined?null:nodeName(doc,p),
      parentIsJoint:p!==undefined&&jointSet.has(p),
      children:(doc.nodes[index]?.children||[]).filter(child=>jointSet.has(child)).map(child=>nodeName(doc,child))
    };
  });
  return {
    joints:skin.joints.length,
    roots:rows.filter(row=>!row.parentIsJoint).map(row=>row.name),
    names:rows.map(row=>row.name),
    edges:rows.filter(row=>row.parentIsJoint).map(row=>[row.parent,row.name]),
    rows
  };
}
function diffs(a,b){
  const key=rows=>new Map(rows.map(row=>[row.name,row]));
  const A=key(a.rows),B=key(b.rows),names=[...new Set([...A.keys(),...B.keys()])].sort();
  return names.flatMap(name=>{
    const x=A.get(name),y=B.get(name);
    if(!x||!y)return[{name,only:x?'left':'right'}];
    if(x.parent!==y.parent||JSON.stringify(x.children)!==JSON.stringify(y.children))return[{name,left:{parent:x.parent,children:x.children},right:{parent:y.parent,children:y.children}}];
    return[];
  });
}

test('diagnose protagonist Rig_Medium hierarchy against pinned KayKit sources',()=>{
  const docs=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,glb(path)]));
  const summaries=Object.fromEntries(Object.entries(docs).map(([key,doc])=>[key,skinSummary(doc)]));
  const report={
    maleVsKnight:diffs(summaries.male,summaries.knight),
    femaleVsRogue:diffs(summaries.female,summaries.rogue),
    summaries:Object.fromEntries(Object.entries(summaries).map(([key,row])=>[key,{joints:row.joints,roots:row.roots,names:row.names,edges:row.edges}]))
  };
  console.log('PROTAGONIST_RIG_DIAGNOSTIC '+JSON.stringify(report));
  assert.equal(summaries.female.joints,summaries.rogue.joints);
  assert.equal(report.femaleVsRogue.length,0);
  assert.ok(summaries.male.joints>=15);
});
