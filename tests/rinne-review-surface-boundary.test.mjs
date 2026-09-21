import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

const surfaces=Object.freeze([
  ['motion','review-motion','motion'],
  ['equipment','review-assets','equipment'],
  ['objects','review-objects','objects'],
  ['effects','review-effects','effects'],
  ['sound','review-sound','sound'],
  ['battle','review-battle','battle'],
]);

test('RINNE keeps game entry separate from app-owned review surface entries',async()=>{
  const [vite,architecture]=await Promise.all([read('apps/rinne/vite.config.js'),read('docs/review/ARCHITECTURE.md')]);
  assert.match(vite,/main:fileURLToPath\(new URL\('\.\/index\.html'/);
  for(const [id,,dir] of surfaces){
    assert.match(vite,new RegExp(`review[A-Z][A-Za-z]*:fileURLToPath\\(new URL\\('\\.\\/review\\/${dir}\\/index\\.html'`),id);
    const html=await read(`apps/rinne/review/${dir}/index.html`);
    assert.match(html,new RegExp(`src/review/${dir}/entrypoint\\.js`));
  }
  assert.match(architecture,/apps\/review\/\s+Visual Review Lab hub/);
  assert.match(architecture,/apps\/rinne\/\s+百年転生 application/);
});

test('canonical public review routes remain extensionless while source entries are nested',async()=>{
  const manifest=await read('packages/shared-ui/src/review/manifest.js');
  for(const [,route] of surfaces)assert.match(manifest,new RegExp(`'${route}'`));
  assert.doesNotMatch(manifest,/review-(?:motion|assets|objects|effects|sound|battle)\.html/);
});

test('legacy RINNE review source files are compatibility facades only',async()=>{
  const pairs=[
    ['review-motion.js','motion'],
    ['review-asset-library.js','equipment'],
    ['review-object-library.js','objects'],
    ['review-effects.js','effects'],
    ['review-sound.js','sound'],
    ['review-battle.js','battle'],
  ];
  for(const [legacy,domain] of pairs){
    const source=await read(`apps/rinne/src/${legacy}`);
    assert.equal(source,`import './review/${domain}/entrypoint.js';\n`);
  }
});
