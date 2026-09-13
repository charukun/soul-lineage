import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharedIconUrls,sharedIconProvenance} from '../src/index.js';

const root=new URL('../src/icons/lucide/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('./MANIFEST.json',root),'utf8'));

test('shared Lucide inventory is complete and pinned',()=>{
  assert.equal(manifest.repository,'lucide-icons/lucide');
  assert.equal(manifest.commit,'a79b2d131dab2bf20cb224bd0937b439a9c4fa99');
  assert.equal(sharedIconProvenance.commit,manifest.commit);
  assert.equal(manifest.files.length,17);
  assert.deepEqual(Object.keys(sharedIconUrls),manifest.files.map(name=>name.slice(0,-4)));
  for(const file of manifest.files){
    const svg=readFileSync(new URL(file,root),'utf8');
    assert.match(svg,/^<svg[\s>]/);
    assert.doesNotMatch(svg,/<script\b/i);
  }
  const license=readFileSync(new URL(manifest.licenseFile,root),'utf8');
  assert.match(license,/ISC License/);
  assert.match(license,/MIT License/);
});
