import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyBytes,parseGlb,safeOutput} from '../scripts/prepare-review-assets.mjs';
import {REVIEW_DOWNLOADS,sourceUrl,classifyMotion} from '../packages/assets/src/review-catalog.js';
const bytes = Buffer.from('abc');
const gitBlob = createHash('sha1').update('blob 3\0').update(bytes).digest('hex');
test('pinned content rejects corruption, truncated files and Git LFS pointers',()=>{
  assert.equal(verifyBytes({id:'x',size:3,gitBlob},bytes).length,64);
  assert.throws(()=>verifyBytes({id:'x',size:4},bytes));
  assert.throws(()=>verifyBytes({id:'x',size:3,gitBlob},Buffer.from('abd')));
  assert.throws(()=>verifyBytes({id:'x'},Buffer.from('version https://git-lfs.github.com/spec/v1')));
});
test('all remote resources are immutable and output paths are constrained',()=>{
  assert.equal(new Set(REVIEW_DOWNLOADS.map(row=>row.output)).size,REVIEW_DOWNLOADS.length);
  for (const row of REVIEW_DOWNLOADS) {assert.match(sourceUrl(row),/\/[a-f0-9]{40}\//);safeOutput('/tmp/assets',row.output);}
  for(const path of ['../x','/x','a/../../x','a\\x','a//b']) assert.throws(()=>safeOutput('/tmp/assets',path));
  assert.throws(()=>sourceUrl({...REVIEW_DOWNLOADS[0],commit:'main'}));
});
test('GLB validates actual bytes and chunk boundaries',()=>{
  const json=Buffer.from('{"asset":{"version":"2.0"}} '), padding=(4-json.length%4)%4;
  const payload=Buffer.concat([json,Buffer.alloc(padding,32)]), file=Buffer.alloc(20+payload.length);
  file.writeUInt32LE(0x46546c67,0);file.writeUInt32LE(2,4);file.writeUInt32LE(file.length,8);file.writeUInt32LE(payload.length,12);file.writeUInt32LE(0x4e4f534a,16);payload.copy(file,20);
  assert.equal(parseGlb(file).asset.version,'2.0');assert.throws(()=>parseGlb(file.subarray(0,-1)));assert.throws(()=>parseGlb(Buffer.from('not glb')));
});
test('punches are not relabelled as sword attacks',()=>{
  assert.equal(classifyMotion('Punch_Jab'),'other');assert.equal(classifyMotion('Idle_Loop'),'idle');assert.equal(classifyMotion('Sword_Attack'),'sword');
});
