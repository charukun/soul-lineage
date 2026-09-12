import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const main = read('../src/character-review-main.js');
const modular = read('../src/character-review-modular.js');
const css = read('../src/character-review-modular.css');

test('main review loads the modular appearance review without changing the base renderer entry', () => {
  assert.match(main, /import '\.\/character-review\.js';/);
  assert.match(main, /import '\.\/character-review-modular\.js';/);
  assert.match(modular, /@soul\/characters/);
  assert.match(modular, /@soul\/rendering\/master-character-modular/);
});

test('modular review exposes all five visual slots and crowd compare controls', () => {
  for (const slot of ['face', 'hair', 'body', 'outfit', 'accessory']) assert.match(modular, new RegExp(`${slot}:`));
  assert.match(modular, /表示中の全員を別人化/);
  assert.match(modular, /12体比較/);
  assert.match(modular, /30体比較/);
  assert.match(modular, /選択個体をShinoへ戻す/);
});

test('mobile modular controls remain compact and use the existing independently scrolling control pane', () => {
  assert.match(css, /modular-options/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.doesNotMatch(modular, /localStorage|sessionStorage|indexedDB|WebSocket|RTCPeerConnection/);
});
