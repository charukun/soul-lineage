import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/mura-mobile-feedback-fix-3.js',import.meta.url),'utf8');

test('resident transparency repair yields until bootstrap module evaluation completes',()=>{
  assert.ok(source.includes('setTimeout(repair,0);setInterval(repair,900);'));
  assert.ok(!source.includes('repair();setInterval(repair,900);'));
});
