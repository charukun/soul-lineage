import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function shellHarness({hasHeader=true,duplicate=false}={}){
  const headerListeners=new Map(),windowListeners=new Map();let options,focused=0,destroyed=0;
  const header={addEventListener:(k,f)=>headerListeners.set(k,f),removeEventListener:(k,f)=>{assert.equal(headerListeners.get(k),f);headerListeners.delete(k);}};
  const mounted={root:{open:true,querySelector:()=>({focus:()=>focused++})},destroy:()=>destroyed++};
  const doc={querySelector:selector=>{assert.equal(selector,'.review-surface__header');return hasHeader?header:null;}};
  const win={location:{href:'https://preview.example/battle2?evidence=1'},addEventListener:(k,f)=>windowListeners.set(k,f),removeEventListener:(k,f)=>{assert.equal(windowListeners.get(k),f);windowListeners.delete(k);}};
  const source=read('src/battle2-shell.js').replace(/^import[^\n]+\n/,'').replace('export function mountBattle2ReviewShell','function mountBattle2ReviewShell');
  const context={URL,createReviewRoutes:({rinneBase,charactersBase})=>({characters:charactersBase,...Object.fromEntries(['motion','equipment','objects','effects','sounds','battle'].map((id,i)=>[id,new URL(['review-motion','review-assets','review-objects','review-effects','review-sound','review-battle'][i]+'.html',rinneBase).href]))}),mountReviewShell:value=>{options=value;return duplicate?null:mounted;}};
  runInNewContext(source,context);
  return {mount:()=>context.mountBattle2ReviewShell({doc,win}),headerListeners,windowListeners,mounted,get options(){return options;},get focused(){return focused;},get destroyed(){return destroyed;}};
}

test('battle2 nests native canvases inside the shared battle review frame',()=>{
  const html=read('battle2.html'),css=read('src/battle2.css'),stage=read('src/nocturne-stage.js'),sharedStage=read('../../packages/shared-ui/src/review/stage.js'),sharedControls=read('../../packages/shared-ui/src/review/controls.css');
  assert.match(html,/<main class="battle2-review review-surface review-workbench"/);
  assert.match(html,/<header class="battle-bar review-surface__header">[\s\S]*?review-surface__back[\s\S]*?<h1>序破急バトル<\/h1>[\s\S]*?<\/header>/);
  assert.match(html,/<section class="review-surface__workspace"[^>]*>\s*<div class="review-surface__stage-column">\s*<section class="nocturne-stage review-surface__stage"[^>]*data-review-surface="battle2"/);
  assert.equal((html.match(/<canvas\b/g)||[]).length,2);
  assert.match(html,/src="\.\/src\/battle2-shell\.js"/);assert.match(html,/src="\.\/src\/nocturne-stage\.js"/);
  assert.doesNotMatch(html,/<iframe\b|<select\b|<input\b|data-runtime-support|id="hud"/i);
  assert.equal((html.match(/data-battle-mode=/g)||[]).length,2);
  assert.equal((html.match(/review-surface__panel/g)||[]).length,0);
  assert.match(html,/data-review-stage-control data-battle-mode-control/);
  assert.match(stage,/mountReviewStageControls/);assert.match(stage,/groups:\['\[data-battle-mode-control\]'\]/);assert.match(stage,/label:'戦闘設定'/);
  assert.match(sharedStage,/review-stage-controls__button','⚙'/);assert.match(sharedControls,/\.review-stage-controls\{position:absolute;z-index:32;right:/);
  assert.match(css,/main\.battle2-review\.review-surface>\.review-surface__workspace\s*\{\s*grid-template-columns:minmax\(0,1fr\)!important;\s*grid-template-rows:minmax\(0,1fr\)!important;/);
  assert.match(css,/\.battle-stage-switch\[data-review-stage-control\]\{display:none\}/);assert.match(css,/\.review-stage-controls__panel>\.battle-stage-switch/);
  assert.doesNotMatch(css,/position:\s*fixed/);assert.match(css,/height:\s*100dvh/);
  assert.match(css,/review-switcher__grid\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});

test('shared switcher highlights battle2 and retains canonical routes and a local Lab back link',()=>{
  const h=shellHarness();assert.equal(h.mount(),h.mounted);
  assert.equal(h.options.current,'battle2');assert.equal(h.options.homeHref,'https://preview.example/');
  assert.equal(Object.keys(h.options.routes).length,9);assert.ok(Object.isFrozen(h.options.routes));
  assert.equal(h.options.routes.battle2,'https://preview.example/battle2');
  assert.equal(h.options.routes.battlebk,'https://preview.example/battlebk');
  assert.equal(h.options.routes.battle,'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/review-battle');
  assert.ok(Object.values(h.options.routes).every(href=>!new URL(href).pathname.endsWith('.html')));
});

test('Escape closes navigation; bfcache keeps the shell until actual page teardown',()=>{
  const h=shellHarness();h.mount();h.headerListeners.get('keydown')({key:'Escape'});
  assert.equal(h.mounted.root.open,false);assert.equal(h.focused,1);
  h.windowListeners.get('pagehide')({persisted:true});assert.equal(h.destroyed,0);
  h.windowListeners.get('pagehide')({persisted:false});assert.equal(h.destroyed,1);
  assert.equal(h.headerListeners.size,0);assert.equal(h.windowListeners.size,0);
});

test('missing or already mounted headers never attach duplicate listeners',()=>{
  for(const options of [{hasHeader:false},{duplicate:true}]){
    const h=shellHarness(options);assert.equal(h.mount(),null);assert.equal(h.headerListeners.size,0);assert.equal(h.windowListeners.size,0);
  }
});
