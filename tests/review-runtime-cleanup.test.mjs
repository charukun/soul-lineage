import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Character Studio owns canonical review CSS and entry imports',async()=>{
 const [index,advanced,grid,modular,mainCss]=await Promise.all([
  read('apps/character-studio/index.html'),read('apps/character-studio/advanced.html'),
  read('apps/character-studio/src/review/character/grid.js'),read('apps/character-studio/src/review/character/modular.js'),
  read('apps/character-studio/src/review/character/main.css')
 ]);
 assert.match(index,/src\/review\/character\/main\.css/);
 assert.match(index,/src\/review\/character\/main\.js/);
 assert.match(index,/src\/review\/slot-auto\.js/);
 assert.match(advanced,/src\/review\/character\/runtime\.css/);
 assert.match(advanced,/src\/review\/character\/advanced\.css/);
 assert.match(advanced,/src\/review\/character\/runtime\.js/);
 assert.match(grid,/import '\.\/grid\.css'/);
 assert.match(modular,/import '\.\/modular\.css'/);
 assert.doesNotMatch(mainCss,/@import ['"]\.\/review\/character\/main\.css/);
});

test('review adapters share auto-install lifecycle and load generation primitives',async()=>{
 const [pkg,auto,load,charRuntime,objectRuntime,rinneAuto]=await Promise.all([
  read('packages/shared-ui/package.json'),read('packages/shared-ui/src/review/auto-install.js'),
  read('packages/shared-ui/src/review/load-controller.js'),read('apps/character-studio/src/review/character/runtime.js'),
  read('apps/rinne/src/review/objects/entrypoint.js'),read('apps/rinne/src/review/shared/slot-auto.js')
 ]);
 assert.match(pkg,/"\.\/review-auto-install"/);
 assert.match(pkg,/"\.\/review-load-controller"/);
 assert.match(auto,/export function createReviewAutoInstaller/);
 assert.match(load,/export function createReviewLoadController/);
 assert.match(charRuntime,/createReviewLoadController/);
 assert.match(charRuntime,/setReviewStatus/);
 assert.match(objectRuntime,/createReviewLoadController/);
 assert.match(rinneAuto,/createReviewAutoInstaller/);
 assert.doesNotMatch(rinneAuto,/new MutationObserver/);
});

test('legacy Character Studio slot entry is a compatibility facade only',async()=>{
 const source=await read('apps/character-studio/src/review-slot-auto.js');
 assert.equal(source,"import './review/slot-auto.js';\n");
});
