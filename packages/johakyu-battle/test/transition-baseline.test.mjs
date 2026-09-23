import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readdirSync,realpathSync,symlinkSync,rmSync} from 'node:fs';
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
  try{execFileSync(process.execPath,['--test','apps/review/tests/johakyu-p7-review.test.mjs'],{cwd:base,stdio:'pipe',timeout:60000});console.log('BASELINE_REVIEW: passed');}
  catch(error){console.log('BASELINE_REVIEW:',String(error.stdout));}
 }finally{try{execFileSync('git',['worktree','remove','--force',base],{stdio:'pipe'});}finally{rmSync(base,{recursive:true,force:true});}}
});
