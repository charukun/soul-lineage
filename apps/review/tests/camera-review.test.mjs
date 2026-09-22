import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('Camera Review is a canonical extensionless route using the shared director and five-column view choices', () => {
  assert.match(source('../src/review-lab-config.js'), /camera:new URL\('\.\/review-camera'/); assert.match(source('../index.html'), /data-route="camera"/); assert.match(source('../vite.config.js'), /review-camera\.html/);
  const js = source('../src/review-camera.js'); assert.match(js, /@soul\/rendering\/camera-director/); assert.match(js, /@soul\/rendering\/character-view-resolver/);
  for (const mode of ['exploration','combat','conversation','interior','title','event']) assert.ok(source('../review-camera.html').includes(`value="${mode}"`));
  const css = source('../src/review-camera.css'); assert.match(css, /\.camera-view-grid\{display:grid;grid-template-columns:repeat\(5,/); assert.equal((css.match(/grid-template-columns:repeat\(5,/g)||[]).length, 1);
});
