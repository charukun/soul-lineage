import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourcePath=new URL('../src/mura-background-bgm.js',import.meta.url);

test('background BGM consumes the first trusted gesture before async loading', async()=>{
  const source=await readFile(sourcePath,'utf8');
  const play=source.indexOf('async function play()');
  const context=source.indexOf('const ctx=ensureContext();',play);
  const resume=source.indexOf("if(ctx.state==='suspended')await ctx.resume();",context);
  const load=source.indexOf('const decoded=await load();',context);
  assert.ok(play>=0&&context>play,'play must synchronously create the audio context');
  assert.ok(resume>context&&resume<load,'resume must be requested before BGM fetch/decode');
  assert.match(source,/webAudioActivation\.subscribeUnlock\(\(\)=>play\(\)\)/);
  assert.doesNotMatch(source,/document\.addEventListener\('(pointerdown|keydown)'/);
});
