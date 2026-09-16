import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const apps = [
  {
    name: 'rinne',
    index: 'apps/rinne/index.html',
    ui: 'apps/rinne/src/consumer-game-ui.css',
    href: './src/consumer-game-ui.css',
    signature: '--console-brass',
    surfaces: ['.title-actions', '.objective-card', '#village-dialog'],
  },
  {
    name: 'village',
    index: 'apps/village/index.html',
    ui: 'apps/village/src/web/consumer-game-ui.css',
    href: './src/web/consumer-game-ui.css',
    signature: '--village-wood',
    surfaces: ['.glass', '#build', '#drawer', 'dialog'],
  },
  {
    name: 'demon',
    index: 'apps/demon/index.html',
    ui: 'apps/demon/src/web/consumer-game-ui.css',
    href: './src/web/consumer-game-ui.css',
    signature: '--hunt-scar',
    surfaces: ['.title-links', '.memory-chip', '.slot', '.sheet-content'],
  },
];

const forbiddenFontTokens = [
  'system-ui',
  '-apple-system',
  'Noto Sans JP',
  'Noto Serif CJK JP',
  'Yu Mincho',
  'Hiragino Mincho ProN',
  'Georgia',
  'Arial',
];

for (const app of apps) {
  test(`${app.name} loads its consumer UI layer before typography`, () => {
    const html = read(app.index);
    const uiIndex = html.indexOf(app.href);
    const typographyIndex = html.indexOf('./src/typography.css');
    assert.notEqual(uiIndex, -1, `${app.name} must load ${app.href}`);
    assert.notEqual(typographyIndex, -1, `${app.name} must load typography.css`);
    assert.ok(uiIndex < typographyIndex, `${app.name} typography.css must remain the final visual text authority`);
  });

  test(`${app.name} consumer UI covers primary game surfaces and input states`, () => {
    const css = read(app.ui);
    assert.match(css, new RegExp(app.signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
    for (const surface of app.surfaces) {
      assert.ok(css.includes(surface), `${app.name} consumer UI must cover ${surface}`);
    }
    for (const token of forbiddenFontTokens) {
      assert.ok(!css.includes(token), `${app.name} consumer UI must not reintroduce forbidden font token: ${token}`);
    }
  });
}

test('platform documentation defines the cross-app consumer game UI rule', () => {
  const platforms = read('docs/PLATFORMS.md');
  assert.match(platforms, /## コンシューマ向けゲームUI/);
  assert.match(platforms, /汎用Webカード/);
  assert.match(platforms, /ゲームパッド/);
});
