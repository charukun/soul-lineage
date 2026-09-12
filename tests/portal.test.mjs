import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { targetAppsFromFiles } from '../ops-board/pulls.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('public gallery excludes every Rinne-related destination', async () => {
  const catalog = JSON.parse(await read('portal/catalog.json'));
  assert.ok(Array.isArray(catalog.items) && catalog.items.length >= 2);
  const urls = catalog.items.flatMap(item => item.links || []).map(link => link.url);
  const text = JSON.stringify(catalog).toLowerCase();
  assert.doesNotMatch(text, /soul-lineage|bloodline-legacy|rinne-visual|rinne-ops|輪廻転焦/);
  assert.ok(urls.every(url => new URL(url).protocol === 'https:'));
  assert.ok(catalog.items.some(item => item.id === 'guiltys-garden'));
  assert.ok(catalog.items.some(item => item.id === 'yare'));
});

test('gallery is immersive rather than a conventional card directory', async () => {
  const [html, css, js, worker, wrangler] = await Promise.all([
    read('portal/public/index.html'),
    read('portal/public/style.css'),
    read('portal/public/app.js'),
    read('portal/worker.mjs'),
    read('wrangler.portal.jsonc'),
  ]);
  assert.match(html, /<canvas id="world"/);
  assert.match(html, /id="journey"/);
  assert.match(html, /id="share-page"/);
  assert.match(html, /id="copy-page"/);
  assert.doesNotMatch(html, /<header\b|<main\b|<nav\b/);
  assert.match(css, /position:sticky/);
  assert.match(css, /perspective:1500px/);
  assert.match(css, /preview-frame/);
  assert.match(js, /requestAnimationFrame\(tick\)/);
  assert.match(js, /navigator\.share/);
  assert.match(js, /navigator\.clipboard\.writeText/);
  assert.match(worker, /og:image/);
  assert.match(worker, /og:video/);
  assert.match(worker, /twitter:player/);
  assert.match(worker, /\/api\/catalog/);
  assert.match(wrangler, /wayfinder-gallery/);
  assert.doesNotMatch(html, /rel="manifest"/);
});

test('target classifier still recognizes the public gallery as its own app', () => {
  const labels = targetAppsFromFiles(['portal/public/index.html']).map(item => item.label);
  assert.deepEqual(labels, ['公開リンク集']);
});
