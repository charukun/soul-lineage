import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInventoryReport, compareRoleBudget, inspectAssetBuffer, parseAssetDocument } from '../scripts/lib/asset-inspection.mjs';

function glb(document) {
  const json = Buffer.from(JSON.stringify(document));
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const total = 12 + 8 + paddedLength;
  const buffer = Buffer.alloc(total, 0x20);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(total, 8);
  buffer.writeUInt32LE(paddedLength, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20);
  return buffer;
}

const baseDocument = overrides => ({ asset:{version:'2.0',generator:'test'}, accessors:[], meshes:[], materials:[], textures:[], images:[], nodes:[], skins:[], animations:[], ...overrides });

test('GLB inspector separates packed LOD total from near budget and detects compression', () => {
  const document = baseDocument({
    extensionsUsed:['EXT_meshopt_compression','KHR_texture_basisu'],
    accessors:[{count:30000},{count:12000},{count:6000}],
    materials:[{},{}], textures:[{}], images:[{mimeType:'image/ktx2'}],
    meshes:[
      {name:'Tree_LOD0',primitives:[{attributes:{POSITION:0},material:0}]},
      {name:'Tree_LOD1',primitives:[{attributes:{POSITION:1},material:0}]},
      {name:'Tree_LOD2',primitives:[{attributes:{POSITION:2},material:1}]},
    ],
  });
  const budget={role:'environment',styleId:'stylized-low-mid-poly.v1',softTriangleBudget:12000,softMaterialBudget:10,softDrawCallBudget:14};
  const row=inspectAssetBuffer(glb(document),{file:'assets/world/Tree.glb',roleBudget:budget});
  assert.equal(row.metrics.triangles,16000);
  assert.equal(row.metrics.nearTriangles,10000);
  assert.equal(row.metrics.triangleEvidence,'measured');
  assert.equal(row.metrics.nearTriangleEvidence,'measured');
  assert.equal(row.metrics.primitiveCount,3);
  assert.equal(row.metrics.nearPrimitiveCount,1);
  assert.equal(row.budget.checks.triangles,'pass');
  assert.equal(row.budget.measured.triangleBasis,'near-or-lod0');
  assert.equal(row.compression.meshopt,true);
  assert.equal(row.compression.ktx2,true);
  assert.equal(row.lod.hasCompleteAuthoredLod,true);
  assert.equal(row.risk.destructiveOptimizationSafe,true);
  assert.equal(row.priority.action,'monitor');
});

test('review VRM is read-only and routes skinned morph work to canonical source discovery', () => {
  const document=baseDocument({
    extensionsUsed:['VRMC_vrm'], extensions:{VRMC_vrm:{specVersion:'1.0'}},
    accessors:[{count:60000}],
    meshes:[{name:'SHINO',primitives:[{attributes:{POSITION:0},targets:[{POSITION:1},{POSITION:2}]}]}],
    skins:[{joints:Array.from({length:55},(_,i)=>i)}],
    materials:Array.from({length:12},()=>({})), images:Array.from({length:8},()=>({})),
  });
  const row=inspectAssetBuffer(glb(document),{file:'apps/rinne/public/simulator/assets/SHINO_review.vrm'});
  assert.equal(row.vrm.isVrm,true);
  assert.equal(row.vrm.flavor,'VRM1');
  assert.equal(row.metrics.triangles,20000);
  assert.equal(row.metrics.nearTriangles,20000);
  assert.equal(row.metrics.skins,1);
  assert.equal(row.metrics.joints,55);
  assert.equal(row.metrics.morphTargets,2);
  assert.equal(row.risk.reviewArtifact,true);
  assert.equal(row.risk.editableSource,false);
  assert.equal(row.risk.destructiveOptimizationSafe,false);
  assert.equal(row.priority.action,'locate-canonical-source');
});

test('role budgets keep missing evidence unknown and measurable overages as review',()=>{
  const budget={role:'npc',styleId:'stylized-low-mid-poly.v1',softTriangleBudget:50000,softMaterialBudget:14,softDrawCallBudget:20};
  const unknown=compareRoleBudget({triangles:null,nearTriangles:null,materials:null,nearPrimitiveCount:null},budget);
  assert.equal(unknown.gate,'unknown');
  assert.equal(unknown.checks.triangles,'unknown');
  const review=compareRoleBudget({triangles:70000,nearTriangles:70000,materials:10,nearPrimitiveCount:10},budget);
  assert.equal(review.gate,'review');
  assert.equal(review.checks.triangles,'review');
});

test('inventory report sorts expensive unsafe assets first without mutating evidence',()=>{
  const heavy=inspectAssetBuffer(glb(baseDocument({accessors:[{count:180000}],meshes:[{primitives:[{attributes:{POSITION:0},targets:[{}]}]}],skins:[{joints:[0,1]}]})),{file:'characters/heavy.glb',bytes:30*1024*1024});
  const light=inspectAssetBuffer(glb(baseDocument({extensionsUsed:['EXT_meshopt_compression'],accessors:[{count:300}],meshes:[{primitives:[{attributes:{POSITION:0}}]}]})),{file:'props/light.glb',bytes:20000});
  const report=buildInventoryReport([light,heavy],{limit:1,createdAt:'2026-09-15T00:00:00.000Z'});
  assert.equal(report.summary.assets,2);
  assert.equal(report.summary.skinned,1);
  assert.equal(report.priority.length,1);
  assert.equal(report.priority[0].file,'characters/heavy.glb');
  assert.equal(report.priority[0].priority.action,'author-dcc-lod');
});

test('invalid GLB and unsupported extensions fail closed',()=>{
  assert.throws(()=>parseAssetDocument(Buffer.alloc(20),{file:'broken.glb'}),/Invalid GLB\/VRM magic/);
  assert.throws(()=>parseAssetDocument(Buffer.from('{}'),{file:'image.png'}),/Unsupported inspectable asset/);
});
