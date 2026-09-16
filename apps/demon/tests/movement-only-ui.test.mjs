import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('hunt loads the movement-only presentation layer',()=>{
  const index=read('../index.html');
  assert.match(index,/movement-only\.css/);
  assert.match(index,/movement-only-play\.js/);
});

test('normal hunt chrome hides utility controls and persistent tutorial prose',()=>{
  const css=read('../src/web/movement-only.css');
  for(const selector of ['#scent','#memory','#dash-stop','#first-hunt-guide','#swipe-hint','.footer-status','.location']){
    assert.ok(css.includes(selector),selector);
  }
  assert.match(css,/#hud #return\{[\s\S]*pointer-events:none!important/);
  assert.match(css,/#hud #return\.locked\{visibility:hidden\}/);
  assert.ok(!css.includes('#hud #pause{display:none'));
});

test('combat keeps the existing phase and current-action readout',()=>{
  const index=read('../index.html');
  const css=read('../src/web/movement-only.css');
  const base=read('../src/web/style.css');
  assert.match(index,/class="phases"/);
  for(const phase of ['data-phase="jo"','data-phase="ha"','data-phase="kyu"'])assert.ok(index.includes(phase),phase);
  assert.match(index,/id="skill-name"/);
  assert.match(base,/\.phases/);
  assert.match(base,/#skill-name/);
  assert.ok(!css.includes('#hud #battle .phases,'));
  assert.ok(!css.includes('#hud #skill-name{display:none'));
});

test('utility actions are automatic and low-frequency information moves into pause',()=>{
  const js=read('../src/web/movement-only-play.js');
  assert.match(js,/SENSE_REFRESH_MS=16_250/);
  assert.match(js,/scent\.click\(\)/);
  assert.match(js,/returnButton\.click\(\)/);
  assert.match(js,/snap\.eaten>0&&!returnActivated/);
  assert.match(js,/id='movement-help'/);
  assert.match(js,/id='movement-lineage'/);
  assert.match(js,/title-memory/);
  assert.match(js,/輪の中で指を離す/);
});

test('the app contract fixes normal gameplay input to movement plus system pause',()=>{
  const contract=read('../docs/PLAY_INPUT_CONTRACT.md');
  assert.match(contract,/能動操作は \*\*移動だけ\*\*/);
  assert.match(contract,/例外はポーズ \/ システムメニュー/);
  assert.match(contract,/嗅覚: 狩場へ入った時と必要な再探索時に自動/);
  assert.match(contract,/帰路: 捕食後は最寄りの帰還口を自動案内/);
  assert.match(contract,/序・破・急の現在phaseと現在行動名/);
});
