import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(here,'../src/heart-technique-body-ui.js'),'utf8');

test('百年転生の技詳細は共有契約だけで説明文を作る',()=>{
  assert.match(source,/techniqueDetail as sharedTechniqueDetail/);
  assert.match(source,/sharedTechniqueDetail\(selection,/);
  assert.doesNotMatch(source,/skillDefinition\(selection\)/);
  assert.doesNotMatch(source,/definition\?\.mechanic|definition\?\.steps|definition\?\.tradeoff/);
  assert.doesNotMatch(source,/動作:\s*\$\{|注意:\s*\$\{/);
});
