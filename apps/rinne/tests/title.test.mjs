import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const stateSource = await readFile(new URL('../src/title/state.js', import.meta.url), 'utf8');
// Legacy title state remains testable while the clean rebuild no longer boots through it.
const stateURL = 'data:text/javascript;base64,' + Buffer.from(stateSource).toString('base64');
const {transition, normalizeEnvironment, normalizedSettings, acceptsReadyMessage, acceptsFrameOrigin} = await import(stateURL);
const flows = [
 ['intro','reveal','title'],['title','enter','loading'],['intro','enter','loading'],
 ['loading','ready','playing'],['loading','fail','error'],['playing','fail','error'],
 ['playing','back','title'],['loading','back','title'],['error','retry','loading'],
 ['error','back','title'],['title','replay','intro'],['loading','enter','loading'],
 ['title','ready','title'],['error','ready','error'],
];
for (const [from,event,to] of flows) test(`legacy ${from} + ${event} = ${to}`, () => assert.equal(transition(from,event),to));
test('legacy unknown state rejects',()=>assert.throws(()=>transition('unknown','enter'),TypeError));
test('environments do not silently mix production and dev settings',()=>{assert.equal(normalizeEnvironment('production'),'prod');assert.equal(normalizeEnvironment('development'),'dev');assert.equal(normalizeEnvironment(undefined),'local');});
test('legacy preferences remain parseable for simulator compatibility',()=>{assert.deepEqual(normalizedSettings(null,true),{sound:true,reducedMotion:true});assert.deepEqual(normalizedSettings({sound:false,reducedMotion:false},true),{sound:false,reducedMotion:false});});
test('ready requires the specific pending request token',()=>{const data={channel:'rinne-title-v1',type:'ready',token:'nonce-123'};assert.equal(acceptsReadyMessage(data,'nonce-123'),true);assert.equal(acceptsReadyMessage(data,'different'),false);assert.equal(acceptsReadyMessage({...data,channel:'else'},'nonce-123'),false);assert.equal(acceptsReadyMessage({...data,type:'anything'},'nonce-123'),false);assert.equal(acceptsReadyMessage({...data,token:''},''),false);assert.equal(acceptsReadyMessage(null,'nonce-123'),false);});
test('legacy title state has no browser/SDK access',()=>assert.doesNotMatch(stateSource,/\b(window|document|localStorage|navigator|fetch)\s*\./));

test('100年人生 title is immediately interactive without eager game iframe',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<iframe\b/);assert.match(html,/>100年人生</);assert.match(html,/>輪廻転焦</);
 assert.match(html,/id="new-life"/);assert.match(html,/id="continue-life"/);assert.match(html,/href="\.\/simulator\/index\.html"/);assert.match(html,/viewport-fit=cover/);
 assert.doesNotMatch(html,/id="start-simulator"/);assert.doesNotMatch(html,/id="loading-progress"/);
});
test('clean bootstrap lazy-loads gameplay and has no fixed intro delay',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/import\('\.\/rebuild\/runtime\.js'\)/);
 assert.doesNotMatch(main,/from ['"]\.\/title\/controller\.js['"]/);assert.doesNotMatch(main,/from ['"]\.\/story\/controller\.js['"]/);
 assert.doesNotMatch(main,/setTimeout\([^)]*3800/);assert.doesNotMatch(main,/setTimeout\([^)]*650/);
});
test('swipe-first shell exposes conversation but no persistent attack/rest/action dock',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/id="talk"/);assert.doesNotMatch(html,/id="rest"/);assert.doesNotMatch(html,/id="context-action"/);assert.doesNotMatch(html,/>攻撃</);
});

test('all five bundled characters and thirteen clips remain available to the separate training surface',async()=>{const base=new URL('../public/simulator/',import.meta.url);const models=JSON.parse(await readFile(new URL('./assets/manifest.json',base),'utf8'));const motions=JSON.parse(await readFile(new URL('./assets/motions.json',base),'utf8'));assert.equal(models.length,5);assert.equal(motions.length,13);for(const asset of [...models,...motions]){const bytes=await readFile(new URL(asset.file,base));assert.equal(bytes.subarray(0,4).toString(),'glTF');}});

test('HTTPS never admits opaque or foreign legacy frame origin',()=>{assert.equal(acceptsFrameOrigin('null','https://example.test','https:',true),false);assert.equal(acceptsFrameOrigin('https://other.test','https://example.test','https:',false),false);assert.equal(acceptsFrameOrigin('https://example.test','https://example.test','https:',false),true);});
test('local legacy frame support is restricted to explicit offline adapter',()=>{assert.equal(acceptsFrameOrigin('null','content://downloads','content:',true),true);assert.equal(acceptsFrameOrigin('null','file://','file:',true),true);assert.equal(acceptsFrameOrigin('null','content://downloads','content:',false),false);assert.equal(acceptsFrameOrigin('https://evil.test','null','content:',true),false);});
test('legacy progress and asset requests still require channel and token',()=>{for(const type of ['progress','asset-request']){assert.equal(acceptsReadyMessage({channel:'rinne-title-v1',type,token:'expected-123'},'expected-123'),true);assert.equal(acceptsReadyMessage({channel:'rinne-title-v1',type,token:'stale-123'},'expected-123'),false);}});
test('separate simulator keeps its early error bridge',async()=>{const html=await readFile(new URL('../public/simulator/index.html',import.meta.url),'utf8');assert.ok(html.indexOf('src="./title-bridge.js"')<html.indexOf('type="module"'));assert.match(html,/function fatal\(e\)\{window\.__RINNE_BOOT__\?\.fail\(e\)/);});
