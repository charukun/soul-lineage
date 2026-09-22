// Explicit specialist scenario selected by the final commit, never routine CI.
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chromium} from '@playwright/test';
test('Character Forge shipped GLB and reference comparisons in existing Character View',{timeout:420000},()=>{
  if(!existsSync(chromium.executablePath()))execFileSync('npx',['playwright','install','--with-deps','chromium'],{stdio:'inherit',timeout:150000});
  execFileSync('npm',['run','build','--workspace','@soul/character-studio'],{stdio:'inherit',timeout:120000});
  execFileSync(process.execPath,['scripts/character-forge/browser.mjs'],{stdio:'inherit',timeout:120000});
});
