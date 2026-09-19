import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review and Character Studio are independent DEV apps with one canonical Worker each',async()=>{
  const [reviewPkg,studioPkg,reviewRoutes,reviewWrangler,studioWrangler,applications,bridge]=await Promise.all([
    read('apps/review/package.json'),
    read('apps/character-studio/package.json'),
    read('apps/review/src/main.js'),
    read('wrangler.dev.review.jsonc'),
    read('wrangler.dev.character-studio.jsonc'),
    read('ops-board/applications.mjs'),
    read('apps/rinne/review.html'),
  ]);
  assert.equal(JSON.parse(reviewPkg).appKind,'dev-tool');
  assert.equal(JSON.parse(studioPkg).appKind,'dev-tool');
  assert.match(reviewWrangler,/soul-lineage-review-dev/);
  assert.match(studioWrangler,/soul-lineage-character-studio-dev/);
  assert.match(reviewRoutes,/characters:DEV\.characters/);
  assert.match(reviewRoutes,/soul-lineage-character-studio-dev\.c-okamoto\.workers\.dev/);
  assert.match(applications,/fastDevTarget\('character-studio'/);
  assert.match(applications,/fastDevTarget\('review'/);
  assert.doesNotMatch(applications,/rinneDevToolTarget|dev\/rinne\/review\.html|dev\/rinne\/characters\.html/);
  assert.match(bridge,/data-review-bridge/);
  assert.match(bridge,/soul-lineage-review-dev\.c-okamoto\.workers\.dev/);
  assert.doesNotMatch(bridge,/data-review-target=/);
});

test('RINNE keeps only specialist runtime probes, not Character Studio ownership',async()=>{
  const [vite,routes]=await Promise.all([read('apps/rinne/vite.config.js'),read('apps/review/src/main.js')]);
  for(const entry of ['reviewMotion','reviewAssets','reviewObjects','reviewEffects','reviewSound','reviewBattle']){
    assert.match(vite,new RegExp(entry+':fileURLToPath'));
  }
  assert.doesNotMatch(vite,/characters(?:Advanced)?:fileURLToPath/);
  assert.match(routes,/motion:route\(DEV\.rinne,'review-motion\.html'\)/);
  assert.match(routes,/equipment:route\(DEV\.rinne,'review-assets\.html'\)/);
  assert.match(routes,/objects:route\(DEV\.rinne,'review-objects\.html'\)/);
  assert.match(routes,/effects:route\(DEV\.rinne,'review-effects\.html'\)/);
  assert.match(routes,/sounds:route\(DEV\.rinne,'review-sound\.html'\)/);
  assert.match(routes,/battle:route\(DEV\.rinne,'review-battle\.html'\)/);
});

test('GitHub Pages is not reintroduced as a DEV tool route',async()=>{
  const [applications,distribution]=await Promise.all([read('ops-board/applications.mjs'),read('docs/DISTRIBUTION_ARCHITECTURE.md')]);
  const toolSection=applications.slice(applications.indexOf("groups.set('character-studio'"),applications.indexOf('for (const env'));
  assert.doesNotMatch(toolSection,/charukun\.github\.io|PAGES_ROOT|rinneDevToolTarget/);
  assert.match(distribution,/GitHub Pages is not a DEV publisher/);
});
