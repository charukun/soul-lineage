import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyOutbox } from '../scripts/integration-rescue-return.mjs';
import { REPOSITORY, newState } from '../scripts/integration-rescue-policy.mjs';

const oldHead='a'.repeat(40), newHead='b'.repeat(40), now='2026-09-15T04:00:00.000Z';

function pr(number,head,{state='open',draft=false}={}){
  return {number,state,draft,head:{sha:head,ref:`feat/${number}`,repo:{full_name:REPOSITORY}},base:{ref:'develop',repo:{full_name:REPOSITORY}}};
}
function memoryStore(state){
  return {
    config:state.config,
    async read(){return{state:structuredClone(state)};},
    async mutate(fn){const result=fn(state);return{result,state:structuredClone(state)};},
    state,
  };
}
function client(prs){
  const calls=[];
  return {calls,root:`/repos/${REPOSITORY}`,
    async api(method,path,body){
      calls.push({method,path,body});
      const match=path.match(/\/pulls\/(\d+)$/);
      if(method==='GET'&&match)return structuredClone(prs[Number(match[1])]);
      if(method==='POST'&&/\/issues\/\d+\/comments$/.test(path))return{id:calls.length};
      throw new Error(`Unexpected ${method} ${path}`);
    },
    async pages(path){
      if(/\/issues\/\d+\/comments$/.test(path))return[];
      throw new Error(`Unexpected pages ${path}`);
    },
  };
}

function failedState({head=oldHead,stateName='FAILED_MANUAL',reason='INTEGRATION_RETURN_STALLED'}={}){
  const state=newState();
  state.records[220]={pr:220,rescueId:'rescue-220-a1',state:stateName,headSha:head,pushedSha:head,failureReason:reason,attempt:1,maxAttempts:3,
    workRepair:{status:'human-required',reason:'fixture'}};
  state.outbox.push({id:'rescue-220-a1:manual:1',type:'manual',pr:220,reason,attempt:1,maxAttempts:3});
  return state;
}

test('old manual failure is suppressed after the Rescue record has returned to Integration',async()=>{
  const state=failedState({head:newHead,stateName:'CHECKING'}),store=memoryStore(state),c=client({220:pr(220,newHead)});
  await notifyOutbox(c,store);
  assert.equal(state.outbox[0].channel,'suppressed-stale');
  assert.equal(state.outbox[0].suppressionReason,'manual-state-superseded');
  assert.ok(state.outbox[0].suppressedAt);
  assert.equal(state.outbox[0].notificationAttempts,undefined);
});

test('manual failure is suppressed when GitHub has already advanced the PR head',async()=>{
  const state=failedState(),store=memoryStore(state),c=client({220:pr(220,newHead)});
  await notifyOutbox(c,store);
  assert.equal(state.outbox[0].suppressionReason,'manual-head-superseded');
  assert.equal(state.outbox[0].liveHead,newHead);
});

test('current exact-head manual failure records a GitHub PR notice without external push',async()=>{
  const state=failedState(),store=memoryStore(state),c=client({220:pr(220,oldHead)});
  await notifyOutbox(c,store);
  const posted=c.calls.find(call=>call.method==='POST'&&call.path.endsWith('/issues/220/comments'));
  assert.ok(posted);
  assert.match(posted.body.body,/FAILED/);
  assert.match(posted.body.body,/PR: #220/);
  assert.equal(state.outbox[0].channel,'github-pr');
  assert.ok(state.outbox[0].sentAt);
  assert.equal(state.outbox[0].suppressedAt,undefined);
});

test('transient GitHub freshness read keeps the existing finite retry path',async()=>{
  const state=failedState(),store=memoryStore(state),c={root:`/repos/${REPOSITORY}`,
    async api(){throw new Error('GitHub GET /pulls/220: HTTP 502');},
    async pages(path){throw new Error(`Unexpected pages ${path}`);},
  };
  await notifyOutbox(c,store);
  assert.equal(state.outbox[0].suppressedAt,undefined);
  assert.equal(state.outbox[0].notificationAttempts,1);
  assert.match(state.outbox[0].notificationError,/HTTP 502/);
  assert.ok(state.outbox[0].nextNotificationAt);
});

test('wave summary stays in PULSE and omits returned members whose live head is stale',async()=>{
  const state=newState();
  state.waves=[{id:'wave-1',rescueIds:['r1','r2'],completedAt:now}];
  state.records[1]={pr:1,rescueId:'r1',state:'CHECKING',headSha:oldHead,pushedSha:oldHead,returnedAt:now};
  state.records[2]={pr:2,rescueId:'r2',state:'CHECKING',headSha:oldHead,pushedSha:oldHead,returnedAt:now};
  state.outbox=[{id:'wave-1:summary',type:'wave',wave:'wave-1',prs:[1,2],manual:[]}];
  const store=memoryStore(state),c=client({1:pr(1,oldHead),2:pr(2,newHead)});
  await notifyOutbox(c,store);
  assert.equal(state.outbox[0].channel,'pulse-summary');
  assert.equal(c.calls.some(call=>call.method==='POST'&&/\/issues\//.test(call.path)),false);
});

test('wave summary is suppressed when every returned head is stale',async()=>{
  const state=newState();
  state.waves=[{id:'wave-1',rescueIds:['r1'],completedAt:now}];
  state.records[1]={pr:1,rescueId:'r1',state:'CHECKING',headSha:oldHead,pushedSha:oldHead,returnedAt:now};
  state.outbox=[{id:'wave-1:summary',type:'wave',wave:'wave-1',prs:[1],manual:[]}];
  const store=memoryStore(state),c=client({1:pr(1,newHead)});
  await notifyOutbox(c,store);
  assert.equal(state.outbox[0].channel,'suppressed-stale');
  assert.equal(state.outbox[0].suppressionReason,'wave-returned-heads-superseded');
});
