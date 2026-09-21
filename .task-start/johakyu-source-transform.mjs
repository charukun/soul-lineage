// Task-scoped bulk source materialization. The Connector owns tree/commit/ref.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const repository='charukun/soul-lineage',task=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/dispatch/johakyu-session-20260921')throw Error('Wrong task owner');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(task.mode!=='transform'||head!==task.sourceSha||!Array.isArray(task.files)||task.files.length>16)throw Error('Invalid source task');
const hash=bytes=>createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
const outputs=[],seen=new Set();
for(const file of task.files){
  if(!/^(?:apps\/(?:review|rinne)\/(?:src|tests|scripts)|packages\/(?:johakyu-combat|game-data|shared-ui)\/(?:src|test))\/[a-zA-Z0-9_./-]+\.(?:js|mjs)$/.test(file.path)||file.path.includes('..')||seen.has(file.path))throw Error('Source path not allowed');
  seen.add(file.path);if(!fs.lstatSync(file.path).isFile())throw Error('Source is not a regular file');
  let content=fs.readFileSync(file.path,'utf8');if(Buffer.byteLength(content)>2*1024*1024||hash(content)!==file.baseBlob)throw Error('Source blob mismatch: '+file.path);
  if(!Array.isArray(file.replacements)||file.replacements.length>64||Buffer.byteLength(JSON.stringify(file.replacements))>65536)throw Error('Invalid transformation');
  for(const replacement of file.replacements){
    if(typeof replacement.before!=='string'||!replacement.before.length||typeof replacement.after!=='string'||content.split(replacement.before).length!==2)throw Error('Exact source replacement mismatch: '+file.path);
    content=content.replace(replacement.before,replacement.after);
  }
  if(hash(content)!==file.expectedBlob)throw Error('Generated source mismatch: '+file.path);
  outputs.push({path:file.path,content,baseBlob:file.baseBlob,expectedBlob:file.expectedBlob});
}
const files=[];
for(const file of outputs){
  const response=await fetch(`https://api.github.com/repos/${repository}/git/blobs`,{method:'POST',headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',Accept:'application/vnd.github+json'},body:JSON.stringify({content:file.content,encoding:'utf-8'})});
  if(!response.ok)throw Error(`Blob materialization failed: ${response.status}`);
  const blob=await response.json();if(blob.sha!==file.expectedBlob)throw Error('Git Data identity mismatch');
  files.push({path:file.path,baseBlob:file.baseBlob,blob:blob.sha,byteLength:Buffer.byteLength(file.content)});
}
fs.mkdirSync('.task-output',{recursive:true});
const receipt={sourceSha:head,mode:task.mode,purpose:task.purpose,files};
fs.writeFileSync('.task-output/result.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
