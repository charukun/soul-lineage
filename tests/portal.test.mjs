import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { targetAppsFromFiles } from '../ops-board/pulls.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('public portal catalog has unique HTTPS destinations and keeps source-only projects separate', async () => {
  const catalog = JSON.parse(await read('portal/catalog.json'));
  assert.ok(Array.isArray(catalog.items) && catalog.items.length >= 10);
  const ids = catalog.items.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);

  const urls = [];
  for (const item of catalog.items) {
    assert.ok(['play', 'lab', 'tools', 'source'].includes(item.category));
    assert.ok(item.title);
    assert.ok(Array.isArray(item.links) && item.links.length > 0);
    for (const link of item.links) {
      const url = new URL(link.url);
      assert.equal(url.protocol, 'https:');
      urls.push(url.href);
    }
  }
  assert.equal(new Set(urls).size, urls.length);

  const byId = new Map(catalog.items.map(item => [item.id, item]));
  assert.equal(byId.get('master-character').category, 'lab');
  assert.match(byId.get('master-character').links[0].url, /\/dev\/rinne\/simulator\/$/);
  assert.equal(byId.get('gg-sites-source').category, 'source');
  assert.equal(byId.get('yare-source').category, 'source');
  assert.equal(byId.get('bloodline-source').category, 'source');
});

test('portal UI is static, filterable and deliberately non-installable', async () => {
  const [html, css, js] = await Promise.all([
    read('portal/public/index.html'),
    read('portal/public/style.css'),
    read('portal/public/app.js'),
  ]);
  assert.match(html, /RINNE GATE/);
  assert.match(html, /data-filter="play"/);
  assert.match(html, /data-filter="source"/);
  assert.match(html, /favicon\.svg/);
  assert.doesNotMatch(html, /rel="manifest"/);
  assert.match(css, /portal-card/);
  assert.match(css, /@media\(min-width:860px\)/);
  assert.match(js, /catalog\.json/);
  assert.match(js, /setFilter/);
});

test('target classifier recognizes internal sub-apps and the new portal before broad app rules', () => {
  const labels = targetAppsFromFiles([
    'apps/rinne/public/simulator/index.html',
    'apps/rinne/characters-advanced.html',
    'apps/rinne/village-rehearsal.html',
    'packages/audio/src/index.js',
    'packages/tidebreak-combat/src/index.js',
    'portal/public/index.html',
  ]).map(item => item.label);
  assert.deepEqual(labels, [
    'MasterCharacter',
    'キャラレビュー',
    '村連携リハーサル',
    '音楽 / BGM',
    'Tidebreak / Lanternfell',
    '公開リンク集',
  ]);
});
