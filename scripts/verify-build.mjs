import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const root = resolve(process.argv[2]);
const app = process.argv[3];
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const info = JSON.parse(await readFile(resolve(root, 'version.json'), 'utf8'));
assert.equal(info.app, app);
assert.equal(info.environment, process.env.APP_ENV || 'local');
assert.match(info.inputHash, /^[a-f0-9]{64}$/);
assert.ok(html.includes('id="game"'), 'Game canvas is missing');
const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)].map(m => m[1]);
assert.ok(assets.some(p => p.endsWith('.js')), 'Bundled JavaScript is missing');
assert.ok(assets.some(p => p.endsWith('.css')), 'Bundled CSS is missing');
for (const asset of assets) {
  const path = resolve(root, asset); assert.ok(path.startsWith(root + sep));
  assert.ok((await stat(path)).size > 0, `Empty asset: ${asset}`);
}
assert.ok((await readdir(resolve(root, 'assets'))).some(f => /^emblem-.*\.svg$/.test(f)), 'Shared asset was not emitted');
assert.ok(!html.includes('/src/main.js'), 'Source entry was not bundled');
console.log(`Build verified: ${app} / ${info.environment} / ${info.commit} / ${info.inputHash}`);
