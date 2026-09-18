import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [html, typography, hud, surfaces, ui] = await Promise.all([
  read('../index.html'),
  read('../src/typography.css'),
  read('../src/reincarnation-hud.css'),
  read('../src/reincarnation-surfaces.css'),
  read('../src/gameplay-ui.js'),
]);

test('reincarnation reforge layers are final gameplay presentation layers', () => {
  const contract = html.indexOf('./src/gameplay-ui-contract.css');
  const records = html.indexOf('./src/gameplay-record-alignment.css');
  const hudLayer = html.indexOf('./src/reincarnation-hud.css');
  const surfaceLayer = html.indexOf('./src/reincarnation-surfaces.css');
  assert.ok(contract >= 0 && records > contract && hudLayer > records && surfaceLayer > hudLayer);
});

test('persistent HUD covers life, guidance, combat phase and the four canonical plan entrances', () => {
  for (const selector of [
    '.game-screen[data-gameplay-upgrade] .hud-top',
    '.game-screen[data-gameplay-upgrade] .life-chip',
    '.game-screen[data-gameplay-upgrade] .bars',
    '.game-screen[data-gameplay-upgrade] .objective-card',
    '.combat-phase-indicator',
    '.rinne-bottom-controls',
    '.one-motion-control',
  ]) assert.ok(hud.includes(selector), `${selector} must be covered by the reforge`);

  assert.match(ui, /data-combat/);
  assert.match(ui, /data-items/);
  assert.match(ui, /data-map/);
  assert.match(ui, /data-record/);
  assert.doesNotMatch(ui, /data-debug/);
  assert.match(hud, /env\(safe-area-inset-top\)/);
  assert.match(hud, /env\(safe-area-inset-bottom\)/);
  assert.match(hud, /@media\(max-height:560px\) and \(orientation:landscape\)/);
  assert.match(hud, /@media\(prefers-reduced-motion:reduce\)/);
});

test('information surfaces cover every canonical plan and rebirth without glass UI', () => {
  for (const selector of [
    '.upgrade-panel',
    '.heart-list',
    '.combo-slot',
    '.body-option',
    '.inventory-list',
    '.upgrade-map',
    '.life-record-current',
    '.lineage-card',
    '.game-screen[data-gameplay-upgrade] .dialogue',
    '.game-screen[data-gameplay-upgrade] .toast',
    '.life-end-dialog',
    '.rebirth-contract',
  ]) assert.ok(surfaces.includes(selector), `${selector} must be covered by the information-surface reforge`);

  assert.doesNotMatch(hud, /backdrop-filter/);
  assert.doesNotMatch(surfaces, /backdrop-filter/);
  assert.doesNotMatch(hud, /border-radius:\s*(?:14|15|16|18|20|24|999)px/);
  assert.doesNotMatch(surfaces, /border-radius:\s*(?:14|15|16|18|20|24|999)px/);
  assert.match(surfaces, /max-height:min\(70dvh,640px\)/);
  assert.match(surfaces, /overflow:hidden!important/);
});

test('Rinne typography is concept-specific and retired fonts do not return', () => {
  assert.match(typography, /Kaisei\+Opti/);
  assert.match(typography, /Zen\+Kaku\+Gothic\+New/);
  assert.match(typography, /--font-rinne-display:\s*"Kaisei Opti"/);
  assert.match(typography, /--font-rinne-ui:\s*"Zen Kaku Gothic New"/);
  assert.doesNotMatch(typography, /BIZ\+UDPGothic|BIZ UDPGothic|Zen\+Old\+Mincho|Zen Old Mincho/);
});
