import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const task=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const repository='charukun/soul-lineage';
if(process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/dispatch/johakyu-session-20260921')throw Error('Wrong task owner');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(task.mode!=='lockfile'||head!==task.sourceSha)throw Error('Wrong source');
const hash=bytes=>createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
const original=fs.readFileSync('package-lock.json','utf8');if(hash(original)!==task.baseBlob)throw Error('Base lock mismatch');
const row=task.dependency;
if(row.app!=='apps/review'||row.name!=='@soul/johakyu-combat'||row.packagePath!=='packages/johakyu-combat'||row.version!=='0.1.0'||JSON.stringify(row.dependencies)!=='{"@soul/game-data":"*"}')throw Error('Unexpected workspace');
const lock=JSON.parse(original);if(lock.packages[`node_modules/${row.name}`]||lock.packages[row.packagePath])throw Error('Workspace already exists');
lock.packages[row.app].dependencies[row.name]='*';
lock.packages[`node_modules/${row.name}`]={resolved:row.packagePath,link:true};
lock.packages[row.packagePath]={version:row.version,dependencies:row.dependencies};
const content=JSON.stringify(lock,null,2)+'\n';if(hash(content)!==task.expectedBlob)throw Error('Generated lock mismatch');
// This task creates only an immutable data blob. The GitHub Connector alone
// assembles the implementation tree/commit and advances its dedicated branch.
const response=await fetch(`https://api.github.com/repos/${repository}/git/blobs`,{method:'POST',headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',Accept:'application/vnd.github+json'},body:JSON.stringify({content,encoding:'utf-8'})});
if(!response.ok)throw Error(`Blob materialization failed: ${response.status}`);
const blob=await response.json();if(blob.sha!==task.expectedBlob)throw Error('Git Data blob mismatch');
fs.mkdirSync('.task-output',{recursive:true});
const result={sourceSha:head,mode:'lockfile',files:[{path:'package-lock.json',baseBlob:task.baseBlob,blob:blob.sha,byteLength:Buffer.byteLength(content)}]};
fs.writeFileSync('.task-output/result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
