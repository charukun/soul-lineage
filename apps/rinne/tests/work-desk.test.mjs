import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const page=readFileSync(new URL('../public/work-desk/index.html',import.meta.url),'utf8');
const script=page.match(/<script>([\s\S]*?)<\/script>/)[1];
const style=page.match(/<style>([\s\S]*?)<\/style>/)[1];
const policy=page.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const context=vm.createContext({URL});
vm.runInContext(script.split('/* BOOT */')[0]+'\nglobalThis.unit={stamp,safeUrl,normalizeSession,normalizeFeed,visualState,isOld,visibleSessions,relative,delivery};',context);
const u=context.unit,now=Date.parse('2026-09-12T00:00:00Z'),DAY=86400000;
const session=(id='a',props={})=>u.normalizeSession({id,title:'Task',state:'running',stateEvidence:'runtime',stateObservedAt:now,activityAt:now,canSend:true,...props},now);
const feed=(props={})=>({version:1,source:'chatgpt',connected:true,accountId:'test-account',coverage:'complete',capabilities:{sendToExistingSession:true},sessions:[],...props});

test('CSP authorizes only the exact inline code and same-origin broker',()=>{
 for(const [kind,content] of [['script',script],['style',style]])assert.ok(policy.includes(`${kind}-src 'sha256-${createHash('sha256').update(content).digest('base64')}'`));
 assert.ok(policy.includes("default-src 'none'"));assert.ok(policy.includes("connect-src 'self'"));assert.doesNotMatch(policy,/unsafe-inline|unsafe-eval|https:/);
});
test('landing screen has no branding, instructions, manual registry or settings',()=>{
 const body=page.split('<body>')[1].split('<script>')[0];
 assert.doesNotMatch(body,/WORK DESK|<h1|セッションを登録|台帳|使い方|利用方法|設定|インポート|エクスポート|GitHub/);
 assert.match(body,/続けて伝える/);assert.equal((body.match(/<textarea/g)||[]).length,1);
});
test('no local registry fallback, public task payload, model API or token scraping',()=>{
 assert.doesNotMatch(script,/localStorage|document\.cookie|api\.openai\.com|api\.github\.com|Bearer |access_token|backend-api|navigator\.clipboard|innerHTML/);
 assert.match(script,/same-origin/);assert.match(script,/redirect:'error'/);
});
test('missing account connection never normalizes to an empty connected feed',()=>{
 for(const p of [{},feed({connected:false}),feed({source:'github'}),feed({accountId:''}),feed({coverage:'guessed'})])assert.throws(()=>u.normalizeFeed(p,now));
 assert.equal(u.normalizeFeed(feed(),now).sessions.length,0);
});
test('the provider must explicitly confirm that it can send to existing sessions',()=>{
 assert.equal(u.normalizeFeed(feed(),now).canSend,true);
 assert.equal(u.normalizeFeed(feed({capabilities:{send:true}}),now).canSend,false);
});
test('partial snapshot stays visibly partial',()=>assert.equal(u.normalizeFeed(feed({coverage:'partial'}),now).coverage,'partial'));
test('invalid entries and duplicate ids reject a supposedly complete snapshot',()=>{
 assert.throws(()=>u.normalizeFeed(feed({sessions:[{id:'unsafe/id'}]}),now));
 assert.throws(()=>u.normalizeFeed(feed({sessions:[{id:'a'},{id:'a'}]}),now));
});
test('copies only allowlisted metadata',()=>{
 const s=u.normalizeSession({id:'a',state:'unknown',mapping:{private:'text'},apiKey:'secret'},now);
 assert.ok(!('mapping' in s));assert.ok(!('apiKey' in s));assert.equal(s.canSend,false);
});
test('unknown states are never interpreted as running or complete',()=>{
 assert.equal(session('a',{state:'finished'}).state,'unknown');
 assert.equal(u.visualState(session('a',{state:'done',stateEvidence:'runtime'}),now),'unknown');
 assert.equal(u.visualState(session('a',{state:'done',stateEvidence:'assistant_report'}),now),'unknown');
 assert.equal(u.visualState(session('a',{state:'done',stateEvidence:'verified_task'}),now),'done');
});
test('running requires a fresh observed runtime state, not an old assistant promise',()=>{
 assert.equal(u.visualState(session(),now),'running');
 assert.equal(u.visualState(session('a',{stateEvidence:'assistant_report'}),now),'unknown');
 assert.equal(u.visualState(session('a',{stateObservedAt:now-120001}),now),'unknown');
 assert.equal(u.visualState(session('a',{stateObservedAt:0}),now),'unknown');
 assert.equal(u.visualState(session(),now,false),'unknown');
});
test('old sessions disappear after seven days, without being deleted',()=>{
 const entries=[session('old',{activityAt:now-7*DAY}),session('new',{activityAt:now-1000})];
 assert.equal(u.visibleSessions(entries,now).map(s=>s.id).join(','),'new');
 assert.equal(u.visibleSessions(entries,now,true).map(s=>s.id).join(','),'old');assert.equal(entries.length,2);
});
test('verified completed tasks hide after 24 hours; last-response completion is not enough',()=>{
 assert.equal(u.isOld(session('a',{state:'done',stateEvidence:'verified_task',activityAt:now-DAY}),now),true);
 assert.equal(u.isOld(session('a',{state:'done',stateEvidence:'assistant_report',activityAt:now-DAY}),now),false);
});
test('a new upstream activity makes an old session visible again',()=>{
 assert.equal(u.isOld(session('a',{activityAt:now-8*DAY}),now),true);assert.equal(u.isOld(session('a',{activityAt:now-500}),now),false);
});
test('latest activity sorts above severity; polling time does not change order',()=>{
 const rows=[session('waiting',{state:'waiting',activityAt:now-10000}),session('recent',{activityAt:now-1000}),session('unknown',{activityAt:0})];
 assert.equal(u.visibleSessions(rows,now).map(s=>s.id).join(','),'recent,waiting,unknown');
 assert.equal(u.visibleSessions(rows,now+30000).map(s=>s.id).join(','),'recent,waiting,unknown');
});
test('undated task stays visible as undated rather than being falsely fresh or lost',()=>{
 const s=session('a',{activityAt:'nonsense'});assert.equal(s.activityAt,0);assert.equal(u.isOld(s,now),false);assert.equal(u.relative(0,now),'日時未確認');
});
test('impossible future timestamp cannot pin a task above real activity',()=>assert.equal(u.stamp(now+DAY,now),0));
test('private ChatGPT URLs only; strip tracking/query/fragment and normalize old host',()=>{
 for(const url of ['javascript:alert(1)','https://evil.example/c/a','https://chatgpt.com/share/a','https://u:p@chatgpt.com/c/a','https://chatgpt.com:444/c/a'])assert.equal(u.safeUrl(url),'');
 assert.equal(u.safeUrl('https://chat.openai.com/c/a?token=private#foo'),'https://chatgpt.com/c/a');
 assert.equal(u.safeUrl('https://chatgpt.com/g/project/c/a'),'https://chatgpt.com/g/project/c/a');
});
test('no positive send receipt without the matching actual conversation and upstream message',()=>{
 const receipt={sessionId:'a',clientRequestId:'r',status:'delivered',source:'chatgpt',messageId:'m'};
 assert.equal(u.delivery(receipt,'a','r'),'delivered');
 for(const bad of [{...receipt,sessionId:'b'},{...receipt,clientRequestId:'other'},{...receipt,messageId:''},{...receipt,source:'github'},{}])assert.equal(u.delivery(bad,'a','r'),'unknown');
});
test('queue acknowledgement is not delivered; explicit rejection is not success',()=>{
 assert.equal(u.delivery({sessionId:'a',clientRequestId:'r',status:'queued'},'a','r'),'queued');
 assert.equal(u.delivery({sessionId:'a',clientRequestId:'r',status:'rejected'},'a','r'),'rejected');
});
test('send uses idempotency and has a receipt lookup without a second POST',()=>{
 assert.match(script,/'Idempotency-Key':req\.id/);assert.match(script,/\/requests\//);assert.match(script,/previous&&\['sending','queued','unknown'\]/);
 const receiptFn=script.split('async function checkReceipt()')[1].split("$('history')")[0];assert.doesNotMatch(receiptFn,/method:'POST'/);
});
test('IME Enter is never treated as send; a message goes only to explicitly selected session',()=>{
 assert.match(script,/!e\.isComposing/);assert.match(script,/e\.ctrlKey\|\|e\.metaKey/);assert.match(script,/sessionId:s\.id/);
});
