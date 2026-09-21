import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('RINNE keeps stable public review entrypoints while implementation lives under domain folders',async()=>{
  const [vite,architecture,...entrypoints]=await Promise.all([
    read('apps/rinne/vite.config.js'),
    read('docs/review/ARCHITECTURE.md'),
    ...['motion','equipment','objects','effects','sound','battle'].map(domain=>read(`apps/rinne/src/review/${domain}/entrypoint.js`)),
  ]);
  for(const path of ['review-motion.html','review-assets.html','review-objects.html','review-effects.html','review-sound.html','review-battle.html'])assert.match(vite,new RegExp(path.replaceAll('.','\\.')));
  assert.match(architecture,/apps\/rinne\/src\/review\//);
  assert.match(architecture,/stable public review entrypoints/);
  for(const source of entrypoints)assert.ok(source.length>100,'domain entrypoint must contain implementation');
});

test('legacy flat review entrypoints are thin compatibility facades',async()=>{
  const expected={
    'review-motion.js':"import './review/motion/entrypoint.js';",
    'review-asset-library.js':"import './review/equipment/entrypoint.js';",
    'review-object-library.js':"import './review/objects/entrypoint.js';",
    'review-effects.js':"import './review/effects/entrypoint.js';",
    'review-sound.js':"import './review/sound/entrypoint.js';",
    'review-battle.js':"import './review/battle/entrypoint.js';",
  };
  for(const [file,line] of Object.entries(expected))assert.equal((await read(`apps/rinne/src/${file}`)).trim(),line);
});

test('domain styles are canonical and old style paths only forward to them',async()=>{
  const expected={
    'review-motion.css':"@import './review/motion/index.css';",
    'review-asset-library.css':"@import './review/equipment/index.css';",
    'review-object-library.css':"@import './review/objects/index.css';",
    'review-effects.css':"@import './review/effects/index.css';",
    'review-sound.css':"@import './review/sound/index.css';",
    'review-battle.css':"@import './review/battle/index.css';",
  };
  for(const [file,line] of Object.entries(expected))assert.equal((await read(`apps/rinne/src/${file}`)).trim(),line);
});
