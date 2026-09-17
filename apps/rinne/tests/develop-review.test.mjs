import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(appRoot,path),'utf8');

test('Visual Review reads canonical develop sources and shared character/assets contracts',async()=>{
  const js=await read('src/develop-review.js');
  assert.match(js,/from '@soul\/game-data'/);
  assert.match(js,/INSPIRATION_WEAPON_ARTS/);
  assert.match(js,/INSPIRATION_MOTION_IDS/);
  assert.match(js,/from '@soul\/characters'/);
  assert.match(js,/KAYKIT_FAMILY_ID/);
  assert.match(js,/KAYKIT_RIG_ID/);
  assert.match(js,/from '@soul\/assets'/);
  assert.match(js,/publicWebAssetCatalog/);
  assert.match(js,/from '@soul\/network\/raid-host'/);
  assert.match(js,/new RaidHost/);
  assert.doesNotMatch(js,/work\/visual-review-lab-v2/);
});

test('Visual Review exposes the actual review workflow instead of internal page names',async()=>{
  const html=await read('review.html');
  for(const panel of ['overview','characters','motion','assets','effects','battle'])assert.match(html,new RegExp(`data-panel="${panel}"`));
  for(const app of ['rinne','village','demon'])assert.match(html,new RegExp(`data-app-context="${app}"`));
  assert.match(html,/\.\/characters\.html\?review=motion/);
  assert.match(html,/\.\/characters\.html/);
  assert.match(html,/\.\/review-assets\.html/);
  assert.match(html,/\.\/review-effects\.html/);
});

test('authored effect review reuses the runtime effect player and backend',async()=>{
  const js=await read('src/review-effects.js');
  assert.match(js,/createAuthoredEffectPlayer/);
  assert.match(js,/createEffekseerBackend/);
  assert.match(js,/authoredEffectBase/);
  assert.match(js,/combatEffectBudget/);
  assert.match(js,/type:'player-hit'/);
  assert.match(js,/type:'enemy-hit'/);
  assert.match(js,/type:'one-motion'/);
  assert.doesNotMatch(js,/damage\s*[-+*/]?=/);
});

test('RINNE build includes the review and authored effect entries',async()=>{
  const vite=await read('vite.config.js');
  assert.match(vite,/review:fileURLToPath\(new URL\('\.\/review\.html'/);
  assert.match(vite,/reviewEffects:fileURLToPath\(new URL\('\.\/review-effects\.html'/);
});
