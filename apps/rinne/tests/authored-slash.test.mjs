import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {RETIRED_CONDITIONAL_CHARACTER_IDS} from '@soul/characters';
import {SLASH_SECONDS,SLASH_TIMING,SWORD_FREE_GUARD,sampleSlashPose,slashTime} from '../public/simulator/src/authored-slash.js';

const retiredShinoAsset=new URL('../public/simulator/assets/SHINO_review.vrm',import.meta.url);
async function assertRetiredShinoUnavailable(){
  assert.ok(RETIRED_CONDITIONAL_CHARACTER_IDS.includes('character.sendagaya-shino.v1'));
  await assert.rejects(access(retiredShinoAsset),error=>error?.code==='ENOENT');
}

test('slash preserves the existing combat clock and has continuous pose endpoints',async()=>{
  const game=await readFile(new URL('../public/simulator/index.html',import.meta.url),'utf8');
  const timing=game.match(/slash:\{active:\[([^\]]+)\],contact:([\d.]+),launch:([\d.]+),plant:([\d.]+),chain:([\d.]+),lead:([\d.]+)/);
  assert.ok(timing,'game slash timing definition must be found');
  assert.deepEqual(timing[1].split(',').map(Number),SLASH_TIMING.active);
  for(const [i,key]of ['contact','launch','plant','chain','lead'].entries())assert.equal(Number(timing[i+2]),SLASH_TIMING[key]);
  assert.equal(Number(game.match(/const STRIKES=\{slash:\{[^}]*duration:([\d.]+)/)?.[1]),SLASH_SECONDS);
  assert.equal(SLASH_SECONDS,.66);
  assert.deepEqual(SLASH_TIMING,{active:[.35,.64],contact:.5,launch:.34,plant:.49,chain:.86,lead:1});
  const start=sampleSlashPose(0),end=sampleSlashPose(1);
  assert.deepEqual(start,end);
  assert.deepEqual(start.grip,[-.19,-.37,.35],'weapon hand must meet the normal sword guard at the slash seam');
  assert.deepEqual(start.shield,[...SWORD_FREE_GUARD],'free hand must meet the relaxed sword guard at the slash seam');
  for(const contact of [.3,.5,.7])assert.equal(slashTime(contact,contact),.5);
  for(let i=0;i<=1000;i++)for(const value of Object.values(sampleSlashPose(i/1000)))assert.ok(value.every(Number.isFinite));
});

test('retired Shino static-guard fixture cannot be materialized as an active runtime asset',async()=>{
  await assertRetiredShinoUnavailable();
  const guard=sampleSlashPose(0);
  assert.deepEqual(guard.grip,[-.19,-.37,.35]);
  assert.deepEqual(guard.shield,[...SWORD_FREE_GUARD]);
});

test('retired Shino slash fixture stays absent while the authored slash remains finite and loop-safe',async()=>{
  await assertRetiredShinoUnavailable();
  const frames=Array.from({length:121},(_,i)=>sampleSlashPose(i/120));
  for(const frame of frames)for(const value of Object.values(frame))assert.ok(value.every(Number.isFinite));
  assert.deepEqual(frames[0],frames.at(-1));
  assert.ok(slashTime(.5,.5)>=SLASH_TIMING.active[0]);
  assert.ok(slashTime(.5,.5)<=SLASH_TIMING.active[1]);
});
