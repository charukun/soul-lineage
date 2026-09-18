import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { targetAppsFromFiles } from '../ops-board/pulls.mjs';
import { catalogFromPulseState } from '../portal/worker.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('WAYFINDER fallback contains only a PULSE recovery route', async () => {
  const catalog = JSON.parse(await read('portal/catalog.json'));
  assert.equal(catalog.repository, 'charukun/soul-lineage');
  assert.equal(catalog.source, 'fallback');
  assert.deepEqual(catalog.items.map(item => item.id), ['ops-board']);
  const text = JSON.stringify(catalog).toLowerCase();
  assert.doesNotMatch(text, /guilty|doit-yare|gg-sites/);
  const urls = catalog.items.flatMap(item => item.links || []).map(link => link.url);
  assert.ok(urls.length > 0 && urls.every(url => new URL(url).protocol === 'https:'));
  assert.ok(urls.every(url => new URL(url).hostname === 'rinne-ops.c-okamoto.workers.dev'));
});

test('WAYFINDER derives its public routes from PULSE and omits itself or unpublished targets', () => {
  const state = {
    repository: 'charukun/soul-lineage',
    applicationsUpdatedAt: '2026-09-12T10:00:00.000Z',
    applications: [
      {
        id: 'rinne', name: '輪廻転焦', kind: 'game', targets: [
          { label: '開発', environment: 'dev', state: 'success', url: 'https://charukun.github.io/soul-lineage/dev/rinne/' },
          { label: '検証', environment: 'staging', state: 'success', url: 'https://charukun.github.io/soul-lineage/staging/rinne/' },
          { label: '本番', environment: 'prod', state: 'missing', url: null },
        ],
      },
      {
        id: 'visual-review', name: 'Visual Review Lab', kind: 'tool', targets: [
          { label: '専用公開', environment: 'preview', state: 'success', url: 'https://rinne-visual-review.c-okamoto.workers.dev/' },
        ],
      },
      {
        id: 'portal', name: 'WAYFINDER', kind: 'tool', targets: [
          { label: '一般公開', environment: 'tool', state: 'success', url: 'https://wayfinder-gallery.c-okamoto.workers.dev/' },
        ],
      },
      {
        id: 'ops-board', name: 'PULSE', kind: 'tool', targets: [
          { label: 'この画面', environment: 'tool', state: 'success', url: 'https://rinne-ops.c-okamoto.workers.dev/' },
        ],
      },
    ],
  };

  const catalog = catalogFromPulseState(state);
  assert.equal(catalog.source, 'PULSE');
  assert.deepEqual(catalog.items.map(item => item.id), ['rinne', 'visual-review', 'ops-board']);
  assert.doesNotMatch(JSON.stringify(catalog).toLowerCase(), /guilty|yare/);
  assert.deepEqual(catalog.items[0].links.map(link => link.environment), ['dev', 'staging']);
  assert.match(catalog.items[0].links[0].label, /開発 · LIVE/);
  assert.ok(catalog.items.flatMap(item => item.links).every(link => new URL(link.url).protocol === 'https:'));
});

test('PULSE repository mismatch fails closed', () => {
  assert.throws(() => catalogFromPulseState({ repository: 'charukun/other', applications: [] }), /repository mismatch/);
});

test('gallery remains immersive while acting as a public navigation surface', async () => {
  const [html, css, js, worker, wrangler] = await Promise.all([
    read('portal/public/index.html'),
    read('portal/public/style.css'),
    read('portal/public/app.js'),
    read('portal/worker.mjs'),
    read('wrangler.portal.jsonc'),
  ]);
  assert.match(html, /<canvas id="world"/);
  assert.match(html, /id="journey"/);
  assert.match(html, /PULSE SYNC/);
  assert.match(html, /開発・検証・本番/);
  assert.match(html, /id="share-page"/);
  assert.match(html, /id="copy-page"/);
  assert.doesNotMatch(html, /<header\b|<main\b|<nav\b/);
  assert.match(css, /position:sticky/);
  assert.match(css, /perspective:1500px/);
  assert.match(css, /preview-frame/);
  assert.match(js, /requestAnimationFrame\(tick\)/);
  assert.match(js, /navigator\.share/);
  assert.match(js, /navigator\.clipboard\.writeText/);
  assert.match(worker, /PULSE_STATE_URL/);
  assert.match(worker, /catalogFromPulseState/);
  assert.match(worker, /\/api\/catalog/);
  assert.match(worker, /og:image/);
  assert.match(wrangler, /wayfinder-gallery/);
  assert.doesNotMatch(html, /rel="manifest"/);
});

test('target classifier still recognizes the public gallery as its own app', () => {
  const labels = targetAppsFromFiles(['portal/public/index.html']).map(item => item.label);
  assert.deepEqual(labels, ['公開リンク集']);
});
