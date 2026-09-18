import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { affectedForDev, graph } from './workspaces.mjs';

const ZERO=/^0+$/;

export function distributionPlanForDev(nodes,paths){
  const apps=affectedForDev(nodes,paths);
  const include=apps.map(app=>({app,target:'web-dev'}));
  return Object.freeze({apps:Object.freeze(apps),include:Object.freeze(include)});
}

function changedPaths(root,base,head){
  if(!base||ZERO.test(base))return ['package-lock.json'];
  return execFileSync('git',['diff','--name-only',base,head],{cwd:root,encoding:'utf8'}).split(/\r?\n/).filter(Boolean);
}

export function planFromRange({root=process.cwd(),base,head='HEAD'}={}){
  const paths=changedPaths(root,base,head),plan=distributionPlanForDev(graph(root),paths);
  return Object.freeze({...plan,paths:Object.freeze(paths)});
}

async function main(){
  const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
  const base=get('--base')||process.env.GITHUB_EVENT_BEFORE||process.env.BEFORE_SHA,head=get('--head')||process.env.GITHUB_SHA||'HEAD';
  const plan=planFromRange({base,head});
  const json=JSON.stringify(plan);
  console.log(json);
  if(process.env.GITHUB_OUTPUT){
    const {appendFileSync}=await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT,`apps=${JSON.stringify(plan.apps)}\nmatrix=${JSON.stringify({include:plan.include})}\nchanged=${plan.include.length>0}\n`);
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
