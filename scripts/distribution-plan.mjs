import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { affectedForDev, graph } from './workspaces.mjs';

const ZERO=/^0+$/;
const PULSE_APP='pulse';
const nonBuildDevPath=path=>path==='AGENTS.md'||path==='scripts/distribution-plan.mjs'||path.startsWith('.autonomous/')||path.startsWith('.task-start/');
const pulsePath=path=>path.startsWith('ops-board/')
  || path==='wrangler.ops.jsonc'
  || path==='wrangler.dev.pulse.jsonc'
  || /^scripts\/(?:application-catalog|distribution-targets|prepare-pulse-worker|notify-fast-dev|autonomous-iteration-telemetry)\.mjs$/.test(path);

export function distributionPlanForDev(nodes,paths){
  const publishPulse=paths.some(pulsePath);
  const appIds=new Set([...nodes.values()].filter(node=>node.group==='apps').map(node=>node.id));
  const directApps=paths.map(path=>path.match(/^wrangler\.dev\.([a-z][a-z0-9-]*)\.jsonc$/)?.[1]||null)
    .filter(app=>app&&app!==PULSE_APP&&appIds.has(app));
  const directPaths=new Set(directApps.map(app=>`wrangler.dev.${app}.jsonc`));
  const regularPaths=paths.filter(path=>!pulsePath(path)&&!directPaths.has(path)&&!nonBuildDevPath(path));
  const regular=regularPaths.length?affectedForDev(nodes,regularPaths):[];
  const apps=[...new Set([...regular,...directApps,...(publishPulse?[PULSE_APP]:[])])];
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
