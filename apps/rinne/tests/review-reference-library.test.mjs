import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../public/references.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../public/references.js',import.meta.url),'utf8');
const ux=readFileSync(new URL('../src/review/review-ux.js',import.meta.url),'utf8');

test('Visual Review Lab exposes a character reference library entry point',()=>{
  assert.match(ux,/href='\.\/references\.html'/);
  assert.match(ux,/リファレンス/);
  assert.match(html,/キャラクターリファレンス/);
  assert.match(html,/\.\/references\.js/);
});

test('reference library follows develop and hides the retired observation-sheet id',()=>{
  assert.match(script,/docs\/characters\/references/);
  assert.match(script,/\?ref=develop/);
  assert.match(script,/EXCLUDED=new Set\(\['video-character-001'\]\)/);
  assert.match(script,/kirishiro-shizuha/);
});
