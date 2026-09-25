import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const read=relative=>readFileSync(fileURLToPath(new URL(relative,import.meta.url)),'utf8');

test('Johakyu WebGL runtime consumes the shared RINNE toon law',()=>{
  const source=read('../src/runtime.js');
  assert.match(source,/from '@soul\/rendering\/stylized-shading'/);
  assert.match(source,/createStylizedShadingController\(scene\)/);
  assert.match(source,/applyStylizedShading\(container,kind==='hero'\?'hero':'enemy'\)/);
  assert.match(source,/applyStylizedShading\(scene,'environment'\)/);
  assert.match(source,/event\.type==='inspiration-start'/);
  assert.match(source,/toonShading\?\.pulse/);
  assert.match(source,/toon:toonShading\?\.snapshot\(\)/);
});

test('dynamic RINNE frontier meshes cannot bypass toon shading',()=>{
  const terrain=read('../../../apps/rinne/src/rebuild/combat-terrain-presentation.js');
  const projectile=read('../../../apps/rinne/src/rebuild/combat-projectile-presentation.js');
  assert.match(terrain,/applyStylizedShading\(mesh,'environment'\)/);
  assert.match(projectile,/applyStylizedShading\(mesh,'prop'\)/);
});

test('Johakyu presentation declares rendering as a direct workspace dependency',()=>{
  const manifest=JSON.parse(read('../package.json'));
  assert.equal(manifest.dependencies['@soul/rendering'],'*');
});
