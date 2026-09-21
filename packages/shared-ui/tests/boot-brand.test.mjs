import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyBootBrand} from '../src/boot-brand.js';

test('shared boot brand helper is safe without a browser document',()=>{
  assert.equal(applyBootBrand({markUrl:'crest.svg',wordmark:'百年転生'}),false);
});

test('shared-ui exposes the boot brand adapter',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.exports['./boot-brand'],'./src/boot-brand.js');
});
