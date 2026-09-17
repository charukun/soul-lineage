import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const live=readFileSync(join(here,'../src/title-live-world.js'),'utf8');
const polish=readFileSync(join(here,'../src/native-ui-polish.js'),'utf8');
const css=readFileSync(join(here,'../src/title-rich.css'),'utf8');

test('title scene mirrors the prepared game canvas without exposing the gameplay DOM',()=>{
  assert.match(polish,/import '\.\/title-live-world\.js'/);
  assert.match(live,/document\.getElementById\('game'\)/);assert.match(live,/drawImage\(source/);assert.match(live,/title\.dataset\.liveWorld='ready'/);
  assert.doesNotMatch(css,/#game-screen\[hidden\][^{]*\{[^}]*display:block/s);
  assert.match(css,/\.title-live-canvas/);assert.match(css,/data-live-world="ready"/);
});

test('title remains animated and has an authored fallback',()=>{
  assert.match(live,/world\.style\.backgroundImage/);assert.match(css,/@keyframes title-live-camera/);assert.match(css,/title-world-motes/);assert.match(css,/title-world-clouds/);assert.match(css,/title-world-rays/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});

test('title menu is a game surface rather than transparent web links',()=>{
  assert.match(css,/\.title-actions\{[^}]*border:/s);assert.match(css,/\.title-actions\{[^}]*background:/s);assert.match(css,/\.title-command\[data-selected="true"\]/);
});
