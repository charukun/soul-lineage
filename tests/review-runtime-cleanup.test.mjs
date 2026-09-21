import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Character Studio owns canonical review JS and CSS under its review domain',async()=>{
  const [index,advanced,grid,modular]=await Promise.all([
    read('apps/character-studio/index.html'),
    read('apps/character-studio/advanced.html'),
    read('apps/character-studio/src/review/character/grid.js'),
    read('apps/character-studio/src/review/character/modular.js'),
  ]);
  assert.match(index,/src\/review\/character\/main\.css/);
  assert.match(index,/src\/review\/character\/main\.js/);
  assert.match(index,/src\/review\/motion\/debug\.js/);
  assert.match(index,/src\/review\/motion\/entrypoint\.js/);
  assert.match(advanced,/src\/review\/character\/runtime\.css/);
  assert.match(advanced,/src\/review\/character\/advanced\.css/);
  assert.match(advanced,/src\/review\/character\/runtime\.js/);
  assert.match(grid,/import '\.\/grid\.css'/);
  assert.match(modular,/import '\.\/modular\.css'/);
});

test('legacy Character Studio styles are compatibility facades only',async()=>{
  const pairs={
    'character-review-main.css':'main.css',
    'character-review-grid.css':'grid.css',
    'character-review.css':'runtime.css',
    'character-review-advanced.css':'advanced.css',
    'character-review-modular.css':'modular.css',
  };
  for(const [legacy,canonical] of Object.entries(pairs)){
    assert.equal(await read(`apps/character-studio/src/${legacy}`),`@import './review/character/${canonical}';\n`);
  }
});

test('review slot auto scheduling and stage camera wiring are shared primitives',async()=>{
  const [shared,character,rinne,pkg]=await Promise.all([
    read('packages/shared-ui/src/review/auto-install.js'),
    read('apps/character-studio/src/review-slot-auto.js'),
    read('apps/rinne/src/review/shared/slot-auto.js'),
    read('packages/shared-ui/package.json'),
  ]);
  for(const symbol of ['createReviewAutoInstaller','ensureReviewRow','installReviewStageCameraSlot','moveReviewSlot'])assert.match(shared,new RegExp(`export function ${symbol}`));
  for(const source of [character,rinne]){
    assert.match(source,/@soul\/shared-ui\/review-auto-install/);
    assert.match(source,/createReviewAutoInstaller\(install\)/);
    assert.doesNotMatch(source,/new MutationObserver/);
  }
  assert.match(pkg,/"\.\/review-auto-install": "\.\/src\/review\/auto-install\.js"/);
});

test('review load generation is shared across Character, Equipment and Objects',async()=>{
  const [shared,character,equipment,objects,pkg]=await Promise.all([
    read('packages/shared-ui/src/review/load-controller.js'),
    read('apps/character-studio/src/review/character/runtime.js'),
    read('apps/rinne/src/review/equipment/entrypoint.js'),
    read('apps/rinne/src/review/objects/entrypoint.js'),
    read('packages/shared-ui/package.json'),
  ]);
  assert.match(shared,/export function createReviewLoadController/);
  for(const source of [character,equipment,objects]){
    assert.match(source,/@soul\/shared-ui\/review-load-controller/);
    assert.match(source,/createReviewLoadController\(\)/);
    assert.doesNotMatch(source,/loadSequence/);
  }
  assert.match(pkg,/"\.\/review-load-controller": "\.\/src\/review\/load-controller\.js"/);
});

test('RINNE Vite builds only nested canonical review source entries',async()=>{
  const vite=await read('apps/rinne/vite.config.js');
  for(const dir of ['motion','equipment','objects','effects','sound','battle'])assert.match(vite,new RegExp(`review/${dir}/index\\.html`));
  assert.doesNotMatch(vite,/new URL\('\.\/review-(?:motion|assets|objects|effects|sound|battle)\.html'/);
});
