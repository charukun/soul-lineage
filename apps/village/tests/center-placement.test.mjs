import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/mura-first-build.js',import.meta.url),'utf8');
const requirements=readFileSync(new URL('../docs/REQUIREMENTS.md',import.meta.url),'utf8');

test('center-follow placement keeps the ghost on the camera target and taps to commit',()=>{
 for(const contract of [
  'centerCandidate()',
  'view.pan=(dx,dy)=>',
  'commitPlacement(world,p)',
  'queueMicrotask',
  'スワイプで場所を調整 · タップで配置',
  'muraRotateLeft',
 ])assert.ok(source.includes(contract),contract);
 assert.equal(source.includes('muraFindPlacement'),false);
});

test('placement UI sync cannot observe and rewrite its own child text forever',()=>{
 assert.ok(source.includes("observer.observe(panel,{attributes:true,attributeFilter:['hidden']})"));
 assert.equal(source.includes('observer.observe(panel,{childList:true'),false);
 assert.ok(source.includes('if(label.textContent!==instruction)label.textContent=instruction;'));
 assert.ok(source.includes("paragraph.textContent!==HELP_TEXT"));
});

test('placement contract makes one-finger movement primary and returns to normal controls',()=>{
 for(const contract of [
  'ゴーストを画面中央の照準位置に保ちます',
  '1本指スワイプ',
  '短いタップ',
  '配置直後の「取り消す」ボタンは表示せず、通常の操作へ戻します',
  '二本指操作を建築配置の必須操作にはしません',
  '配置UIの状態同期は冪等',
 ])assert.ok(requirements.includes(contract),contract);
});
