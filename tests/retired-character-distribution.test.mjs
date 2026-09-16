import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, access, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {
  retiredCharacterDistributionPaths,
  stripRetiredCharacterAssets,
  assertNoRetiredCharacterAssets
} from '../scripts/strip-retired-character-assets.mjs';

test('retired conditional character assets are stripped from a Rinne distribution', async t => {
  const root=await mkdtemp(path.join(tmpdir(),'rinne-retired-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const sample=retiredCharacterDistributionPaths().slice(0,3);
  assert.ok(sample.length>0);
  for(const relative of sample){const file=path.join(root,relative);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,'retired');}
  const keep=path.join(root,'simulator/assets/kaykit/Knight.glb');
  await mkdir(path.dirname(keep),{recursive:true});await writeFile(keep,'cc0');
  const removed=await stripRetiredCharacterAssets(root);
  assert.deepEqual(removed.sort(),[...sample].sort());
  await assertNoRetiredCharacterAssets(root);
  await access(keep);
});
