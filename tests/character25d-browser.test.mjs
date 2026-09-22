// Run only when explicitly declared as heavy/specialist validation. This does
// not add a workflow, auto-selected test sweep, or routine build lifecycle.
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chromium} from '@playwright/test';
test('Character Forge exact-head specialist browser playtest and Review/RINNE builds',{timeout:540000},()=>{
  if(!existsSync(chromium.executablePath()))execFileSync('npx',['playwright','install','--with-deps','chromium'],{stdio:'inherit',timeout:150000});
  for(const app of ['review','rinne'])execFileSync('npm',['run','build','--workspace','@soul/'+app],{stdio:'inherit',timeout:150000});
  execFileSync(process.execPath,['scripts/browser/character25d-forge.mjs'],{stdio:'inherit',timeout:240000});
});
