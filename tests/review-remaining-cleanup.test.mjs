import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Character Studio review styles are owned by the character review domain',async()=>{
  const [index,advanced,grid,modular]=await Promise.all([
    read('apps/character-studio/index.html'),
    read('apps/character-studio/advanced.html'),
    read('apps/character-studio/src/review/character/grid.js'),
    read('apps/character-studio/src/review/character/modular.js'),
  ]);
  assert.match(index,/src\/review\/character\/main\.css/);
  assert.match(advanced,/src\/review\/character\/runtime\.css/);
  assert.match(advanced,/src\/review\/character\/advanced\.css/);
  assert.match(grid,/import '\.\/grid\.css'/);
  assert.match(modular,/import '\.\/modular\.css'/);
});

test('review auto installers share observer and DOM helper lifecycle',async()=>{
  const [shared,pkg,character,rinne]=await Promise.all([
    read('packages/shared-ui/src/review/auto-install.js'),
    read('packages/shared-ui/package.json'),
    read('apps/character-studio/src/review-slot-auto.js'),
    read('apps/rinne/src/review/shared/slot-auto.js'),
  ]);
  assert.match(shared,/export function createReviewAutoInstaller/);
  assert.match(shared,/export function ensureReviewRow/);
  assert.match(shared,/export function moveReviewControl/);
  assert.match(pkg,/"\.\/review-auto-install": "\.\/src\/review\/auto-install\.js"/);
  for(const source of [character,rinne]){
    assert.match(source,/@soul\/shared-ui\/review-auto-install/);
    assert.match(source,/createReviewAutoInstaller\(install\)/);
    assert.doesNotMatch(source,/new MutationObserver/);
    assert.doesNotMatch(source,/function schedule\(/);
  }
});

test('legacy Character Studio CSS remains compatibility-only',async()=>{
  const expected=new Map([
    ['character-review-main.css',"@import './review/character/main.css';\n"],
    ['character-review-grid.css',"@import './review/character/grid.css';\n"],
    ['character-review.css',"@import './review/character/runtime.css';\n"],
    ['character-review-advanced.css',"@import './review/character/advanced.css';\n"],
    ['character-review-modular.css',"@import './review/character/modular.css';\n"],
  ]);
  for(const [name,facade] of expected)assert.equal(await read(`apps/character-studio/src/${name}`),facade);
});
