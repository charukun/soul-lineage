import {existsSync,mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=dirname(dirname(fileURLToPath(import.meta.url)));
const manifest=resolve(appRoot,'public/models/manifest.json');
const delivery=resolve(appRoot,'public/models/delivery.json');
const lock=resolve(appRoot,'.test-fixtures-lock');
const sleeper=new Int32Array(new SharedArrayBuffer(4));
const ready=()=>existsSync(manifest)&&existsSync(delivery);
const sleep=ms=>Atomics.wait(sleeper,0,0,ms);

export function ensureDeliveryFixtures(){
  if(ready())return;
  let owner=false;
  for(let attempt=0;attempt<360&&!owner;attempt++){
    try{mkdirSync(lock);owner=true;}
    catch(error){if(error?.code!=='EEXIST')throw error;if(ready())return;sleep(500);}
  }
  if(!owner)throw Error('Timed out waiting for Eclipse test fixtures');
  try{
    if(!ready()){
      execFileSync(process.execPath,['tools/acquire.mjs'],{cwd:appRoot,stdio:'inherit'});
      execFileSync(process.execPath,['tools/prepare-delivery.mjs'],{cwd:appRoot,stdio:'inherit'});
    }
  }finally{rmSync(lock,{recursive:true,force:true});}
  if(!ready())throw Error('Eclipse test fixtures were not produced');
}
