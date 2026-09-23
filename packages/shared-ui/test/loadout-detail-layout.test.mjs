import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const css=readFileSync(join(here,'../src/rinne-loadout-menu.css'),'utf8');
const source=readFileSync(join(here,'../src/rinne-loadout-menu.js'),'utf8');

test('shared loadout detail prioritizes readable explanation and top-right actions',()=>{
  assert.match(css,/-webkit-line-clamp:2/);
  assert.match(css,/loadout-grid-item\[data-active="true"\]::after/);
  assert.match(css,/data-type="technique"\] \.loadout-grid-item\[data-focus="true"\][\s\S]*?#b9904d/);
  assert.match(css,/\.rinne-core-menu \.loadout-detail-action>button\{grid-column:3;grid-row:1/);
  assert.match(css,/data-layout="loadout"\] \.loadout-detail-copy>span\{[\s\S]*?grid-column:1\/-1;grid-row:3[\s\S]*?white-space:pre-line/);
  assert.match(css,/data-layout="loadout"\] \.loadout-detail-action>button\{[\s\S]*?grid-column:3;grid-row:1/);
  assert.match(css,/data-layout="loadout"\] \.loadout-detail\{[\s\S]*?min-height:154px/);
  assert.match(source,/configured=Boolean\(actionDisabled&&actionLabel==='設定済み'\)/);
  assert.match(source,/action\.hidden=!actionLabel\|\|configured/);
});


test('shared non-pentagon slots read as explicit equipment sockets',()=>{
  assert.match(css,/loadout-slot-row:not\(\[data-layout="pentagon"\]\)>\.loadout-slot::before\{[\s\S]*?content:"装着枠"/);
  assert.match(css,/loadout-slot-row:not\(\[data-layout="pentagon"\]\)>\.loadout-slot::after\{[\s\S]*?inset:5px/);
  assert.match(css,/loadout-slot\[data-selected="true"\]::before\{[\s\S]*?content:"選択中"/);
  assert.match(css,/data-layout="loadout"\] \.rinne-core-menu-body>\.loadout-slot-row \.loadout-slot\{[\s\S]*?height:56px/);
});
