import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('birth-tour product shell preserves the user-facing presentation contract',async()=>{
  const [index,birthCss,quality]=await Promise.all([
    read('index.html'),
    read('src/rebuild/birth-tour.css'),
    read('docs/GAMEPLAY_QUALITY_BAR.md'),
  ]);

  // Keep the product contract strict without constraining how the browser smoke
  // happens to express its Playwright assertions.
  assert.match(birthCss,/data-birth-tour="true"\] \.objective-card\{display:none\}/);
  assert.match(quality,/出生期の説明を右上の目的地UIへ依存させず/);
  assert.match(quality,/旧来の単一「話す」ボタンは本編から持たない/);
  assert.doesNotMatch(index,/id="talk"/);
  for(const id of ['game','game-screen','dialogue','new-life'])assert.match(index,new RegExp(`id="${id}"`),id);
  assert.match(index,/class="title-copy"/);
  assert.match(index,/class="crest"/);
});
