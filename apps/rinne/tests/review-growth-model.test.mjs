import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('growth model review uses the existing life clock, KayKit model picker and fixed age probes', async () => {
  const [html, js, adapter, motionModels, css, ux, vite] = await Promise.all([
    read('growth-review.html'),
    read('src/review/growth-review.js'),
    read('src/review/kaykit-age-adapter.js'),
    read('src/review/motion-library-models.js'),
    read('src/review/growth-review.css'),
    read('src/review/review-ux.js'),
    read('vite.config.js'),
  ]);

  assert.match(html, /id="growth-model-trigger"/);
  assert.match(html, /id="growth-model-picker"/);
  assert.match(html, /id="growth-seek"[^>]*min="0"[^>]*max="5400"[^>]*value="1320"/);
  for (const age of [4, 12, 22, 50, 75]) assert.match(html, new RegExp(`data-age="${age}"`));
  for (const view of ['front', 'three', 'side', 'back', 'face']) assert.match(html, new RegExp(`data-growth-view="${view}"`));

  assert.match(js, /import \{ LIFE_RULES, appearanceForAge \} from '\.\.\/\.\.\/public\/simulator\/src\/life-clock\.js';/);
  assert.match(js, /createKayKitAgeAdapter/);
  assert.match(js, /MOTION_LIBRARY_MODELS/);
  assert.match(js, /motionLibraryModelURL/);
  assert.match(js, /const KAYKIT_GROWTH_MODELS = MOTION_LIBRARY_MODELS\.map/);
  assert.match(js, /kind: 'kaykit'/);
  assert.match(js, /KayKit CC0/);
  assert.match(js, /fetch\(model\.path, \{cache: 'force-cache'\}\)/);
  assert.match(js, /loader\.parseAsync\(bytes, `\$\{MOTION_LIBRARY_RAW_BASE\}\/`\)/);
  for (const id of ['SHINO', 'SHINO_SLENDER', 'SHINO_STURDY', 'SHINO_COMPACT', 'A', 'B', 'C', 'TSUKU']) assert.match(js, new RegExp(`id:'${id}'`));
  for (const file of ['Knight.glb','Barbarian.glb','Mage.glb','Rogue.glb','Rogue_Hooded.glb']) assert.match(motionModels, new RegExp(file.replace('.', '\\.')));

  assert.match(js, /params\.has\('age'\) \? Number\(params\.get\('age'\)\) : NaN/);
  assert.match(js, /22 \* LIFE_RULES\.secondsPerYear/);
  assert.match(js, /seconds \/ LIFE_RULES\.secondsPerYear/);
  assert.match(js, /current\.ageAdapter\.apply\(appearance, current\.model\.appearanceScale\)/);
  assert.match(js, /url\.searchParams\.set\('model', selectedModel\.id\)/);
  assert.match(adapter, /Rig_Medium aging bones missing/);
  assert.match(adapter, /bones\.head\.scale\.multiplyScalar\(appearance\.headScale\)/);
  assert.match(adapter, /appearance\.stoop \* \.62/);
  assert.match(adapter, /appearance\.gray \* \.88/);
  assert.match(adapter, /appearance\.skinAge/);
  assert.doesNotMatch(js + adapter, /visualApproval\s*=|productionStage\s*=/);

  assert.match(ux, /growth-review\.html/);
  assert.match(ux, /growth\.textContent='成長'/);
  assert.match(vite, /growthReview:\s*resolve\(appRoot, 'growth-review\.html'\)/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 420px/);
  assert.match(css, /growth-model-picker/);
  assert.match(css, /@media\(max-width:430px\)/);
});
