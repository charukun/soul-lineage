import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readdirSync,realpathSync,symlinkSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('diagnose unchanged develop fixtures against the parent source',()=>{
 const root=process.cwd(),base=mkdtempSync(path.join(tmpdir(),'battle-base-'));
 try{
  execFileSync('git',['worktree','add','--detach',base,'634091de4af47df6de75dd5a11f695061fd616a7'],{stdio:'pipe'});
  mkdirSync(path.join(base,'node_modules','@soul'),{recursive:true});
  for(const name of readdirSync(path.join(root,'node_modules')))if(name!=='@soul')symlinkSync(path.join(root,'node_modules',name),path.join(base,'node_modules',name));
  for(const name of readdirSync(path.join(root,'node_modules','@soul'))){
   const relative=path.relative(root,realpathSync(path.join(root,'node_modules','@soul',name)));
   symlinkSync(path.join(base,relative),path.join(base,'node_modules','@soul',name));
  }
  const runner="import {createJohakyuP7ReviewScenario} from './apps/review/src/nocturne/johakyu-p7-review.js';\nconst s=createJohakyuP7ReviewScenario({settings:{inspirationRate:'off'},actorOverrides:{hero:{hp:800,maxHp:800},'enemy-a':{hp:10000,maxHp:10000}}});\nconst rows=[];for(let i=0;i<3600;i++){const r=s.step(1/60);rows.push({i,actors:r.frame.actors.map(a=>({id:a.id,pos:a.position,hp:a.hp,stamina:a.stamina,action:a.action&&{kind:a.action.kind,phase:a.action.phase,progress:a.action.progress},decision:a.exchange,cursor:a.cursor,stagger:a.stagger})),events:r.events.map(e=>({type:e.type,source:e.sourceId,phase:e.phase,reason:e.reason}))});}console.log(JSON.stringify(rows));";
  for(const cwd of [root,base])writeFileSync(path.join(cwd,'diagnose-battle.mjs'),runner);
  const capture=cwd=>JSON.parse(execFileSync(process.execPath,['diagnose-battle.mjs'],{cwd,encoding:'utf8',maxBuffer:20000000}));
  const before=capture(base),after=capture(root);let count=0;
  for(let i=0;i<before.length;i++)if(JSON.stringify(before[i])!==JSON.stringify(after[i])){console.log('DIVERGENCE',JSON.stringify({before:before[i],after:after[i]}));if(++count===3)break;}
  rmSync(path.join(root,'diagnose-battle.mjs'));
  try{execFileSync(process.execPath,['--test','apps/review/tests/johakyu-p7-review.test.mjs'],{cwd:base,stdio:'pipe',timeout:60000});console.log('BASELINE_REVIEW: passed');}
  catch(error){console.log('BASELINE_REVIEW:',String(error.stdout));}
 }finally{try{execFileSync('git',['worktree','remove','--force',base],{stdio:'pipe'});}finally{rmSync(base,{recursive:true,force:true});}}
});
