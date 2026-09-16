import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const appRoot=join(here,'..');
const html=readFileSync(join(appRoot,'index.html'),'utf8');
const main=readFileSync(join(appRoot,'src/main.js'),'utf8');
const audio=readFileSync(join(appRoot,'src/gameplay-audio.js'),'utf8');
const rich=readFileSync(join(appRoot,'src/title-rich.css'),'utf8');

test('title menu keeps only the requested primary routes',()=>{
  assert.match(html,/id="new-life"[^>]*>最初から<\/button>/);
  assert.match(html,/id="continue-life"[^>]*>続きから<\/button>/);
  assert.match(html,/id="open-village-code"[^>]*>村コード<\/button>/);
  assert.match(html,/id="open-settings"[^>]*>設定<\/button>/);
  assert.doesNotMatch(html,/KayKitで遊ぶ|id="kaykit-life"/);
  assert.doesNotMatch(html,/id="open-village"[^>]*class="title-command"/);
  assert.doesNotMatch(html,/旅の記録|continue-detail|replace-life-dialog/);
  assert.doesNotMatch(main,/KAYKIT_GAME_AXIS|\$\('open-village'\)/);
});

test('title input unlocks persistent game audio and provides selection and confirm feedback',()=>{
  assert.match(main,/unlockRinneAudio/);
  assert.match(main,/selectRinneAudio/);
  assert.match(main,/confirmRinneAudio/);
  assert.match(audio,/export const unlockRinneAudio/);
  assert.match(audio,/function select\(\)/);
  assert.match(audio,/function confirm\(\)/);
  assert.match(audio,/music\.play\(\)/);
});

test('title background uses layered motion with a reduced-motion escape hatch',()=>{
  for(const name of ['title-world-rays','title-world-clouds-back','title-world-clouds-front','title-world-motes','title-world-lens'])assert.match(html,new RegExp(name));
  assert.match(rich,/@keyframes title-rich-camera/);
  assert.match(rich,/@keyframes title-rich-clouds-back/);
  assert.match(rich,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(rich,/\[data-motion="off"\]/);
});
