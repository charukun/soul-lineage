import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectBrowserTargets} from '../scripts/browser/target-contract.mjs';
import {capturePlayedAudio,mediaDiagnostics} from '../scripts/browser/media-diagnostics.mjs';
const entries=['dev','staging','prod'].flatMap(environment=>['rinne','village','demon'].map(app=>({environment,app,path:`${environment}/${app}`})));
const all=entries.map(e=>e.path);
test('develop stage checks changed DEV even when bootstrap lists other environments',()=>{
 assert.deepEqual(selectBrowserTargets(entries,{changed:all,ref:'refs/heads/develop'}).map(e=>e.path),all.slice(0,3));
});
test('main stage still checks every changed Production app',()=>{
 assert.deepEqual(selectBrowserTargets(entries,{changed:all,ref:'refs/heads/main'}).map(e=>e.path),all.slice(6));
});
test('focused mode preserves exact changed-app selection',()=>{
 assert.deepEqual(selectBrowserTargets(entries,{changed:['dev/demon','prod/rinne'],ref:'refs/heads/develop'}).map(e=>e.path),['dev/demon']);
 assert.deepEqual(selectBrowserTargets(entries,{changed:['dev/demon','prod/rinne'],ref:'refs/heads/main'}).map(e=>e.path),['prod/rinne']);
});
test('full DEV mode checks all DEV apps; explicit local lists retain staging',()=>{
 assert.deepEqual(selectBrowserTargets(entries,{full:true}).map(e=>e.path),all.slice(0,3));
 assert.deepEqual(selectBrowserTargets(entries,{changed:['staging/village']}).map(e=>e.path),['staging/village']);
});
test('verification-required DEV retry checks reused assets instead of reporting an empty browser success',()=>{
 for(const changed of [[],['staging/rinne']])assert.deepEqual(selectBrowserTargets(entries,{changed,ref:'refs/heads/develop'}).map(e=>e.path),all.slice(0,3));
 assert.throws(()=>selectBrowserTargets([],{ref:'refs/heads/develop'}),/No DEV browser targets/);
 assert.deepEqual(selectBrowserTargets(entries,{changed:[],ref:'refs/heads/main'}),[]);
});
test('successful playback evidence requires progress, decoded data and no media error',async()=>{
 const players=[{currentSrc:'good',currentTime:1,readyState:2,error:null},{currentSrc:'unplayed',currentTime:0,readyState:4,error:null},{currentSrc:'undecoded',currentTime:1,readyState:1,error:null},{currentSrc:'bad',currentTime:1,readyState:4,error:{code:3}}];
 const page={locator:()=>({evaluateAll:async fn=>fn(players)})},set=new Set();
 await capturePlayedAudio(page,set);assert.deepEqual([...set],['good']);
});
test('diagnostics reuse exact range-abort contract and retain all unexpected failures',async()=>{
 const origin='https://local.test',url=`blob:${origin}/music`;
 const request=(patch={})=>({url:()=>url,method:()=> 'GET',resourceType:()=> 'media',failure:()=>({errorText:'net::ERR_ABORTED'}),response:async()=>({status:()=>206,headers:()=>({'content-type':'audio/ogg'})}),...patch});
 const result=await mediaDiagnostics([request(),request({url:()=>`${origin}/missing.ogg`}),request({response:async()=>null})],new Set([url]),origin);
 assert.equal(result.requestFailures.length,3);assert.equal(result.expectedMediaAborts.length,1);assert.equal(result.failedRequests.length,2);
 assert.equal((await mediaDiagnostics([request()],new Set(),origin)).failedRequests.length,1);
});
test('playback captured before reload survives a new document without accepting unplayed blobs',async()=>{
 const origin='https://local.test',old=`blob:${origin}/old`,next=`blob:${origin}/new`,sources=new Set();
 let players=[{currentSrc:old,currentTime:3,readyState:4,error:null}];
 const page={locator:()=>({evaluateAll:async fn=>fn(players)})};
 await capturePlayedAudio(page,sources);
 players=[{currentSrc:next,currentTime:0,readyState:4,error:null}];
 await capturePlayedAudio(page,sources);
 const request=url=>({url:()=>url,method:()=> 'GET',resourceType:()=> 'media',failure:()=>({errorText:'net::ERR_ABORTED'}),response:async()=>({status:()=>206,headers:()=>({'content-type':'audio/ogg'})})});
 const result=await mediaDiagnostics([request(old),request(next)],sources,origin);
 assert.deepEqual(result.expectedMediaAborts.map(x=>x.url),[old]);
 assert.deepEqual(result.failedRequests.map(x=>x.url),[next]);
 const source=readFileSync(new URL('../scripts/browser/public.spec.mjs',import.meta.url),'utf8');
 assert.match(source,/await capturePlayedAudio\(page, playedSources\);\s+await page.reload\(\)/);
});
test('separated audio case retains 150 tracks, decoding, progress, pause and Production absence checks',()=>{
 const source=readFileSync(new URL('../scripts/browser/public-music.mjs',import.meta.url),'utf8');
 for(const text of ['toHaveCount(150)','playing.error','playing.ready','playing.paused','player.currentTime','data-stop','toBe(\'undefined\')','toHaveCount(0)','test.setTimeout(60000)'])assert.ok(source.includes(text),text);
});
