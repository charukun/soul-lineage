import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('browser playthrough follows the current birth-tour presentation',async()=>{
  const [playthrough,birthCss,quality]=await Promise.all([
    read('tests/rebuild-playthrough.browser.mjs'),
    read('src/rebuild/birth-tour.css'),
    read('docs/GAMEPLAY_QUALITY_BAR.md'),
  ]);
  assert.match(birthCss,/data-birth-tour="true"\] \.objective-card\{display:none\}/);
  assert.match(quality,/出生期の説明を右上の目的地UIへ依存させず/);
  assert.match(quality,/旧来の単一「話す」ボタンは本編から持たない/);
  assert.doesNotMatch(playthrough,/#objective'\)\.waitFor\(\{state:'visible'/);
  assert.match(playthrough,/\.objective-card'\)\.isHidden\(\)/);
  assert.match(playthrough,/#talk'\)\.count\(\),0/);
  assert.match(playthrough,/#dialogue'\)\.waitFor\(\{state:'visible'\}/);
});
