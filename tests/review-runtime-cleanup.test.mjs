import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Character Studio canonical review entrypoints own their styles and page imports',async()=>{
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

test('RINNE and Character Studio share the auto-mount lifecycle',async()=>{
  const [pkg,shared,rinne,character]=await Promise.all([
    read('packages/shared-ui/package.json'),
    read('packages/shared-ui/src/review/auto-mount.js'),
    read('apps/rinne/src/review/shared/slot-auto.js'),
    read('apps/character-studio/src/review-slot-auto.js'),
  ]);
  assert.match(pkg,/"\.\/review-auto-mount": "\.\/src\/review\/auto-mount\.js"/);
  assert.match(shared,/export function mountReviewAutoInstaller/);
  for(const source of [rinne,character]){
    assert.match(source,/@soul\/shared-ui\/review-auto-mount/);
    assert.match(source,/mountReviewAutoInstaller\(install\)/);
    assert.doesNotMatch(source,/new MutationObserver\(schedule\)/);
  }
});

test('legacy Character Studio JS facades are no longer page entrypoints',async()=>{
  const [index,advanced]=await Promise.all([read('apps/character-studio/index.html'),read('apps/character-studio/advanced.html')]);
  for(const legacy of ['character-review-main.js','character-motion-debug.js','motion-review-entrypoint.js'])assert.doesNotMatch(index,new RegExp(legacy.replace('.','\\.')));
  assert.doesNotMatch(advanced,/character-review\.js/);
});
