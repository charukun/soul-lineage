import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../../../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('PARALYZE AREA boot presentation is shared and apps only provide loading behavior',async()=>{
  const gate=await read('packages/shared-ui/src/boot-gate.js');
  assert.match(gate,/PARALYZE AREA/);
  assert.doesNotMatch(gate,/dataset\.app|detail:\{app\}|\{app=.*load/);

  for(const app of ['village','rinne','demon']){
    const source=await read(`apps/${app}/src/brand-start.js`);
    assert.match(source,/openBrandBootGate\(\{\s*load:/);
    assert.doesNotMatch(source,/app\s*:/);
  }
});
