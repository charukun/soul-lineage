import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../../../packages/rendering/src/master-character-reference.js',import.meta.url),'utf8');
test('reference runtime hides source meshes and marks dedicated geometry',()=>{assert.match(source,/hiddenMeshes/);assert.match(source,/reference-character:/);assert.match(source,/referenceStyle/);});
