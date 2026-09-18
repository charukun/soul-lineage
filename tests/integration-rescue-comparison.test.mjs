import test from 'node:test';
import assert from 'node:assert/strict';
import { comparison, treeChangedPaths } from '../scripts/integration-rescue-store.mjs';

const sha=n=>n.toString(16).padStart(40,'0');
const leaf=(path,n=1,mode='100644',type='blob')=>({path,sha:sha(n),mode,type});
const tree=(n,entries)=>({sha:sha(n),truncated:false,tree:entries});
const capped=()=>({merge_base_commit:{sha:sha(10),commit:{tree:{sha:sha(11)}}},files:Array.from({length:300},(_,i)=>({filename:`file-${i}`})),ahead_by:401,status:'diverged'});
function client(data,overrides={}){
  const replies={
    [`/repo/compare/${sha(20)}...${sha(30)}`]:data,
    [`/repo/git/commits/${sha(30)}`]:{sha:sha(30),tree:{sha:sha(31)}},
    [`/repo/git/trees/${sha(11)}?recursive=1`]:tree(11,[leaf('base-only'),leaf('same')]),
    [`/repo/git/trees/${sha(31)}?recursive=1`]:tree(31,[leaf('head-only'),leaf('same')]),...overrides};
  const calls=[];
  return {root:'/repo',calls,api:async(method,path)=>{assert.equal(method,'GET');calls.push(path);assert.ok(Object.hasOwn(replies,path),path);return replies[path];}};
}
test('ordinary comparisons retain rename paths without tree calls; identical pins use no API',async()=>{
  const data=capped();data.files=[{filename:'new',previous_filename:'old'}];const c=client(data);
  assert.deepEqual(await comparison(c,sha(20),sha(30)),{files:['new','old'],mergeBase:sha(10),ahead:401,status:'diverged'});
  assert.equal(c.calls.length,1);assert.deepEqual(await comparison(c,sha(20),sha(20)),{files:[],mergeBase:sha(20),ahead:0,status:'identical'});assert.equal(c.calls.length,1);
});
test('the exact 300-file cap triggers complete merge-base to head tree comparison in four requests',async()=>{
  const c=client(capped());const diff=await comparison(c,sha(20),sha(30));
  assert.deepEqual(diff,{files:['base-only','head-only'],mergeBase:sha(10),ahead:401,status:'diverged'});
  assert.equal(c.calls.length,4);assert.ok(c.calls.includes(`/repo/git/trees/${sha(11)}?recursive=1`));
  assert.ok(!c.calls.some(path=>path.includes(`/git/commits/${sha(20)}`)),'must not use two-dot base tree on divergence');
});
test('tree comparison includes all paths over 300 and rename/delete/add/binary/mode/symlink/submodule changes',()=>{
  const before=tree(11,[...Array.from({length:401},(_,i)=>leaf(`changed-${i}`)),leaf('old-name'),leaf('deleted'),leaf('executable'),leaf('binary'),leaf('link',1,'120000'),leaf('module',1,'160000','commit'),leaf('unchanged'),leaf('dir',90,'040000','tree')]);
  const after=tree(31,[...Array.from({length:401},(_,i)=>leaf(`changed-${i}`,2)),leaf('new-name'),leaf('added'),leaf('executable',1,'100755'),leaf('binary',2),leaf('link',2,'120000'),leaf('module',2,'160000','commit'),leaf('unchanged'),leaf('dir',91,'040000','tree')]);
  const paths=treeChangedPaths(before,after,sha(11),sha(31));
  assert.equal(paths.length,409);for(const path of ['old-name','new-name','deleted','added','executable','binary','link','module'])assert.ok(paths.includes(path),path);
  assert.ok(!paths.includes('dir'));assert.ok(!paths.includes('unchanged'));
});
test('truncated, mismatched or malformed trees remain fail closed',async()=>{
  const key=`/repo/git/trees/${sha(11)}?recursive=1`;
  for(const bad of [{...tree(11,[]),truncated:true},{sha:sha(11),tree:[]},tree(12,[]),tree(11,[leaf('x'),leaf('x')]),
    tree(11,[leaf('../x')]),tree(11,[{...leaf('x'),sha:'missing'}]),tree(11,[leaf('x',1,'100600')]),tree(11,[leaf('x',1,'100644','unknown')])]){
    await assert.rejects(comparison(client(capped(),{[key]:bad}),sha(20),sha(30)),/INCOMPLETE_BASE_COMPARISON/);
  }
});
test('missing merge-base tree and moving head pins cannot fall back to partial files',async()=>{
  const missing=capped();delete missing.merge_base_commit.commit;
  await assert.rejects(comparison(client(missing),sha(20),sha(30)),/INCOMPLETE_BASE_COMPARISON/);
  const c=client(capped(),{[`/repo/git/commits/${sha(30)}`]:{sha:sha(99),tree:{sha:sha(31)}}});
  await assert.rejects(comparison(c,sha(20),sha(30)),/INCOMPLETE_BASE_COMPARISON/);assert.equal(c.calls.length,2);
});
test('API failures and incomplete small comparisons never produce an empty success',async()=>{
  await assert.rejects(comparison({root:'/repo',api:async()=>{throw new Error('HTTP 429');}},sha(20),sha(30)),/HTTP 429/);
  for(const files of [null,[{}]]){const data=capped();data.files=files;await assert.rejects(comparison(client(data),sha(20),sha(30)),/INCOMPLETE_BASE_COMPARISON/);}
});
