import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {visualAssetRegistry,visualAssetById} from '../src/index.js';
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');

test('single production visual registry requires authored materialized licensed provenance',()=>{
 for(const asset of Object.values(visualAssetRegistry)){
  assert.equal(visualAssetById(asset.id),asset);assert.equal(asset.status,'MATERIALIZED');
  assert.ok(['artist-authored','rinne-owned-dcc'].includes(asset.origin)||(asset.id==='mura.housing-legacy-procedural.v1'&&asset.origin==='legacy-procedural'&&asset.legacy===true),asset.id);
  assert.ok(asset.license&&asset.localPath&&asset.source.revision&&asset.source.path&&asset.source.hash,asset.id);
 }
});
test('Village yurt is exact pinned authored Collada, not a generated reconstruction',()=>{
 const asset=visualAssetById('village.yurt.authored-royal-xion.v3'),bytes=readFileSync(asset.localPath),license=readFileSync(asset.licensePath,'utf8');
 assert.equal(asset.origin,'artist-authored');assert.equal(asset.source.hash,`git-blob:${gitBlobSha(bytes)}`);
 assert.equal(asset.runtime.format,'compiled-collada');assert.equal(asset.meshData.sourceTriangles,2824);assert.ok(asset.meshData.sourcePositionVertices>1800);
 assert.match(asset.source.path,/xion_royal_yurt\.dae$/);assert.match(bytes.toString('utf8'),/<authoring_tool>Blender 2\.78\.0/);assert.match(license,/creativecommons\.org\/licenses\/by-sa\/3\.0/);
 const p=asset.meshData.positions,ys=[];for(let i=1;i<p.length;i+=3)ys.push(p[i]);const minY=Math.min(...ys),maxY=Math.max(...ys),h=maxY-minY,low=[],high=[];
 for(let i=0;i<p.length;i+=3){const t=(p[i+1]-minY)/h,r=Math.hypot(p[i],p[i+2]);if(t>.12&&t<.50)low.push(r);if(t>.68&&t<.96)high.push(r);}
 const mean=a=>a.reduce((n,v)=>n+v,0)/a.length;assert.ok(mean(high)<mean(low)*.62,`royal yurt roof must taper: low=${mean(low)} high=${mean(high)}`);
});
