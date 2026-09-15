import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('growth model review uses the existing life clock and fixed age probes', async () => {
  const [html, js, css, ux, vite] = await Promise.all([
    read('growth-review.html'),
    read('src/review/growth-review.js'),
    read('src/review/growth-review.css'),
    read('src/review/review-ux.js'),
    read('vite.config.js'),
  ]);

  assert.match(html, /id="growth-seek"[^>]*min="0"[^>]*max="5400"[^>]*value="1320"/);
  for (const age of [4, 12, 22, 50, 75]) assert.match(html, new RegExp(`data-age="${age}"`));
  for (const view of ['front', 'three', 'side', 'back', 'face']) assert.match(html, new RegExp(`data-growth-view="${view}"`));

  assert.match(js, /import \{ LIFE_RULES, appearanceForAge \} from '\.\.\/\.\.\/public\/simulator\/src\/life-clock\.js';/);
  assert.match(js, /SHINO_REVIEW/);
  assert.match(js, /seconds \/ LIFE_RULES\.secondsPerYear/);
  assert.match(js, /root\.scale\.copy\(base\.rootScale\)\.multiplyScalar\(appearance\.scale\)/);
  assert.match(js, /bones\.head\.scale\.copy\(base\.headScale\)\.multiplyScalar\(appearance\.headScale\)/);
  assert.match(js, /appearance\.gray/);
  assert.match(js, /appearance\.stoop/);
  assert.match(js, /appearance\.skinAge/);
  assert.doesNotMatch(js, /visualApproval\s*=|productionStage\s*=/);

  assert.match(ux, /growth-review\.html/);
  assert.match(ux, /textContent='成長'/);
  assert.match(vite, /growthReview:\s*resolve\(appRoot, 'growth-review\.html'\)/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 420px/);
  assert.match(css, /@media\(max-width:430px\)/);
});
