// Explicit specialist gate; never selected by routine Fast DEV.
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chromium} from '@playwright/test';
test('exact-head equipment playtest in the Playground and real RINNE',{timeout:510000},()=>{
  if(!existsSync(chromium.executablePath()))execFileSync('npx',['playwright','install','--with-deps','chromium'],{stdio:'inherit',timeout:150000});
  execFileSync('npm',['run','predev','--workspace','@soul/rinne'],{stdio:'inherit',timeout:90000});
  execFileSync(process.execPath,['scripts/browser/character25d-equipment.mjs'],{stdio:'inherit',timeout:240000});
});
