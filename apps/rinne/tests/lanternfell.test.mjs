import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game, CLASSES, FURNITURE, validateSave } from '../public/lanternfell/game.mjs';
import { PortraitInput } from '../public/lanternfell/portrait-input.mjs';
import { hudTemplate, uiIcon } from '../public/lanternfell/portrait-ui.mjs';

const source = name => readFileSync(new URL(`../public/lanternfell/${name}`, import.meta.url), 'utf8');
const start = (options = {}) => { const game = new Game(); game.newGame(options); game.events = []; return game; };

test('Lanternfell DEV preview keeps six professions, progression and housing rules', () => {
  assert.equal(CLASSES.length, 6);
  const game = start({ classId: 'mender' });
  assert.equal(game.job.skills.length, 3);
  game.grant({ wood: 30, ore: 20, herb: 10, grain: 10 });
  game.setupScene('home');
  assert.ok(game.placeFurniture('table', 0, 0));
  assert.equal(game.placeFurniture('table', 0, 0), false);
  assert.ok(FURNITURE.table);
});

test('Lanternfell save validation remains defensive', () => {
  assert.throws(() => validateSave({ version: 99 }));
  const snapshot = start().snapshot();
  snapshot.gold = Infinity;
  snapshot.appearance.hair = 900;
  const fixed = validateSave(snapshot);
  assert.equal(fixed.gold, 45);
  assert.equal(fixed.appearance.hair, 3);
});

test('portrait input keeps movement and camera fingers independent', () => {
  let enabled = true; const captured = new Set(); const orbits = [];
  globalThis.window = new EventTarget();
  globalThis.document = { getElementById: () => null };
  const canvas = new EventTarget();
  Object.assign(canvas, {
    getBoundingClientRect: () => ({ left: 100, top: 0, width: 390, height: 844 }),
    setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id),
  });
  const input = new PortraitInput(canvas, { enabled: () => enabled, orbit: (x, y) => orbits.push([x, y]), tap: () => {} });
  const event = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, button: 0, preventDefault() {} });
  input.start(event(1, 140, 500)); input.start(event(2, 430, 400));
  input.update(event(1, 170, 500)); input.update(event(2, 410, 400));
  assert.ok(input.move.x > .5); assert.equal(orbits.length, 1);
  enabled = false; input.update(event(1, 180, 500));
  assert.equal(input.pointers.size, 0); input.destroy();
});

test('night portrait entry keeps sourced art and modern HUD', () => {
  assert.match(source('index.html'), /night\.css/);
  assert.match(source('index.html'), /灯渡りの庭/);
  assert.doesNotMatch(source('index.html'), /RPGUI|layout\.css|ui-refinements/);
  assert.match(source('night-view.mjs'), /UnrealBloomPass/);
  assert.doesNotMatch(source('night-view.mjs'), /(?:Box|Sphere|Cylinder|Cone|Torus|Plane)Geometry|CanvasTexture|createOscillator/);
  const game = start();
  const html = hudTemplate(game, value => value, (action, text, extra = '', cls = '') => `<button data-action="${action}" class="${cls}" ${extra}>${text}</button>`);
  assert.match(html, /game-menu[^>]+hidden/);
  assert.equal((html.match(/data-action="skill:/g) || []).length, 3);
  assert.match(uiIcon('sword'), /a79b2d131dab2bf20cb224bd0937b439a9c4fa99/);
});
