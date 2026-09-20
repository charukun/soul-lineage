import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sourceOrEmpty=value=>String(value||'');

test('Visual Review Lab is independent and presentation review is not a gameplay learning event',()=>{
  const pkg=JSON.parse(read('package.json')),html=read('index.html');
  assert.equal(pkg.name,'@soul/review');assert.equal(pkg.appKind,'dev-tool');assert.match(html,/Visual Review Lab/);assert.match(html,/data-dev-tool="visual-review"/);assert.doesNotMatch(html,/<title>輪廻転焦 Visual Review/);
  assert.match(sourceOrEmpty(html),/Visual Review Lab/);assert.doesNotMatch(html,/<b>閃き確認<\/b>/);assert.match(html,/8 PROBES/);
});

test('Lab separates review probes and keeps delivered runtime routes canonical',()=>{
  const source=read('src/main.js'),html=read('index.html');
  for(const host of ['soul-lineage-rinne-dev','soul-lineage-village-dev','soul-lineage-demon-dev','soul-lineage-character-studio-dev','rinne-ops'])assert.match(source,new RegExp(host));
  for(const page of ['review-motion','review-assets','review-objects','review-effects','review-sound','review-battle'])assert.match(source,new RegExp(page));
  assert.match(source,/charactersBase:DEV\.characters/);for(const route of ['equipment','objects','sounds'])assert.match(source,new RegExp(`${route}:route\\(DEV\\.rinne`));
  assert.match(source,/equipment:route\(DEV\.rinne,'review-assets'\)/);assert.match(source,/objects:route\(DEV\.rinne,'review-objects'\)/);assert.match(source,/renderReviewProbeLinks/);assert.doesNotMatch(html,/<b>装備・物体<\/b>/);
  assert.match(source,/WARM_ORDER=Object\.freeze\(\['effects','battle','battle2','motion','characters','equipment','objects','sounds'\]\)/);
  assert.match(source,/prefetch\.rel='prefetch'/);assert.match(source,/prefetch\.as='document'/);assert.match(source,/startPriorityWarmup\(\)/);
  assert.match(source,/VFX_WARM_ASSETS/);assert.match(source,/effekseer\.wasm/);assert.match(source,/Simple_Ribbon_Sword\.efkefc/);assert.match(source,/ToonHit\.efkefc/);assert.match(source,/warmVfxAssets\(\)/);
  assert.match(source,/pointerenter'.*warmRoute/);assert.match(source,/touchstart'.*warmRoute/);
});

test('battle presentation 2 runs the native Nocturne combat runtime with no visible review controls',()=>{
  const source=read('src/main.js'),page=read('battle2.html'),runtime=read('src/nocturne-stage.js'),vite=read('vite.config.js');
  assert.match(source,/battle2:new URL\('\.\/battle2\.html',location\.href\)\.href/);
  assert.match(page,/data-review-surface="battle2"/);
  assert.match(page,/data-runtime="nocturne-native"/);
  assert.match(page,/<canvas id="world"/);
  assert.match(page,/<canvas id="effects"/);
  assert.match(page,/src="\.\/src\/nocturne-stage\.js"/);
  assert.match(page,/data-runtime-support aria-hidden="true"/);
  assert.doesNotMatch(page,/<iframe\b/i);
  assert.match(runtime,/NOCTURNE_ASSET_ORIGIN/);
  assert.match(runtime,/function startAttack/);
  assert.match(runtime,/Death_C_Skeletons/);
  assert.match(runtime,/function castBurst/);
  assert.match(runtime,/game\.ready=true;start\(\)/);
  assert.match(runtime,/setTimeout\(\(\)=>\{if\(game\.ready\)start\(\);\},1000\)/);
  assert.match(vite,/battle2:fileURLToPath\(new URL\('\.\/battle2\.html'/);
});
