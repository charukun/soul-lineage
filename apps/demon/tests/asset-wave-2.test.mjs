import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/asset-visuals.js',import.meta.url),'utf8');
const root=new URL('../public/assets/vendor/kenney-particles/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('./MANIFEST.json',root),'utf8'));
const expected={
  'LICENSE.txt':'e198510d3c6ac7e3dc4370f1f0861d8c617362e8',
  'spark_05.png':'e01086ab2deabdedfa85f48df5f1c40392c19723',
  'slash_03.png':'31f250ab448fcd8c767a4960c6fbc7105b326fa5',
  'smoke_05.png':'4a77199d4ddab9d6482d8285ed3cd962983d8ffa',
  'flare_01.png':'bd25bd874e47467e95d6623aa0364be1c619617a',
};
function gitBlobSha(bytes){return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');}

test('second-wave particle assets stay pinned to the audited CC0 source',()=>{
  assert.equal(manifest.pack,'Kenney Particle Pack');
  assert.equal(manifest.license,'CC0-1.0');
  assert.equal(manifest.repository,'Calinou/kenney-particle-pack');
  assert.equal(manifest.commit,'ab7086639ee73be31abd87feb21bf1402d4e8144');
  assert.deepEqual(manifest.files,expected);
  for(const [name,sha] of Object.entries(expected))assert.equal(gitBlobSha(readFileSync(new URL(name,root))),sha,name);
});

test('demon VFX uses repository-local sourced textures without changing combat authority',()=>{
  for(const file of ['spark_05.png','slash_03.png','smoke_05.png','flare_01.png'])assert.match(source,new RegExp(file.replace('.','\\.')));
  assert.match(source,/repository-local-visual-only/);
  assert.match(source,/No NPC state, combat hitbox, navigation or raid rules are changed/);
  assert.match(source,/originalEvent\.call\(this, event\)/);
  assert.match(source,/originalSlash\.call\(this, x, z, yaw\)/);
  assert.doesNotMatch(source,/raw\.githubusercontent\.com/);
  assert.doesNotMatch(source,/kenney\.nl\/media/);
});
