import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Visual Review Lab is independent and exposes seven focused probes',()=>{
  const pkg=JSON.parse(read('package.json')),html=read('index.html');
  assert.equal(pkg.name,'@soul/review');assert.equal(pkg.appKind,'dev-tool');assert.match(html,/Visual Review Lab/);assert.match(html,/data-dev-tool="visual-review"/);assert.match(html,/7 PROBES/);
});

test('legacy battle and battlebk routes are gone; battle2 is the only battle probe',()=>{
  const config=read('src/review-lab-config.js'),manifest=read('../../packages/shared-ui/src/review/manifest.js'),icons=read('src/review-lab-icons.js'),vite=read('vite.config.js');
  assert.match(manifest,/id:'battle2',label:'序破急バトル'/);assert.doesNotMatch(manifest,/id:'battle',label:'戦闘演出'/);assert.doesNotMatch(manifest,/id:'battlebk'/);assert.doesNotMatch(manifest,/review-battle/);
  assert.match(config,/battle2:new URL\('\.\/battle2'/);assert.doesNotMatch(config,/battlebk|\['effects','battle','battle2'/);assert.match(config,/REVIEW_WARM_ORDER=Object\.freeze\(\['effects','battle2','motion'/);
  assert.match(icons,/battle2:/);assert.doesNotMatch(icons,/\n\s*battle:/);assert.doesNotMatch(icons,/battlebk:/);
  assert.match(vite,/battle2:fileURLToPath/);assert.doesNotMatch(vite,/battlebk/);
});

test('battle2 has native canvases, no hidden UI shim, and a native inspiration cue',()=>{
  const page=read('battle2.html'),runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8'),boot=read('src/nocturne-stage.js'),vite=read('vite.config.js');
  assert.match(page,/data-review-surface="battle2"/);assert.match(page,/data-runtime="nocturne-native"/);for(const id of ['world','effects'])assert.match(page,new RegExp('<canvas id="'+id+'"'));
  assert.match(page,/id="battle2-inspiration"/);assert.match(page,/src="\.\/src\/nocturne-stage\.js"/);assert.doesNotMatch(page,/<iframe\b|<select\b|<input\b|data-runtime-support|id="hud"/i);
  assert.doesNotMatch(runtime,/ctx\.(?:fillText|strokeText)\(|nocturne-autobattle\.c-okamoto|addEventListener\(['"](?:pointerdown|keydown)/);
  for(const state of ['BOOT','ASSET_LOADING','BATTLE','RESETTING','ERROR'])assert.ok((boot+runtime).includes(state));
  assert.match(boot,/learnTechnique\(row\.techniqueId,row\.phase\)/);assert.match(boot,/即時セット・初回発動/);assert.match(vite,/battle2:fileURLToPath\(new URL\('\.\/battle2\.html'/);
});
