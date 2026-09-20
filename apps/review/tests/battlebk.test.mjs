import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const snapshot=JSON.parse(read('src/battlebk-snapshot.json'));
const blobHash=text=>createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');

test('battlebk owns a byte-identical snapshot of the source runtime, audio, environment and provenance',()=>{
  assert.equal(snapshot.sourceCommit,'ceadbff4b3d49b67a21637873bff6defcfee799e');
  assert.deepEqual(readdirSync(new URL('../src/nocturne-bk/',import.meta.url)).sort(),Object.keys(snapshot.runtimeBlobs).sort());
  for(const [path,sha] of Object.entries(snapshot.runtimeBlobs))assert.equal(blobHash(read('src/nocturne-bk/'+path)),sha,path);
  const manifest=JSON.parse(read('src/nocturne-bk/manifest.json'));
  assert.equal(Object.keys(manifest.models).length,28);
  for(const row of manifest.files){assert.doesNotMatch(row.path,/^(?:[a-z]+:|\/)|(?:^|\/)\.\.(?:\/|$)/i);assert.match(row.sha256,/^[a-f0-9]{64}$/);assert.ok(row.byteLength>0);}
  assert.doesNotMatch(read('src/nocturne-bk-stage.js'),/import\(['"]\.\/nocturne\//);
});

test('copied stage, frame and CSS differ only in backup-specific names and module paths',()=>{
  const normalize=text=>text.replaceAll('戦闘演出bk','戦闘演出2').replaceAll('battlebk','battle2').replaceAll('__BATTLEBK__','__BATTLE2__').replaceAll('nocturne-bk','nocturne');
  for(const [backup,original] of [['battlebk.html','battle2.html'],['src/battlebk.css','src/battle2.css'],['src/nocturne-bk-stage.js','src/nocturne-stage.js']])assert.equal(blobHash(normalize(read(backup))),snapshot.sourceBlobs[original],backup);
  const html=read('battlebk.html');
  assert.match(html,/<h1>戦闘演出bk<\/h1>/);assert.match(html,/data-review-surface="battlebk"/);
  assert.equal((html.match(/<canvas\b/g)||[]).length,2);
  assert.doesNotMatch(html,/<iframe\b|<button\b|<select\b|<input\b|review-surface__panel|id="hud"/i);
  assert.match(read('src/nocturne-bk-stage.js'),/window\.__BATTLEBK__=Object\.freeze/);
});

test('Lab registers one extensionless backup route and builds both independent entry points',()=>{
  assert.match(read('src/main.js'),/battlebk:new URL\('\.\/battlebk',location\.href\)\.href/);
  assert.match(read('index.html'),/9 PROBES/);
  assert.equal(snapshot.publicPath,'/battlebk');
  for(const id of ['battle2','battlebk'])assert.ok(read('vite.config.js').includes(id+":fileURLToPath(new URL('./"+id+".html'"));
  const shared=readFileSync(new URL('../../../packages/shared-ui/src/review-shell.js',import.meta.url),'utf8');
  const context={};runInNewContext(shared.replace(/^import[^\n]+\n/,'').replaceAll('export ','')+'\nresult=REVIEW_PROBES;',context);
  assert.equal(context.result.length,9);
  assert.deepEqual(Array.from(context.result.slice(-3),p=>[p.id,p.label]),[['battle','戦闘演出'],['battle2','序破急バトルシステム'],['battlebk','戦闘演出bk']]);
});

test('backup switcher selects itself, links to the original, and preserves Escape/teardown behavior',()=>{
  const headerListeners=new Map(),windowListeners=new Map();let options,focused=0,destroyed=0;
  const header={addEventListener:(key,fn)=>headerListeners.set(key,fn),removeEventListener:(key,fn)=>{assert.equal(headerListeners.get(key),fn);headerListeners.delete(key);}};
  const mounted={root:{open:true,querySelector:()=>({focus:()=>focused++})},destroy:()=>destroyed++};
  const doc={querySelector:()=>header};
  const win={location:{href:'https://preview.example/battlebk?evidence=1'},addEventListener:(key,fn)=>windowListeners.set(key,fn),removeEventListener:(key,fn)=>{assert.equal(windowListeners.get(key),fn);windowListeners.delete(key);}};
  const context={URL,createReviewRoutes:({rinneBase,charactersBase})=>({characters:charactersBase,...Object.fromEntries(['motion','equipment','objects','effects','sounds','battle'].map((id,i)=>[id,new URL(['review-motion','review-assets','review-objects','review-effects','review-sound','review-battle'][i]+'.html',rinneBase).href]))}),mountReviewShell:value=>{options=value;return mounted;}};
  runInNewContext(read('src/battlebk-shell.js').replace(/^import[^\n]+\n/,'').replace('export function mountBattlebkReviewShell','function mountBattlebkReviewShell'),context);
  assert.equal(context.mountBattlebkReviewShell({doc,win}),mounted);
  assert.equal(options.current,'battlebk');assert.equal(options.homeHref,'https://preview.example/');
  assert.equal(Object.keys(options.routes).length,9);assert.ok(Object.isFrozen(options.routes));
  assert.equal(options.routes.battle2,'https://preview.example/battle2');assert.equal(options.routes.battlebk,'https://preview.example/battlebk');
  assert.ok(Object.values(options.routes).every(href=>!new URL(href).pathname.endsWith('.html')));
  headerListeners.get('keydown')({key:'Escape'});assert.equal(mounted.root.open,false);assert.equal(focused,1);
  windowListeners.get('pagehide')({persisted:true});assert.equal(destroyed,0);
  windowListeners.get('pagehide')({persisted:false});assert.equal(destroyed,1);assert.equal(headerListeners.size,0);assert.equal(windowListeners.size,0);
});
