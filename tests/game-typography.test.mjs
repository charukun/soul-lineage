import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const legacyFamilies = [
  'system-ui',
  '-apple-system',
  'Noto Sans JP',
  'Noto Serif CJK JP',
  'Yu Mincho',
  'Hiragino Mincho ProN',
  'Georgia',
  'Arial',
];

const games = [
  {
    id: 'rinne',
    pages: ['apps/rinne/index.html'],
    css: 'apps/rinne/src/typography.css',
    href: './src/typography.css',
    families: ['Zen Old Mincho', 'BIZ UDPGothic'],
  },
  {
    id: 'village',
    pages: ['apps/village/index.html', 'apps/village/friend.html'],
    css: 'apps/village/src/typography.css',
    href: './src/typography.css',
    families: ['Kiwi Maru'],
  },
  {
    id: 'demon',
    pages: ['apps/demon/index.html'],
    css: 'apps/demon/src/typography.css',
    href: './src/typography.css',
    families: ['Yuji Syuku', 'Shippori Mincho'],
  },
];

for (const game of games) {
  test(`${game.id} owns the final typography layer`, () => {
    const css = readFileSync(game.css, 'utf8');

    for (const page of game.pages) {
      const html = readFileSync(page, 'utf8');
      const stylesheetHrefs = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(stylesheetHrefs.at(-1), game.href, `${page} must load typography.css last`);
    }

    assert.match(css, /fonts\.googleapis\.com\/css2\?family=/, 'dedicated web font source must be explicit');
    assert.match(css, /body,\s*\nbody \*/, 'typography layer must cover the complete game UI');
    assert.match(css, /font-family:[^;]+!important/, 'legacy declarations must not win by normal cascade');

    for (const family of game.families) {
      assert.ok(css.includes(family), `${game.id} must declare ${family}`);
    }
    for (const family of legacyFamilies) {
      assert.ok(!css.includes(family), `${game.id} typography layer must not reintroduce ${family}`);
    }
  });
}
