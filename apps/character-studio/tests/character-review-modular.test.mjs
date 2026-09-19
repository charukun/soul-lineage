import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const main = read('../src/character-review-main.js'), workspace = read('../src/character-workspace.js');
test('studio connects all five slots to the production modular controller', () => {
  assert.match(main, /import '\.\/character-review\.js';/);
  assert.match(workspace, /@soul\/rendering\/master-character-modular/);
  for (const slot of ['face','hair','body','outfit','accessory']) assert.match(main, new RegExp(`${slot}:`));
  assert.match(main, /workspace.change\(slot, row.id\)/);
});
test('comparison does not regenerate or randomize edited appearances', () => {
  const handler = main.slice(main.indexOf("for (const b of document.querySelectorAll('[data-count]')" , main.indexOf('function init()')),main.indexOf("for (const b of document.querySelectorAll('[data-motion]')",main.indexOf('function init()')));
  assert.match(handler, /workspace.configure/); assert.doesNotMatch(handler, /randomize|autoVisible|regenerate/);
});
test('recycled actors use actual controller state and preserve per-record profiles', () => {
  assert.match(workspace, /JSON.stringify\(controller.profile\)/);
  assert.match(workspace, /profile\(actor.id\)/);
  assert.doesNotMatch(workspace, /WebSocket|RTCPeerConnection|indexedDB/);
});
