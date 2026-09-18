import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { buildRepositoryAssetInventory, inspectInventoryFiles } from '../scripts/asset-inventory.mjs';

function glb(document) {
  const json=Buffer.from(JSON.stringify(document));
  const padded=Math.ceil(json.length/4)*4,total=20+padded,buffer=Buffer.alloc(total,0x20);
  buffer.writeUInt32LE(0x46546c67,0);buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(total,8);buffer.writeUInt32LE(padded,12);buffer.writeUInt32LE(0x4e4f534a,16);json.copy(buffer,20);return buffer;
}

function fixture(root,file,document){const target=join(root,file);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,glb(document));}

const document=(count,{vrm=false,compressed=false}={})=>({
  asset:{version:'2.0'},
  extensionsUsed:[...(vrm?['VRMC_vrm']:[]),...(compressed?['EXT_meshopt_compression']:[])],
  extensions:vrm?{VRMC_vrm:{specVersion:'1.0'}}:{},
  accessors:[{count}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],materials:[],textures:[],images:[],nodes:[],skins:[],animations:[],
});

test('inventory scans supplied tracked paths and builds deterministic priority queue',()=>{
  const root=mkdtempSync(join(tmpdir(),'soul-inventory-'));
  fixture(root,'assets/small.glb',document(300,{compressed:true}));
  fixture(root,'apps/rinne/public/simulator/assets/HERO_review.vrm',document(90000,{vrm:true}));
  const report=buildRepositoryAssetInventory(['assets/small.glb','apps/rinne/public/simulator/assets/HERO_review.vrm'],{root,limit:10,createdAt:'2026-09-15T00:00:00.000Z'});
  assert.equal(report.summary.assets,2);
  assert.equal(report.summary.reviewArtifacts,1);
  assert.equal(report.parseErrors.length,0);
  assert.equal(report.priority[0].file,'apps/rinne/public/simulator/assets/HERO_review.vrm');
  assert.equal(report.priority[0].priority.action,'locate-canonical-source');
});

test('inventory preserves parse failures separately instead of pretending they passed',()=>{
  const root=mkdtempSync(join(tmpdir(),'soul-inventory-error-'));
  const broken='assets/broken.glb';mkdirSync(dirname(join(root,broken)),{recursive:true});writeFileSync(join(root,broken),'broken');
  const result=inspectInventoryFiles([broken,'assets/missing.glb'],{root});
  assert.equal(result.rows.length,0);
  assert.equal(result.errors.length,2);
  assert.match(result.errors[0].error,/too small|magic/);
  const report=buildRepositoryAssetInventory([broken],{root,createdAt:'2026-09-15T00:00:00.000Z'});
  assert.equal(report.summary.assets,0);
  assert.equal(report.parseErrors.length,1);
});
