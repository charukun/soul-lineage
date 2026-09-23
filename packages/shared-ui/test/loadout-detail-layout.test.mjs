import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const css=readFileSync(join(here,'../src/rinne-loadout-menu.css'),'utf8');

test('shared loadout detail gives explanation full width and keeps actions above it',()=>{
  assert.match(css,/\.rinne-core-menu \.loadout-detail-copy>span\{[\s\S]*?grid-column:1\/-1;grid-row:3/);
  assert.match(css,/\.rinne-core-menu \.loadout-detail-action>button\{grid-column:3;grid-row:2/);
  assert.match(css,/data-layout="loadout"\] \.loadout-detail-copy>span\{[\s\S]*?grid-column:1\/-1;grid-row:3/);
  assert.match(css,/data-layout="loadout"\] \.loadout-detail-action>button\{[\s\S]*?grid-column:3;grid-row:2/);
  assert.match(css,/data-layout="loadout"\] \.loadout-detail\{[\s\S]*?min-height:142px/);
});
