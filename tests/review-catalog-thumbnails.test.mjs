import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('all review choice grids remain five-column on phone and desktop',async()=>{
  const [shared,objects,assets,motion]=await Promise.all([
    read('packages/shared-ui/src/review-controls.css'),
    read('apps/rinne/src/review-object-library.css'),
    read('apps/rinne/src/review-asset-library.css'),
    read('apps/rinne/src/review-motion.css'),
  ]);
  assert.match(shared,/\.review-choice-grid\{[^}]*repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(shared,/@media\(max-width:520px\)\{\.review-choice-grid\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(objects,/\.object-options\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(objects,/\.object-options\{grid-template-columns:repeat\([234],/);
  assert.match(assets,/\.asset-equipment-options,\.model-options\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(motion,/\.motion-model-grid,\.motion-grid\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
});

test('object, equipment, and model pickers use dedicated metadata thumbnails',async()=>{
  const [assetMeta,characterMeta,assetView,motionView,sprite]=await Promise.all([
    read('packages/assets/src/review-skeleton-library.js'),
    read('packages/characters/src/kaykit-foundation.js'),
    read('apps/rinne/src/review-asset-library.js'),
    read('apps/rinne/src/review-motion.js'),
    read('apps/rinne/public/review/catalog-thumbnails.svg'),
  ]);
  assert.match(assetMeta,/thumbnailUrl: reviewThumbnailUrl\(id\)/);
  assert.match(characterMeta,/thumbnailUrl: reviewThumbnailUrl\(`kaykit\.\$\{id\}\.v1`\)/);
  assert.match(assetView,/createStaticThumbnail\(item\.thumbnailUrl\|\|/);
  assert.match(assetView,/createStaticThumbnail\(model\.thumbnailUrl,model\.label\)/);
  assert.doesNotMatch(assetView,/createRuntimeThumbnail|scheduleRuntimeThumbnail/);
  assert.match(motionView,/thumbnailUrl:'\.\/review\/catalog-thumbnails\.svg#mesh2motion-review-mannequin'/);
  assert.match(motionView,/createStaticThumbnail\(model\.thumbnailUrl,model\.label\)/);
  for(const id of ['review-skeleton-warrior','review-skeleton-rogue','review-skeleton-mage','review-skeleton-minion','skeleton-blade','skeleton-axe','skeleton-staff','skeleton-crossbow','skeleton-shield-large-a','skeleton-shield-large-b','skeleton-shield-small-a','skeleton-shield-small-b','skeleton-quiver','mesh2motion-review-mannequin','kaykit.knight.v1','kaykit.barbarian.v1','kaykit.mage.v1','kaykit.rogue.v1','kaykit.rogue-hooded.v1']){
    assert.match(sprite,new RegExp(`<symbol id=["']${id.replace(/[.*+?^$()|[\]\\]/g,'\\$&')}["']`),`missing thumbnail symbol: ${id}`);
  }
});

test('remaining runtime pose thumbnails render at higher resolution',async()=>{
  const runtime=await read('apps/rinne/src/review-runtime-thumbnail.js');
  assert.match(runtime,/width:288,height:184/);
  assert.match(runtime,/antialias:true/);
});
