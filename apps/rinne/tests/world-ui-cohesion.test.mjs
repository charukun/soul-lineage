import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/rinne-world-ui.css',import.meta.url),'utf8');

test('title-adjacent RINNE surfaces share one non-flat material language',()=>{
  const titleIndex=html.indexOf('./src/title-rich.css');
  const worldIndex=html.indexOf('./src/rinne-world-ui.css');
  assert.ok(titleIndex>=0&&worldIndex>titleIndex,'unified world UI must load after the approved title skin');
  for(const selector of ['.family-home-dialog','dialog.family-origin','.rinne-player-strip','.rinne-bottom-controls .upgrade-control','.rinne-quick-menu','.upgrade-panel','.game-screen[data-gameplay-upgrade] .objective-card']) assert.ok(css.includes(selector),selector);
  assert.ok(css.includes('clip-path:polygon'));
  assert.ok(css.includes('repeating-linear-gradient'));
  assert.ok(css.includes('box-shadow:'));
  assert.ok(!css.includes('.title-screen{')&&!css.includes('#title-screen{'),'approved title screen must not be restyled by the unification layer');
  assert.ok(css.includes('--rinne-world-gold')&&css.includes('--rinne-world-ivory'),'shared material tokens must drive title-adjacent surfaces');
});

test('family home, underwater ritual, and gameplay controls avoid flat rounded cards',()=>{
  assert.ok(css.includes('.family-home-current{'));
  assert.ok(css.includes('border-radius:0!important'));
  assert.ok(css.includes('.family-memory-stage::before'));
  assert.ok(css.includes('repeating-conic-gradient'));
  assert.ok(css.includes('.rinne-bottom-controls{'));
});
