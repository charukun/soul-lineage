import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const css=readFileSync(join(here,'../src/gameplay-upgrade.css'),'utf8');

test('play HUD uses tactile framed surfaces instead of flat or glass-card primitives',()=>{
  for(const selector of ['.rinne-player-strip','.rinne-bottom-controls','.upgrade-control','.upgrade-panel','.game-screen[data-gameplay-upgrade] .objective-card','.game-screen[data-gameplay-upgrade] .dialogue']){
    assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(css,/clip-path:polygon/);
  assert.match(css,/box-shadow:inset/);
  assert.match(css,/repeating-linear-gradient/);
  assert.match(css,/filter:drop-shadow/);
  assert.match(css,/\.upgrade-control::before/);
  assert.match(css,/\.upgrade-control::after/);
  assert.doesNotMatch(css,/backdrop-filter/,'play HUD must not fall back to glass-card styling');
  assert.doesNotMatch(css,/border-radius:999px|border-radius:20px|border-radius:18px|border-radius:16px|border-radius:15px|border-radius:14px/,'large rounded web-card primitives are forbidden in the play HUD');
  assert.doesNotMatch(css,/system-ui|-apple-system|Noto Sans JP|Yu Mincho|Hiragino Mincho|Georgia|Arial/,'Rinne UI typography must stay on the app-specific font variables');
});

test('play HUD preserves mobile and reduced-motion adaptations',()=>{
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/@media\(max-width:410px\)/);
  assert.match(css,/@media\(max-height:560px\) and \(orientation:landscape\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/env\(safe-area-inset-top\)/);
});
