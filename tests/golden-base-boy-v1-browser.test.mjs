import test from 'node:test';
import {execFileSync} from 'node:child_process';

test('Golden Base Boy v1 is a discoverable Forge review candidate',{timeout:480000},()=>{
  execFileSync(process.execPath,['--test','tests/character-create-forge-browser.test.mjs'],{
    stdio:'inherit',
    timeout:450000,
    env:{...process.env,CHARACTER_FORGE_ID:'golden-base-boy-v1'}
  });
});
