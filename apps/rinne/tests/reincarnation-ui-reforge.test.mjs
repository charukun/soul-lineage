import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const [html, typography, hud, surfaces, v2, navy, ui, loadout] = await Promise.all([
  read('../index.html'),
  read('../src/typography.css'),
  read('../src/reincarnation-hud.css'),
  read('../src/reincarnation-surfaces.css'),
  read('../src/reincarnation-interface-v2.css'),
  read('../src/dark-navy-hud.css'),
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
  assert.doesNotMatch(html, /dark-navy-hud\.css/,'final HUD skin must not be preloaded before runtime UI styles');
  assert.match(ui, /import '\.\/dark-navy-hud\.css';/,'final HUD skin must load last from gameplay-ui');
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
  assert.match(ui, /data-vitals/);
  assert.match(ui, /data-mind/);
  assert.match(ui, /setContextAnchor/);
  assert.match(navy, /\.rinne-context-vitals\{/);
  assert.match(navy, /\.rinne-mind-balance\{/);
  assert.match(navy, /\.game-screen\[data-gameplay-upgrade\] \.bars,[\s\S]*display:none!important/);
  assert.match(navy, /\.rinne-gameplay-upgrade \.upgrade-panel>header>\[data-close\][\s\S]*display:grid!important/);
  assert.doesNotMatch(ui, /data-(?:attack|combat-button|combat-control)/);
  assert.doesNotMatch(ui, /data-debug/);
  assert.match(v2, /env\(safe-area-inset-top\)/);
  assert.match(v2, /env\(safe-area-inset-bottom\)/);
  assert.match(v2, /@media\(max-height:560px\) and \(orientation:landscape\)/);
  assert.match(v2, /@media\(prefers-reduced-motion:reduce\)/);
});

test('technique body and equipment keep three-slot editing while heart stays a learned list', () => {
  assert.match(v2, /\.loadout-slot-row\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(v2, /\.loadout-grid\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(loadout, /HEART_SLOT_COUNT|setHeartSlot|heartSlot/);
  assert.match(loadout, /heart-learned-list/);
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

test('final gameplay skin is tactile, non-flat, and keeps phone sheets reachable', () => {
  assert.doesNotMatch(navy, /backdrop-filter:(?!none)/);
  assert.match(navy, /repeating-linear-gradient/);
  assert.match(navy, /clip-path:polygon/);
  assert.match(navy, /box-shadow:inset/);
  assert.match(navy, /border-bottom:10px solid/);
  assert.match(navy, /upgrade-panel>\[data-body\]::before/);
  assert.match(navy, /loadout-slot::after/);
  assert.match(navy, /upgrade-control::after/);
  assert.match(navy, /\.life-chip::before,[\s\S]*content:none!important/);
  assert.match(navy, /\.upgrade-panel>\[data-body\][\s\S]*overflow-y:auto!important/);
  assert.match(navy, /max-height:calc\(100dvh/);
  assert.match(navy, /bottom:max\(82px,calc\(env\(safe-area-inset-bottom\) \+ 78px\)\)/);
  assert.match(navy, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(navy, /border-radius:0!important/);
  assert.match(surfaces, /max-height:min\(70dvh,640px\)/);
});

test('Rinne typography remains concept-specific', () => {
  assert.match(typography, /Kaisei\+Opti/);
  assert.match(typography, /Zen\+Kaku\+Gothic\+New/);
  assert.doesNotMatch(typography, /BIZ\+UDPGothic|BIZ UDPGothic|Zen\+Old\+Mincho|Zen Old Mincho/);
});
