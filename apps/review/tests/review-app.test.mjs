import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Visual Review Lab is independent and presentation review is not a gameplay learning event',()=>{
  const pkg=JSON.parse(read('package.json')),html=read('index.html');
  assert.equal(pkg.name,'@soul/review');assert.equal(pkg.appKind,'dev-tool');assert.match(html,/Visual Review Lab/);assert.match(html,/data-dev-tool="visual-review"/);assert.doesNotMatch(html,/<title>輪廻転焦 Visual Review/);
  assert.match(html,/技演出レビュー/);assert.match(html,/本編の閃き判定や保存データは変更しません/);assert.doesNotMatch(html,/<b>閃き確認<\/b>/);
});

test('Lab separates equipment and world-object probes and routes them to delivered runtimes',()=>{
  const source=read('src/main.js'),html=read('index.html');
  for(const host of ['soul-lineage-rinne-dev','soul-lineage-village-dev','soul-lineage-demon-dev','soul-lineage-character-studio-dev','rinne-ops'])assert.match(source,new RegExp(host));
  for(const page of ['review-motion.html','review-assets.html','review-objects.html','review-effects.html','review-sound.html','review-battle.html'])assert.match(source,new RegExp(page.replace('.','\\.')));
  assert.match(source,/characters:DEV\.characters/);for(const route of ['equipment','objects','sounds'])assert.match(html,new RegExp(`data-route="${route}"`));
  assert.match(source,/equipment:route\(DEV\.rinne,'review-assets\.html'\)/);assert.match(source,/objects:route\(DEV\.rinne,'review-objects\.html'\)/);assert.match(html,/<b>装備<\/b>/);assert.match(html,/<b>物体<\/b>/);assert.doesNotMatch(html,/<b>装備・物体<\/b>/);
});
