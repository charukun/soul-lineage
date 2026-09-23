import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('object review uses catalog-owned dedicated thumbnails instead of live grid rendering',async()=>{
  const [catalog,library,sprite]=await Promise.all([
    read('apps/rinne/src/review-object-catalog.js'),
    read('apps/rinne/src/review-object-library.js'),
    read('apps/rinne/public/review/object-thumbnails.svg'),
  ]);
  assert.match(catalog,/thumbnailUrl:thumb\('barrel'\)/);
  assert.match(catalog,/thumbnailUrl:thumb\(`prop-\$\{id\}`\)/);
  assert.match(library,/function createObjectThumbnail\(item\)/);
  assert.doesNotMatch(library,/scheduleRuntimeThumbnail|createRuntimeThumbnail/);

  const ids=[
    'barrel','box','rubble','torch',
    'prop-fence','prop-wall','prop-tree','prop-pine','prop-flowers','prop-hedge','prop-lamp','prop-bench',
    'prop-bed','prop-sofa','prop-table','prop-chair','prop-shelf','prop-counter','prop-workbench','prop-hearth','prop-rug','prop-plant',
    'training-dummy','armor-stand','weapon-spear','weapon-axe','weapon-great',
  ];
  for(const id of ids)assert.match(sprite,new RegExp(`<symbol id=["']${id}["']`),`missing dedicated thumbnail symbol for ${id}`);
});

test('object review intentionally overrides the shared six-column phone grid for readable model selection',async()=>{
  const css=await read('apps/rinne/src/review-object-library.css');
  assert.match(css,/\.object-options\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/);
  assert.match(css,/@media\(max-width:520px\)[\s\S]*?\.object-options\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.object-thumbnail\{display:block;width:100%;height:100%/);
});
