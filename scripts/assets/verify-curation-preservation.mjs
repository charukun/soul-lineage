#!/usr/bin/env node
// Explicit asset-curation evidence only; never a build hook or automatic test sweep.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trim();
const base=process.argv[2];
assert.match(base||'',/^[a-f0-9]{40}$/, 'Pass the exact develop baseline SHA');
const head=git('rev-parse','HEAD');
git('merge-base','--is-ancestor',base,head);
assert.equal(git('diff','--name-only','HEAD'),'','Commit all tested source before verification');
const directory='apps/review/public/library/';
const manifestAt=ref=>JSON.parse(git('show',`${ref}:${directory}manifest.json`));
const before=manifestAt(base),after=manifestAt(head);
assert.equal(after.origin,before.origin,'Do not replace the existing self-owned asset origin');
const byPath=new Map(after.files.map(row=>[row.path,row]));
assert.equal(byPath.size,after.files.length,'Duplicate manifest paths');
for(const old of before.files){
  const current=byPath.get(old.path);
  assert.ok(current,`Existing manifest entry removed: ${old.path}`);
  assert.equal(current.bytes,old.bytes,`Existing asset length changed: ${old.path}`);
  assert.equal(current.gitBlobSha,old.gitBlobSha,`Existing asset identity changed: ${old.path}`);
  if(old.sha256)assert.equal(current.sha256,old.sha256,`Existing SHA-256 changed: ${old.path}`);
}
const treeAt=ref=>new Map(git('ls-tree','-r','-z',ref,'--',directory).split('\0').filter(Boolean).map(line=>{
  const at=line.indexOf('\t');return [line.slice(at+1),line.slice(0,at)];
}));
const oldTree=treeAt(base),newTree=treeAt(head);
let preservedFiles=0;
for(const [name,identity] of oldTree){
  if(name===`${directory}manifest.json`)continue;
  assert.equal(newTree.get(name),identity,`Existing tracked asset changed or removed: ${name}`);
  preservedFiles++;
}
const ledger=JSON.parse(git('show',`${head}:${directory}provenance/curation-20260921.json`));
const oldHashes=new Set(before.files.map(row=>row.gitBlobSha));
for(const asset of ledger.files)assert.ok(!oldHashes.has(asset.gitBlobSha),`Duplicate of a develop asset: ${asset.id}`);
const receipt={schema:1,status:'passed',base,head,existingManifestEntries:before.files.length,
  existingTrackedFilesPreserved:preservedFiles,newManifestEntries:after.files.length-before.files.length,
  newPayloads:ledger.files.length,existingPayloadChanges:0,finishedAt:new Date().toISOString()};
const output=path.join(root,'.deploy-state/asset-curation-evidence');
await mkdir(output,{recursive:true});
await writeFile(path.join(output,'preservation-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
