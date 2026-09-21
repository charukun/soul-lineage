import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Village uses the 百年転生 crest at the shared brand boot gate',async()=>{
  const [index,brand,main]=await Promise.all([
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../src/brand-start.js',import.meta.url),'utf8'),
    readFile(new URL('../src/web/main.js',import.meta.url),'utf8'),
  ]);
  assert.match(index,/src\/brand-start\.js/);
  assert.doesNotMatch(index,/src\/main\.js/);
  assert.match(brand,/applyBootBrand/);
  assert.match(brand,/rinneCrestUrl/);
  assert.match(brand,/wordmark:'百年転生'/);
  assert.match(main,/rinneCrestUrl/);
  assert.doesNotMatch(main,/sharedEmblemUrl/);
});

test('post-entry enhancement loader exposes static dynamic imports so Vite emits every DEV chunk',async()=>{
  const source=await readFile(new URL('../src/mura-enhancements.js',import.meta.url),'utf8');
  assert.match(source,/['"]\.\/mura-world-systems\.js['"]:\(\)=>import\(['"]\.\/mura-world-systems\.js['"]\)/);
  assert.match(source,/['"]\.\/mura-first-run-autoplay\.js['"]:\(\)=>import\(['"]\.\/mura-first-run-autoplay\.js['"]\)/);
  assert.match(source,/await load\(\)/);
  assert.doesNotMatch(source,/@vite-ignore/);
});
