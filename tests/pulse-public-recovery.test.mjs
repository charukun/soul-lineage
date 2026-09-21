import test from 'node:test';
import assert from 'node:assert/strict';
import { createGithubClient, PUBLIC_REQUEST_CAP } from '../ops-board/github-client.mjs';
import { buildState } from '../ops-board/collector.mjs';

const develop='d'.repeat(40),main='a'.repeat(40);
const manifest={schemaVersion:1,entries:[],environmentSnapshots:{}};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','x-ratelimit-remaining':'55'}});
function appFromHost(host){
  if(host==='rinne-ops.c-okamoto.workers.dev')return 'pulse';
  return host.replace(/^soul-lineage-/,'').replace(/-dev\.c-okamoto\.workers\.dev$/,'');
}
function recoveryFetch(calls){
  return async (input,options={})=>{
    const url=new URL(input);
    if(url.hostname==='charukun.github.io')return json(manifest);
    if(url.hostname==='api.github.com'){
      calls.push({url:url.pathname+url.search,authorization:new Headers(options.headers||{}).get('authorization')});
      if(url.pathname.endsWith('/branches'))return json([{name:'develop',commit:{sha:develop}},{name:'main',commit:{sha:main}}]);
      if(url.pathname.endsWith('/pulls'))return json([]);
      if(url.pathname.endsWith('/actions/runs'))return json({workflow_runs:[]});
      if(url.pathname.endsWith('/status'))return json({statuses:[]});
      throw new Error('unexpected github route '+url);
    }
    if(url.pathname.endsWith('/version.json'))return json({app:appFromHost(url.hostname),environment:'dev',commit:develop,builtAt:'2026-09-22T00:00:00Z'});
    throw new Error('unexpected route '+url);
  };
}

test('public GitHub client is opt-in, bounded and sends no authorization header',async()=>{
  const calls=[];
  const client=createGithubClient({allowPublic:true,maxRequests:2,fetchImpl:async(input,options)=>{calls.push(new Headers(options.headers||{}));return json([]);}});
  await client.get('/branches');
  await client.get('/actions/runs');
  await assert.rejects(client.get('/pulls'),/取得予算/);
  assert.equal(client.scope,'public');
  assert.equal(client.maxRequests,2);
  assert.ok(calls.every(headers=>headers.get('authorization')===null));
  assert.equal(PUBLIC_REQUEST_CAP,6);
});

test('cold-start public recovery reconstructs useful PULSE state without deep GitHub traversal',async()=>{
  const calls=[];
  const state=await buildState(null,{fetchImpl:recoveryFetch(calls),token:'',reason:'cold-start-public',publicRecovery:true});
  assert.equal(state.syncStatus,'ok');
  assert.equal(state.githubApi.scope,'public');
  assert.equal(state.pullSync.mode,'public-recovery');
  assert.equal(state.pullRequests.truncated,true);
  assert.ok(state.applications.filter(app=>['game','tool','reference','control'].includes(app.kind)).every(app=>app.targets[0].state==='success'));
  assert.ok(calls.length<=4,'public recovery must stay within four GitHub requests in the empty-state fixture');
  assert.ok(calls.every(call=>call.authorization===null));
});
