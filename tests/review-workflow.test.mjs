import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review and Character Studio are independent DEV applications',async()=>{
  const [applications,reviewMain,reviewPkg,studioPkg,studioVite,rinneVite]=await Promise.all([
    read('apps/pulse/applications.mjs'),read('apps/review/src/main.js'),read('apps/review/package.json'),
    read('apps/character-studio/package.json'),read('apps/character-studio/vite.config.js'),read('apps/rinne/vite.config.js')
  ]);
  assert.match(reviewPkg,/"name": "@soul\/review"/);
  assert.match(studioPkg,/"name": "@soul\/character-studio"/);
  assert.match(reviewMain,/soul-lineage-character-studio-dev\.c-okamoto\.workers\.dev/);
  assert.match(applications,/fastDevTarget\(id, developSha, statuses\)/);
  assert.doesNotMatch(applications,/rinneDevToolTarget|dev\/rinne\/\$\{path\}/);
  assert.doesNotMatch(rinneVite,/characters(?:Advanced)?:fileURLToPath/);
  assert.match(studioVite,/\.\/index\.html/);
  assert.match(studioVite,/\.\/advanced\.html/);
});

test('RINNE specialist runtime probes remain RINNE-scoped and are not independent app identities',async()=>{
  const [reviewMain,rinneVite]=await Promise.all([read('apps/review/src/main.js'),read('apps/rinne/vite.config.js')]);
  for(const path of ['review-motion.html','review-assets.html','review-effects.html','review-battle.html']) assert.match(reviewMain,new RegExp(path.replace('.','\\.')));
  assert.match(rinneVite,/reviewMotion:fileURLToPath/);
  assert.match(rinneVite,/reviewEffects:fileURLToPath/);
  assert.match(rinneVite,/reviewBattle:fileURLToPath/);
});
