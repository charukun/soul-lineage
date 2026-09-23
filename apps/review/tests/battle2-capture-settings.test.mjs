import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const html=readFileSync(join(here,'../battle2.html'),'utf8');
const source=readFileSync(join(here,'../src/nocturne-stage.js'),'utf8');
const css=readFileSync(join(here,'../src/battle2.css'),'utf8');

test('battle settings expose persistent HUD hiding and gameplay recording',()=>{
  assert.match(html,/data-battle-hud-control/);
  assert.match(html,/data-battle-hud="hide"/);
  assert.match(html,/data-battle-record-toggle/);
  assert.match(source,/hudHidden:Boolean\(value\?\.hudHidden\)/);
  assert.match(source,/stage\.dataset\.hudHidden/);
  assert.match(source,/new MediaRecorder\(/);
  assert.match(source,/captureStream\(30\)/);
  assert.match(source,/drawImage\(world/);
  assert.match(source,/drawImage\(effects/);
  assert.match(source,/johakyu-battle-\$\{stamp\}\.webm/);
  assert.match(css,/data-hud-hidden="true"/);
  assert.match(css,/data-recording="true"/);
});

test('settings gear remains outside the hidden HUD selectors so HUD can be restored',()=>{
  const hiddenRule=css.match(/\.nocturne-stage\[data-hud-hidden="true"\][\s\S]*?\{visibility:hidden!important;opacity:0!important;pointer-events:none!important\}/)?.[0]||'';
  assert.ok(hiddenRule);
  assert.doesNotMatch(hiddenRule,/review-stage-controls/);
});
