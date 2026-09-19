import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {manifest} from '../model-manifest.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=resolve(root,'public/models');await mkdir(output,{recursive:true});
const hash=data=>createHash('sha256').update(data).digest('hex');
const pending=[...manifest];
async function request(url){let last;for(let i=0;i<3;i++){try{const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);return Buffer.from(await response.arrayBuffer());}catch(e){last=e;}}throw last;}
async function worker(){while(pending.length){const item=pending.shift(),dest=resolve(root,'public',item.file);let existing;try{existing=await readFile(dest);}catch{}if(existing&&hash(existing)===item.sha256)continue;
 const repository=item.repository.replace('https://github.com/','');if(!repository.startsWith('KayKit-Game-Assets/'))throw new Error('Unapproved model origin');
 const bytes=await request(`https://raw.githubusercontent.com/${repository}/${item.revision}/${item.sourcePath}`);
 if(bytes.length!==item.bytes||hash(bytes)!==item.sha256)throw new Error(`Original asset integrity failed: ${item.id}`);
 await writeFile(dest,bytes);console.log(`Verified original: ${item.id}`);
}}
await Promise.all(Array.from({length:5},worker));
for(const repo of new Set(manifest.map(m=>m.repository))){const m=manifest.find(m=>m.repository===repo),name=repo.split('/').at(-1);const bytes=await request(`${repo.replace('github.com','raw.githubusercontent.com')}/${m.revision}/LICENSE.txt`);await writeFile(resolve(output,`${name}-LICENSE.txt`),bytes);}
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Original third-party assets ready: ${manifest.length}; ${manifest.reduce((n,m)=>n+m.bytes,0)} bytes. No generated geometry.`);
