import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Visual Review Lab uses persistent bottom navigation and integrated Motion Library', async()=>{
  const ux = await read('src/review/review-ux.js');
  const nav = await read('src/review/unified-review-nav.js');
  const css = await read('src/review/unified-review-nav.css');
  const library = await read('motion-library.html');
  const actions = await read('src/review/motion-library-actions.js');
  assert.match(ux, /import '.\/unified-review-nav\.js';/);
  assert.match(nav, /\['model', 'モデル'\]/);
  assert.match(nav, /\['posture', '姿勢'\]/);
  assert.match(nav, /\['motion', 'モーション'\]/);
  assert.match(nav, /\['skill', '技構成'\]/);
  assert.match(nav, /\['performance', '演舞'\]/);
  assert.match(nav, /motion-library\.html\?embed=1/);
  assert.match(css, /grid-template-columns:repeat\(5/);
  assert.match(css, /review-controls-toggle\{display:none!important\}/);
  assert.match(library, /location\.replace\('\.\/\?tab=motion'\)/);
  assert.match(library, /motion-library-actions\.js/);
  assert.match(actions, /library-reject/);
  assert.match(actions, /見送り/);
  assert.match(actions, /queueMicrotask\(advance\)/);
});
