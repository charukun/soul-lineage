import test from 'node:test';
import assert from 'node:assert/strict';
import {importSpecifiers} from '../scripts/import-specifiers.mjs';

test('asset URL dependencies are collected only when anchored to import.meta.url',()=>{
  const source=`
    import value from '@soul/example';
    const moduleAsset=new URL('../public/model.glb',import.meta.url);
    const runtimeRoot=new URL('../public/',import.meta.url);
    const runtimeLookup=new URL('models/manifest.json',runtimeRoot);
  `;
  assert.deepEqual(importSpecifiers(source),['@soul/example','../public/model.glb','../public/']);
});
