import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('shared review UI and rendering live behind dedicated review directories',async()=>{
  const [sharedPkg,shell,renderIndex,preview]=await Promise.all([
    read('packages/shared-ui/package.json'),
    read('packages/shared-ui/src/review/shell.js'),
    read('packages/rendering/src/index.js'),
    read('packages/rendering/src/review/preview-stage.js'),
  ]);
  assert.match(sharedPkg,/"\.\/review-shell": "\.\/src\/review\/shell\.js"/);
  assert.match(sharedPkg,/"\.\/review-slot-picker": "\.\/src\/review\/slot-picker\.js"/);
  assert.match(shell,/from '\.\/manifest\.js'/);
  assert.match(shell,/from '\.\/stage\.js'/);
  assert.match(renderIndex,/from '\.\/review\/preview-stage\.js'/);
  assert.match(preview,/export function createReviewRenderer/);
  assert.match(preview,/export function createReviewCameraPresetController/);
});

test('RINNE review implementation is grouped by review domain while stable facades remain',async()=>{
  const [motion,battle,objects,effects,sound,motionFacade,battleFacade]=await Promise.all([
    read('apps/rinne/src/review/motion/source-runtime.js'),
    read('apps/rinne/src/review/battle/stage.js'),
    read('apps/rinne/src/review/objects/catalog.js'),
    read('apps/rinne/src/review/effects/catalog.js'),
    read('apps/rinne/src/review/sound/catalog.js'),
    read('apps/rinne/src/review-motion-source-runtime.js'),
    read('apps/rinne/src/review-battle-stage.js'),
  ]);
  assert.match(motion,/from '\.\/sources\.js'/);
  assert.match(battle,/from '\.\/state\.js'/);
  assert.match(objects,/from '\.\.\/shared\/curated-library\.js'/);
  assert.match(effects,/\.\.\/\.\.\/rebuild\/review-vfx-library-manifest\.js/);
  assert.match(sound,/from '\.\.\/shared\/curated-library\.js'/);
  assert.equal(motionFacade.trim(),"export * from './review/motion/source-runtime.js';");
  assert.equal(battleFacade.trim(),"export * from './review/battle/stage.js';");
});

test('Character Studio groups review domains and reuses shared slot picker',async()=>{
  const [main,runtime,workspace,motion,slotAuto]=await Promise.all([
    read('apps/character-studio/src/review/character/main.js'),
    read('apps/character-studio/src/review/character/runtime.js'),
    read('apps/character-studio/src/review/workspace/index.js'),
    read('apps/character-studio/src/review/motion/qa.js'),
    read('apps/character-studio/src/review-slot-auto.js'),
  ]);
  assert.match(main,/from '\.\.\/workspace\/index\.js'/);
  assert.match(runtime,/from '\.\.\/motion\/qa\.js'/);
  assert.match(workspace,/from '\.\.\/character\/state\.js'/);
  assert.match(motion,/from '\.\/source\.js'/);
  assert.match(slotAuto,/@soul\/shared-ui\/review-slot-picker/);
  await assert.rejects(access(new URL('apps/character-studio/src/review-slot-picker.js',root)));
  await assert.rejects(access(new URL('apps/character-studio/src/review-slot-picker.css',root)));
});


test('Character Studio review styles are colocated with the character review domain',async()=>{
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
  for(const legacy of ['character-review-main.css','character-review-grid.css','character-review.css','character-review-advanced.css','character-review-modular.css']){
    await assert.rejects(access(new URL('apps/character-studio/src/'+legacy,root)));
  }
});

test('review loading and DOM auto-install lifecycle use shared primitives',async()=>{
  const [pkg,objects,equipment,character,charSlots,rinneSlots]=await Promise.all([
    read('packages/shared-ui/package.json'),
    read('apps/rinne/src/review/objects/entrypoint.js'),
    read('apps/rinne/src/review/equipment/entrypoint.js'),
    read('apps/character-studio/src/review/character/runtime.js'),
    read('apps/character-studio/src/review-slot-auto.js'),
    read('apps/rinne/src/review/shared/slot-auto.js'),
  ]);
  assert.match(pkg,/review-auto-install/);
  assert.match(pkg,/review-load-controller/);
  for(const source of [objects,equipment,character])assert.match(source,/createReviewLoadController/);
  for(const source of [charSlots,rinneSlots])assert.match(source,/createReviewAutoInstaller/);
});
