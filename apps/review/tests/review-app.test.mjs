import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Visual Review Lab is independent and presentation review is not a gameplay learning event',()=>{
  const pkg=JSON.parse(read('package.json')),html=read('index.html');
  assert.equal(pkg.name,'@soul/review');assert.equal(pkg.appKind,'dev-tool');assert.match(html,/Visual Review Lab/);assert.match(html,/data-dev-tool="visual-review"/);assert.doesNotMatch(html,/<title>輪廻転焦 Visual Review/);
  assert.doesNotMatch(html,/<b>閃き確認<\/b>/);assert.match(html,/9 PROBES/);
});

test('Lab separates review probes and keeps delivered runtime routes canonical',()=>{
  const source=read('src/main.js'),html=read('index.html');
  for(const host of ['soul-lineage-rinne-dev','soul-lineage-village-dev','soul-lineage-demon-dev','soul-lineage-character-studio-dev','rinne-ops'])assert.match(source,new RegExp(host));
  for(const page of ['review-motion','review-assets','review-objects','review-effects','review-sound','review-battle'])assert.match(source,new RegExp(page));
  assert.match(source,/charactersBase:DEV\.characters/);for(const route of ['equipment','objects','sounds'])assert.match(source,new RegExp(`${route}:route\\(DEV\\.rinne`));
  assert.match(source,/equipment:route\(DEV\.rinne,'review-assets'\)/);assert.match(source,/objects:route\(DEV\.rinne,'review-objects'\)/);assert.match(source,/renderReviewProbeLinks/);assert.doesNotMatch(html,/<b>装備・物体<\/b>/);
  assert.match(source,/WARM_ORDER=Object\.freeze\(\['effects','battle','battle2','motion','characters','equipment','objects','sounds'\]\)/);
  assert.match(source,/prefetch\.rel='prefetch'/);assert.match(source,/prefetch\.as='document'/);assert.match(source,/startPriorityWarmup\(\)/);
  for(const term of ['VFX_WARM_ASSETS','effekseer.wasm','Simple_Ribbon_Sword.efkefc','ToonHit.efkefc','warmVfxAssets()'])assert.ok(source.includes(term));
  assert.match(source,/pointerenter'.*warmRoute/);assert.match(source,/touchstart'.*warmRoute/);
});

test('battle2 has native canvases, no hidden UI shim, no HUD drawing or gameplay controls',()=>{
  const source=read('src/main.js'),page=read('battle2.html'),runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8'),boot=read('src/nocturne-stage.js'),vite=read('vite.config.js');
  assert.match(source,/battle2:new URL\('\.\/battle2',location\.href\)\.href/);
  assert.match(page,/data-review-surface="battle2"/);assert.match(page,/data-runtime="nocturne-native"/);
  for(const id of ['world','effects'])assert.match(page,new RegExp('<canvas id="'+id+'"'));
  assert.match(page,/src="\.\/src\/nocturne-stage\.js"/);
  assert.doesNotMatch(page,/<iframe\b|<button\b|<input\b|<select\b|<dialog\b|data-runtime-support|id="hud"/i);
  assert.doesNotMatch(runtime,/\$\(|ctx\.(?:fillText|strokeText)\(|nocturne-autobattle\.c-okamoto|addEventListener\(['"](?:pointerdown|keydown)/);
  for(const name of ['function startAttack','Death_C_Skeletons','function castBurst','function ending','function simulate','function destroy','renderer.setAnimationLoop(frame)'])assert.ok(runtime.includes(name),name);
  assert.match(runtime,/game\.resetSeconds-=dt/);assert.doesNotMatch(runtime,/setTimeout\([^\n]*start/);
  for(const state of ['BOOT','ASSET_LOADING','BATTLE','RESETTING','ERROR'])assert.ok((boot+runtime).includes(state));
  assert.match(boot,/status\.hidden=false/);assert.match(boot,/runtime\?\.destroy\(\)/);
  assert.match(vite,/battle2:fileURLToPath\(new URL\('\.\/battle2\.html'/);
});
