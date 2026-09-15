import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Visual Review Lab navigation stays task-oriented and motion selection is contextual', async()=>{
  const ux = await read('src/review/review-ux.js');
  const nav = await read('src/review/unified-review-nav.js');
  const css = await read('src/review/unified-review-nav.css');
  const notebook = await read('src/review/notebook.js');
  const legacy = await read('motion-library.html');
  assert.match(ux, /import '.\/unified-review-nav\.js';/);
  assert.match(nav, /\['model', 'モデル'\]/);
  assert.match(nav, /\['posture', '姿勢'\]/);
  assert.match(nav, /\['skill', '技構成'\]/);
  assert.match(nav, /\['performance', '演舞'\]/);
  assert.doesNotMatch(nav, /\['motion', 'モーション'\]/);
  assert.doesNotMatch(nav, /motion-library-stage|motion-library\.html\?embed=1/);
  assert.match(css, /grid-template-columns:repeat\(4/);
  assert.match(css, /review-controls-dock \.notebook-head\{display:none!important\}/);
  assert.match(notebook, /id = 'picker-search'/);
  assert.match(notebook, /placeholder = 'モーションを検索'/);
  assert.match(notebook, /option\.dataset\.group/);
  assert.match(notebook, /normalize\(`\$\{option\.textContent\} \$\{option\.value\} \$\{option\.dataset\.group/);
  assert.match(notebook, /STAGES\.includes\(select\.id\).*playValue\(option\.value\)/s);
  assert.match(legacy, /location\.replace\('\.\/'\)/);
  assert.doesNotMatch(ux, /review-motion-link|Motion Libraryを開く|>Motions</);
  assert.match(ux, /textContent='参考'/);
});
