import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sourceOrEmpty=value=>String(value||'');

test('Visual Review Lab is independent and presentation review is not a gameplay learning event',()=>{
  const pkg=JSON.parse(read('package.json')),html=read('index.html');
  assert.equal(pkg.name,'@soul/review');assert.equal(pkg.appKind,'dev-tool');assert.match(html,/Visual Review Lab/);assert.match(html,/data-dev-tool="visual-review"/);assert.doesNotMatch(html,/<title>輪廻転焦 Visual Review/);
  assert.match(sourceOrEmpty(html),/Visual Review Lab/);assert.doesNotMatch(html,/<b>閃き確認<\/b>/);
});

test('Lab separates equipment and world-object probes and routes them to delivered runtimes',()=>{
  const source=read('src/main.js'),html=read('index.html');
  for(const host of ['soul-lineage-rinne-dev','soul-lineage-village-dev','soul-lineage-demon-dev','soul-lineage-character-studio-dev','rinne-ops'])assert.match(source,new RegExp(host));
  for(const page of ['review-motion.html','review-assets.html','review-objects.html','review-effects.html','review-sound.html','review-battle.html'])assert.match(source,new RegExp(page.replace('.','\\.')));
  assert.match(source,/charactersBase:DEV\.characters/);for(const route of ['equipment','objects','sounds'])assert.match(source,new RegExp(`${route}:route\\(DEV\\.rinne`));
  assert.match(source,/equipment:route\(DEV\.rinne,'review-assets\.html'\)/);assert.match(source,/objects:route\(DEV\.rinne,'review-objects\.html'\)/);assert.match(source,/renderReviewProbeLinks/);assert.doesNotMatch(html,/<b>装備・物体<\/b>/);
  assert.match(source,/WARM_ORDER=Object\.freeze\(\['effects','battle','motion','characters','equipment','objects','sounds'\]\)/);
  assert.match(source,/prefetch\.rel='prefetch'/);assert.match(source,/prefetch\.as='document'/);assert.match(source,/startPriorityWarmup\(\)/);
  assert.match(source,/VFX_WARM_ASSETS/);assert.match(source,/effekseer\.wasm/);assert.match(source,/Simple_Ribbon_Sword\.efkefc/);assert.match(source,/ToonHit\.efkefc/);assert.match(source,/warmVfxAssets\(\)/);
  assert.match(source,/pointerenter'.*warmRoute/);assert.match(source,/touchstart'.*warmRoute/);
});
