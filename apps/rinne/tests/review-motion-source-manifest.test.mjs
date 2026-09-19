import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MOTION_LIBRARY_SOURCES} from '../src/review-motion-sources.js';

const REQUIRED={
  'kaykit-rig-medium':['hips','spine','chest','head','upperarm.l','lowerarm.l','hand.l','upperleg.l','lowerleg.l','foot.l','upperarm.r','lowerarm.r','hand.r','upperleg.r','lowerleg.r','foot.r'],
  'quaternius-standard':['pelvis','spine_01','spine_02','spine_03','Head','upperarm_l','lowerarm_l','hand_l','thigh_l','calf_l','foot_l','upperarm_r','lowerarm_r','hand_r','thigh_r','calf_r','foot_r']
};
const gitBlobSha=bytes=>createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

function glbJson(bytes){
  assert.equal(bytes.readUInt32LE(0),0x46546c67,'GLB magic');
  assert.equal(bytes.readUInt32LE(4),2,'GLB version');
  assert.equal(bytes.readUInt32LE(8),bytes.byteLength,'GLB declared size');
  let offset=12;
  while(offset+8<=bytes.length){
    const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),start=offset+8,end=start+length;
    assert.ok(end<=bytes.length,'GLB chunk must fit');
    if(type===0x4e4f534a)return JSON.parse(bytes.subarray(start,end).toString('utf8').replace(/\0+$/,'').trim());
    offset=end;
  }
  throw new Error('GLB JSON chunk not found');
}

async function fetchPinned(source){
  assert.match(source.runtimeUrl,/^https:\/\/raw\.githubusercontent\.com\//);
  assert.ok(source.runtimeUrl.includes(source.revision));
  const response=await fetch(source.runtimeUrl,{signal:AbortSignal.timeout(90000)});
  assert.equal(response.status,200,`${source.id} must be downloadable at its pinned revision`);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.byteLength,source.byteLength,`${source.id} byte length`);
  assert.equal(gitBlobSha(bytes),source.gitBlobSha,`${source.id} Git blob SHA`);
  if(source.sha256)assert.equal(sha256(bytes),source.sha256,`${source.id} SHA256`);
  return bytes;
}

for(const source of MOTION_LIBRARY_SOURCES){
  test(`pinned motion source ${source.id} matches declared clips and rig`,{timeout:120000},async()=>{
    const bytes=await fetchPinned(source),document=glbJson(bytes),animations=document.animations||[],nodes=new Set((document.nodes||[]).map(row=>row.name).filter(Boolean));
    assert.equal(animations.length,source.clips.length,`${source.id} clip count`);
    source.clips.forEach((clip,index)=>{
      assert.equal(clip.index,index,`${source.id} contiguous clip index ${index}`);
      assert.equal(animations[index]?.name,clip.name,`${source.id} clip name ${index}`);
    });
    for(const bone of REQUIRED[source.rig]||[])assert.ok(nodes.has(bone),`${source.id} required rig bone ${bone}`);
    assert.ok(source.license&&source.author&&source.licenseEvidence);
  });
}
