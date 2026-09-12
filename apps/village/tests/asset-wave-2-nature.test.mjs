import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const root=new URL('../public/assets/vendor/kenney-nature/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('MANIFEST.json',root),'utf8'));
const expected={
  'License.txt':'cb96b75e3560ac78d7a53ce6f083f4cdb5c53faea6141b62d63458dcfe1e4b9d',
  'tree_oak.glb':'d7fd8773674928c50c11b66d12c636d49bdcc15a8b1c7fbb98e6f63a3439a3f3',
  'tree_default.glb':'562d29638c902de3c7bee465d3a53bb77117efbc392ae04ed894faf6b5dc691d',
  'rock_largeA.glb':'6dd15390fd96501dcd1454765a17ba61dbbd8d47705dfe5149c8dd92b353ce25',
  'rock_smallA.glb':'df9fff9d711e61370e8df0caa2514c89b8f8a8dc6c6fafaf4eb2ec79c5ae07c1',
  'sign.glb':'c658c21672ecd63c5d3e53f06f875d68e6509edb1ab7e3b75374df7c61e7dd0c',
};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

test('second-wave Nature Kit files match the verified official archive manifest',()=>{
  assert.equal(manifest.pack,'Kenney Nature Kit');
  assert.equal(manifest.version,'2.1');
  assert.equal(manifest.license,'CC0-1.0');
  assert.equal(manifest.officialArchiveSha256,'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d');
  assert.deepEqual(manifest.files,expected);
  for(const [name,sha] of Object.entries(expected))assert.equal(sha256(readFileSync(new URL(name,root))),sha,name);
});
