import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const brandUrl=new URL('../apps/village/src/brand-start.js',import.meta.url);
const contractUrl=new URL('../apps/village/src/web/dialog-exit-contract.css',import.meta.url);

test('village loads the blocking-dialog exit contract at boot',async()=>{
  const source=await readFile(brandUrl,'utf8');
  assert.match(source,/import ['"]\.\/web\/dialog-exit-contract\.css['"]/);
});

test('generic village dialog keeps content scrollable and close navigation reachable',async()=>{
  const css=await readFile(contractUrl,'utf8');
  assert.match(css,/#dialog\[open\]\s*\{[^}]*display:grid/s);
  assert.match(css,/#dialogContent\s*\{[^}]*overflow:auto/s);
  assert.match(css,/#dialog \.dialogNavigation\s*\{/s);
  assert.match(css,/#onlineDialog\[open\]\s*\{[^}]*display:grid/s);
  assert.match(css,/#onlineDialog>main\s*\{[^}]*overflow:auto/s);
  assert.match(css,/#recoverDialog\[open\]\s*\{[^}]*overflow:auto/s);
});
