import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../motion-library.html',import.meta.url),'utf8');
const notebook=readFileSync(new URL('../src/review/notebook.js',import.meta.url),'utf8');
const ux=readFileSync(new URL('../src/review/review-ux.js',import.meta.url),'utf8');

test('legacy Motion Library route returns to the unified Visual Review Lab',()=>{
  assert.match(html,/location\.replace\('\.\/'\)/);
  assert.doesNotMatch(html,/motion-library\.js|library-list|library-candidate/);
});

test('usable Lab motions are selected through the contextual searchable picker',()=>{
  assert.match(notebook,/const master = q\('#clip'\)/);
  assert.match(notebook,/id = 'picker-search'/);
  assert.match(notebook,/type = 'search'/);
  assert.match(notebook,/option\.dataset\.group/);
  assert.match(notebook,/pickerRows\(pickerSelect, pickerSearch\.value\)/);
  assert.match(notebook,/pickerCount\.textContent = `\$\{rows\.length\}件`/);
  assert.match(notebook,/select\.dispatchEvent\(new Event\('change'/);
});

test('Motion Library is no longer exposed as a separate top-level destination',()=>{
  assert.doesNotMatch(ux,/review-motion-link/);
  assert.doesNotMatch(ux,/Motion Libraryを開く/);
  assert.match(ux,/reference\.textContent='参考'/);
});
