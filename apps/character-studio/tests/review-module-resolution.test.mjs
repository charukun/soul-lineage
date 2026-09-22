import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const targets = [
  ['motion/entrypoint.js', '../../character-workshop-ux.js'],
  ['character/runtime.js', '../workspace/advanced.js'],
  ['workspace/index.js', '../../character-reference-workshop.js']
];
for (const [modulePath, dependency] of targets) {
  test(`review module ${modulePath} resolves its moved dependency`, () => {
    const moduleUrl = new URL(`../src/review/${modulePath}`, import.meta.url);
    assert.ok(readFileSync(moduleUrl, 'utf8').includes(`'${dependency}'`));
    assert.ok(existsSync(new URL(dependency, moduleUrl)), dependency);
  });
}
