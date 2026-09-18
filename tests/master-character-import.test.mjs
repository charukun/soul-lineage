import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGLB, prepareMaster } from '../scripts/prepare-master-character.mjs';
test('malformed GLB and source reject before creating production output', async () => {
  assert.throws(() => parseGLB(Buffer.alloc(50)));
  const b=Buffer.alloc(20); b.writeUInt32LE(0x46546c67);b.writeUInt32LE(2,4);b.writeUInt32LE(20,8);b.writeUInt32LE(1000,12);assert.throws(()=>parseGLB(b));
  const dir=await mkdtemp(join(tmpdir(),'master-character-'));
  try { const source=join(dir,'bad.vrm');await writeFile(source,b);await assert.rejects(prepareMaster({source,out:join(dir,'out')}));assert.deepEqual(await readdir(dir),['bad.vrm']); }
  finally { await rm(dir,{recursive:true,force:true}); }
});
