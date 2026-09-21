import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('motion review stays the visual reference and does not consume the extracted workbench classes',async()=>{
  const [shell,workbench,motion,preview]=await Promise.all([
    read('packages/shared-ui/src/review-shell.js'),
    read('packages/shared-ui/src/review-workbench.css'),
    read('apps/rinne/review-motion.html'),
    read('apps/rinne/src/review-motion-preview.css'),
  ]);
  assert.match(shell,/import '\.\/review-workbench\.css'/);
  assert.match(workbench,/\.review-workbench__library/);
  assert.match(motion,/motion-library motion-library-primary/);
  assert.match(motion,/data-review-stage-panel-host="\.motion-library-primary"/);
  assert.doesNotMatch(motion,/review-workbench__/);
  assert.match(preview,/motion-library-primary>\.review-stage-controls__panel/);
});

test('catalog review surfaces use the motion-derived library grammar',async()=>{
  const pages=Object.fromEntries(await Promise.all([
    ['equipment','apps/rinne/review-assets.html'],
    ['objects','apps/rinne/review-objects.html'],
    ['effects','apps/rinne/review-effects.html'],
    ['sounds','apps/rinne/review-sound.html'],
  ].map(async([id,path])=>[id,await read(path)])));
  for(const [id,html] of Object.entries(pages)){
    assert.match(html,/review-workbench/,`${id} missing workbench root`);
    assert.match(html,/review-workbench__library/,`${id} missing shared library`);
    assert.match(html,/review-workbench__panel-host/,`${id} missing settings host`);
    assert.match(html,/review-workbench__filters/,`${id} missing shared filters`);
  }
  assert.match(pages.equipment,/review-workbench__stage-caption/);
  assert.match(pages.objects,/id="object-selected"/);
  assert.match(pages.objects,/data-object-camera="full"/);
  assert.match(pages.effects,/review-workbench__stage-caption/);
  assert.match(pages.sounds,/review-workbench__transport/);
  assert.match(pages.sounds,/review-workbench__timeline/);
});

test('stage settings panels open in the lower workbench instead of over the render subject',async()=>{
  const [motion,equipment,objects,effects,sounds,battle]=await Promise.all([
    read('apps/rinne/review-motion.html'),
    read('apps/rinne/review-assets.html'),
    read('apps/rinne/review-objects.html'),
    read('apps/rinne/review-effects.html'),
    read('apps/rinne/review-sound.html'),
    read('apps/rinne/review-battle.html'),
  ]);
  assert.match(motion,/data-review-stage-panel-host="\.motion-library-primary"/);
  assert.match(equipment,/data-review-stage-panel-host="\.asset-library"/);
  assert.match(objects,/data-review-stage-panel-host="\.object-library"/);
  assert.match(effects,/data-review-stage-panel-host="\.fx-review-library"/);
  assert.match(sounds,/data-review-stage-panel-host="\.sound-review-library"/);
  assert.match(battle,/data-review-stage-panel-host="\.controls\.review-surface__panel"/);
  assert.match(battle,/controls review-surface__panel review-workbench__panel-host/);
});
