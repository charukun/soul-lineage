import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [html, typography, hud, surfaces, v2, ui, loadout] = await Promise.all([
  read('../index.html'),
  read('../src/typography.css'),
  read('../src/reincarnation-hud.css'),
  read('../src/reincarnation-surfaces.css'),
  read('../src/reincarnation-interface-v2.css'),
  read('../src/gameplay-ui.js'),
  read('../src/heart-technique-body-ui.js'),
]);

test('latest Rinne interface layer loads after the first reforge layers', () => {
  const contract = html.indexOf('./src/gameplay-ui-contract.css');
  const records = html.indexOf('./src/gameplay-record-alignment.css');
  const hudLayer = html.indexOf('./src/reincarnation-hud.css');
  const surfaceLayer = html.indexOf('./src/reincarnation-surfaces.css');
  const v2Layer = html.indexOf('./src/reincarnation-interface-v2.css');
  assert.ok(contract >= 0 && records > contract && hudLayer > records && surfaceLayer > hudLayer && v2Layer > surfaceLayer);
});

test('persistent HUD has a readable player cluster and a dedicated top-right radar', () => {
  for (const selector of [
    '.game-screen[data-gameplay-upgrade] .hud-top',
    '.rinne-player-strip',
    '.player-identity',
    '.player-equipment',
    '.player-record-button',
    '.rinne-map-radar',
    '.radar-face',
    '.combat-phase-indicator',
    '.rinne-bottom-controls',
  ]) assert.ok(v2.includes(selector) || hud.includes(selector), `${selector} must be covered by the Rinne interface`);

  assert.match(ui, /data-heart/);
  assert.match(ui, /data-techniques/);
  assert.match(ui, /data-body/);
  assert.match(ui, /data-items/);
  assert.match(ui, /class="rinne-map-radar"/);
  assert.match(ui, /data-record/);
  assert.doesNotMatch(ui, /data-combat/);
  assert.doesNotMatch(ui, /data-debug/);
  assert.match(v2, /env\(safe-area-inset-top\)/);
  assert.match(v2, /env\(safe-area-inset-bottom\)/);
  assert.match(v2, /@media\(max-height:560px\) and \(orientation:landscape\)/);
  assert.match(v2, /@media\(prefers-reduced-motion:reduce\)/);
});

test('heart technique body and equipment share three slots over a five-column library', () => {
  assert.match(v2, /\.loadout-slot-row\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(v2, /\.loadout-grid\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(loadout, /HEART_SLOT_COUNT/);
  assert.match(loadout, /技 · 序破急/);
  assert.match(loadout, /体 · 身法/);
  assert.match(loadout, /得意技/);
  assert.match(loadout, /手動奥義/);
  assert.match(ui, /装 · 武具/);
  assert.match(ui, /className='loadout-slot-row'/);
  assert.match(ui, /className='loadout-grid-item'/);
});

test('rich map is more than anonymous points and preserves the shared guidance target', () => {
  assert.match(ui, /map-feature/);
  assert.match(ui, /map-compass/);
  assert.match(ui, /map-scale/);
  assert.match(ui, /map-legend/);
  assert.match(ui, /map-nearby-grid/);
  assert.match(ui, /guidance\?\.navigation/);
  assert.match(v2, /\.map-feature/);
  assert.match(v2, /\.map-nearby-grid/);
  assert.match(v2, /\.radar-target/);
});

test('new surfaces stay tactile and avoid glass or generic rounded cards', () => {
  assert.doesNotMatch(v2, /backdrop-filter/);
  assert.doesNotMatch(v2, /border-radius:\s*(?:14|15|16|18|20|24|999)px/);
  assert.match(v2, /clip-path:polygon/);
  assert.match(v2, /box-shadow:inset/);
  assert.match(surfaces, /max-height:min\(70dvh,640px\)/);
});

test('Rinne typography remains concept-specific', () => {
  assert.match(typography, /Kaisei\+Opti/);
  assert.match(typography, /Zen\+Kaku\+Gothic\+New/);
  assert.doesNotMatch(typography, /BIZ\+UDPGothic|BIZ UDPGothic|Zen\+Old\+Mincho|Zen Old Mincho/);
});
