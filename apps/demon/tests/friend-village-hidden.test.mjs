import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {installOnlineRaid} from '../src/web/online.js';
const online=readFileSync(new URL('../src/web/online.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8');

test('real-player villages have no normal demon raid entry',()=>{
 assert.match(online,/friend-invite-only/);
 assert.doesNotMatch(online,/実プレイヤーの村/);
 assert.doesNotMatch(online,/role:\s*['"]demon['"]/);
 assert.doesNotMatch(online,/acceptHostOffer/);
 assert.doesNotMatch(main,/online-settings|実プレイヤーの村|onlineRaid\.open/);
});

test('legacy online adapter retains harmless lifecycle without DOM, storage or transport',()=>{
 const adapter=installOnlineRaid(()=>{throw Error('must not inspect player state');});
 assert.equal(adapter.enabled,false);assert.equal(adapter.reason,'friend-invite-only');
 for(const method of ['open','close','dispose']){assert.equal(typeof adapter[method],'function');assert.doesNotThrow(()=>{adapter[method]();adapter[method]();});}
 assert.equal(Object.isFrozen(adapter),true);
 assert.doesNotMatch(online,/localStorage|RTCPeerConnection|createElement|setInterval/);
});

test('latest settings still open and retain music and non-network actions',()=>{
 const elements=new Map();
 function element(id){const e={id,hidden:true,style:{},textContent:'',onclick:null,addEventListener(){}};let html='';
  Object.defineProperty(e,'innerHTML',{get:()=>html,set:value=>{html=value;for(const [,child]of value.matchAll(/id="([^"]+)"/g))if(!elements.has(child))elements.set(child,element(child));}});return e;}
 for(const id of ['move-pad','dash-stop','sheet','sheet-kicker','sheet-title','sheet-body'])elements.set(id,element(id));
 let musicOpened=0;
 const context={document:{getElementById:id=>elements.get(id)||null},window:{__SOUL_MUSIC__:{open:()=>musicOpened++}},SwipeInput:class{cancel(){}},NightAudio:class{enabled=true},console};
 const source=main.replace(/^import .*;\n/gm,'').replace('export async function boot','async function boot').replaceAll('import.meta.env.DEV','false');
 vm.runInNewContext(source+"\nstore={read:()=>({visits:{}})};settings();",context);
 assert.equal(elements.get('sheet').hidden,false);assert.equal(elements.get('sheet-title').textContent,'記録と連携');
 assert.equal(elements.has('online-settings'),false);
 for(const id of ['music-library','sound-toggle','visit-log','load-village','load-echo','credits'])assert.equal(typeof elements.get(id)?.onclick,'function',id);
 elements.get('music-library').onclick();assert.equal(musicOpened,1);
 assert.match(main,/firstHuntGuide\(game,profile/);assert.match(main,/renderRaidRoutes\(offers,profile\)/);
 assert.match(main,/document\.hidden/);assert.match(main,/createExclusiveProfileStorage/);
});

test('browser gate enforces absent player-village entry instead of reopening it',()=>{
 const browser=readFileSync(new URL('../../../scripts/browser/play-clarity.mjs',import.meta.url),'utf8');
 assert.match(browser,/locator\('#online-settings'\)\)\.toHaveCount\(0\)/);
 assert.match(browser,/locator\('#online-box'\)\)\.toHaveCount\(0\)/);
 assert.doesNotMatch(browser,/locator\('#online-settings'\)\.click/);
 assert.match(browser,/assertHuntGuideState\(page, expect, false\)/);
 assert.match(browser,/assertHuntGuideState\(page, expect, true\)/);
});
