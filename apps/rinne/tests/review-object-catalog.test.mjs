import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('object review is driven by the shared RINNE world-object catalog',async()=>{
  const [catalog,review,css]=await Promise.all([read('src/review-object-catalog.js'),read('src/review-object-library.js'),read('src/review-object-library.css')]);
  assert.match(catalog,/GARDEN,FURNITURE/);
  assert.match(catalog,/uniqueById\(\[\.\.\.GARDEN,\.\.\.FURNITURE\]\)/);
  for(const id of ['barrel','box','rubble','torch','training-dummy','armor-stand','weapon-spear','weapon-axe','weapon-great'])assert.match(catalog,new RegExp(`id:'${id}'`));
  assert.match(review,/RINNE_OBJECT_REVIEW_CATALOG as OBJECTS/);
  assert.match(review,/models\.prop\(item\.propKind/);
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
