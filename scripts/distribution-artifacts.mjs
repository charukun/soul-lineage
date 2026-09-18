import assert from 'node:assert/strict';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inventory } from './deployment-files.mjs';
import { assertBuildableTarget, distributionTarget } from './distribution-targets.mjs';

const SHA=/^[a-f0-9]{40}$/;
const ID=/^[a-z0-9][a-z0-9._-]*$/;

export function artifactRelativePath({app,target,sourceSha}){
  assert.match(String(app||''),ID,'Invalid artifact app');
  assert.match(String(target||''),ID,'Invalid artifact target');
  assert.match(String(sourceSha||''),SHA,'Invalid artifact source SHA');
  return `${app}/${target}/${sourceSha}`;
}

async function exists(path){try{await access(path);return true;}catch{return false;}}

export async function readArtifactReceipt(artifactDir){
  return JSON.parse(await readFile(resolve(artifactDir,'artifact.json'),'utf8'));
}

export async function materializeStaticArtifact({
  sourceDir,artifactRoot='.artifacts',app,target:targetId,sourceSha,sourceBranch,inputHash,
  packageName,displayName,builtAt=new Date().toISOString(),runId=null,
}={}){
  const target=assertBuildableTarget(distributionTarget(targetId),app);
  assert.equal(target.artifactFormat,'static-site',`Target ${target.id} is not a static-site artifact`);
  assert.ok(typeof inputHash==='string'&&inputHash.length>=16,'Artifact input hash is required');
  const relative=artifactRelativePath({app,target:target.id,sourceSha});
  const artifactDir=resolve(artifactRoot,relative),payloadDir=resolve(artifactDir,'payload'),receiptPath=resolve(artifactDir,'artifact.json');
  if(await exists(receiptPath)){
    const receipt=await readArtifactReceipt(artifactDir);
    assert.equal(receipt.sourceSha,sourceSha,'Immutable artifact SHA mismatch');
    assert.equal(receipt.inputHash,inputHash,'Immutable artifact input hash mismatch');
    assert.equal(receipt.target,target.id,'Immutable artifact target mismatch');
    return Object.freeze({artifactDir,payloadDir,receipt,reused:true});
  }
  if(await exists(artifactDir))await rm(artifactDir,{recursive:true,force:true});
  await mkdir(payloadDir,{recursive:true});await cp(sourceDir,payloadDir,{recursive:true});
  const files=await inventory(payloadDir);
  assert.ok(files.length>0,'Distribution artifact payload is empty');
  const receipt=Object.freeze({
    schemaVersion:1,app,target:target.id,targetKind:target.kind,artifactFormat:target.artifactFormat,
    sourceSha,sourceBranch:sourceBranch||target.branch||null,inputHash,packageName:packageName||null,
    displayName:displayName||app,builtAt,runId,entryPath:'index.html',adapter:target.adapter,
    capabilities:Object.freeze({cloudSave:false,crossPlay:false,commerce:false}),files,
  });
  await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  return Object.freeze({artifactDir,payloadDir,receipt,reused:false});
}

export async function installStaticArtifact({artifactDir,destination}={}){
  const receipt=await readArtifactReceipt(artifactDir);
  const target=assertBuildableTarget(receipt.target,receipt.app);
  assert.equal(target.artifactFormat,'static-site');
  const payload=resolve(artifactDir,'payload');
  const actual=await inventory(payload);
  assert.deepEqual(actual,receipt.files,'Artifact payload integrity mismatch');
  await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
  await cp(payload,destination,{recursive:true});
  return receipt;
}
