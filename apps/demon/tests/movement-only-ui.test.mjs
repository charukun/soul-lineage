import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('hunt shell exposes movement combat readout and the system pause escape hatch',()=>{
  const index=read('../index.html');
  for(const id of ['game','hud','pause','skill-name'])assert.match(index,new RegExp(`id="${id}"`),id);
  assert.match(index,/class="phases"/);
  for(const phase of ['jo','ha','kyu'])assert.match(index,new RegExp(`data-phase="${phase}"`),phase);
});

test('movement-only input contract keeps utility actions automatic',()=>{
  const contract=read('../docs/PLAY_INPUT_CONTRACT.md');
  assert.match(contract,/能動操作は \*\*移動だけ\*\*/);
  assert.match(contract,/例外はポーズ \/ システムメニュー/);
  assert.match(contract,/嗅覚: 狩場へ入った時と必要な再探索時に自動/);
  assert.match(contract,/帰路: 捕食後は最寄りの帰還口を自動案内/);
  assert.match(contract,/序・破・急の現在phaseと現在行動名/);
});
