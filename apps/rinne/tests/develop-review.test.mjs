import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(appRoot,path),'utf8');

test('Visual Review reads canonical develop sources instead of a Lab-owned catalog',async()=>{
  const js=await read('src/develop-review.js');
  assert.match(js,/from '@soul\/game-data'/);
  assert.match(js,/INSPIRATION_WEAPON_ARTS/);
  assert.match(js,/INSPIRATION_MOTION_IDS/);
  assert.match(js,/from '@soul\/network\/raid-host'/);
  assert.match(js,/new RaidHost/);
  assert.doesNotMatch(js,/work\/visual-review-lab-v2/);
});

test('Visual Review reuses current develop character and motion review pages',async()=>{
  const html=await read('review.html');
  assert.match(html,/\.\/characters\.html\?review=motion/);
  assert.match(html,/\.\/characters\.html/);
  assert.match(html,/data-panel="inspiration"/);
  assert.match(html,/data-panel="battle"/);
});

test('RINNE build includes the review entry',async()=>{
  const vite=await read('vite.config.js');
  assert.match(vite,/review:fileURLToPath\(new URL\('\.\/review\.html'/);
});
