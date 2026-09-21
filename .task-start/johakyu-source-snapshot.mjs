import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const task=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(task.mode!=='snapshot'||head!==task.sourceSha)throw Error('Source identity mismatch');
const allowed=['apps/review','apps/rinne/src','apps/rinne/tests','apps/rinne/package.json','apps/rinne/index.html','apps/rinne/vite.config.js','packages','scripts','package.json','package-lock.json','docs/rinne'];
if(!Array.isArray(task.paths)||!task.paths.length||task.paths.length>48)throw Error('Explicit task source paths required');
const scopes=task.paths;
for(const scope of scopes)if(typeof scope!=='string'||scope.includes('..')||path.isAbsolute(scope)||!allowed.some(root=>scope===root||scope.startsWith(root+'/')))throw Error('Source path outside task scope');
const paths=execFileSync('git',['ls-files','-z','--',...scopes],{encoding:'utf8'}).split('\0').filter(Boolean);
const output='.task-output';fs.mkdirSync(output,{recursive:true});
const selected=[],index=[],omitted=[];let total=0;
for(const file of paths){
  if(file.includes('..')||path.isAbsolute(file)||file.includes('/node_modules/')||file.includes('/public/')||file.includes('/.env'))continue;
  const stat=fs.lstatSync(file);if(!stat.isFile())continue;
  if(!/\.(?:js|mjs|cjs|json|jsonc|css|html|glsl|wgsl|txt|ts|tsx|md)$/.test(file))continue;
  if(stat.size>1024*1024){omitted.push({path:file,byteLength:stat.size,reason:'large-source-request-separately'});continue;}
  const bytes=fs.readFileSync(file);if(bytes.includes(0)){omitted.push({path:file,reason:'binary'});continue;}
  total+=bytes.length;if(total>32*1024*1024)throw Error('Source snapshot budget exceeded');
  const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  selected.push(file);index.push({path:file,byteLength:bytes.length,gitBlob:blob,included:true});
}
fs.writeFileSync(`${output}/paths.nul`,selected.join('\0')+'\0');
execFileSync('tar',['-czf',`${output}/source.tar.gz`,'--null','-T',`${output}/paths.nul`]);
fs.rmSync(`${output}/paths.nul`);
const receipt={schemaVersion:1,sourceSha:head,mode:'snapshot',purpose:task.purpose,requestedPaths:scopes,totalBytes:total,fileCount:selected.length,files:index,omitted};
fs.writeFileSync(`${output}/source-receipt.json`,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({sourceSha:head,fileCount:selected.length,totalBytes:total,omitted:omitted.length}));
