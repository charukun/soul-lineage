import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { distributionPublicUrl } from './distribution-targets.mjs';

const SHA=/^[a-f0-9]{40}$/;

async function fetchJson(url){
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'cache-control':'no-cache'}});
  assert.equal(response.status,200,`HTTP ${response.status}: ${url}`);
  return response.json();
}

export async function verifyPublishedApp({url,app,sha,environment='dev'}={}){
  assert.ok(url,'Published app URL is required');
  assert.ok(app,'Published app id is required');
  assert.match(String(sha||''),SHA,'Exact source SHA is required');
  const base=new URL(url);if(!base.pathname.endsWith('/'))base.pathname+='/';
  const bust=Date.now();
  const versionUrl=new URL('version.json',base);versionUrl.searchParams.set('verify',String(bust));
  const version=await fetchJson(versionUrl);
  assert.equal(version.app,app,'Published app id mismatch');
  assert.equal(version.commit,sha,'Published source SHA mismatch');
  assert.equal(version.environment,environment,'Published environment mismatch');
  const indexUrl=new URL('index.html',base);indexUrl.searchParams.set('verify',String(bust));
  const index=await fetch(indexUrl,{cache:'no-store',signal:AbortSignal.timeout(30000),headers:{'cache-control':'no-cache'}});
  assert.equal(index.status,200,`HTTP ${index.status}: ${indexUrl}`);
  const body=await index.text();assert.ok(body.length>100,'Published index is unexpectedly empty');
  return Object.freeze({url:base.href,app,sha,environment,name:version.name||app,inputHash:version.inputHash||null});
}

async function main(){
  const [app,sha,target='web-dev',explicitUrl]=process.argv.slice(2);
  const url=explicitUrl||distributionPublicUrl(target,app);
  const result=await verifyPublishedApp({url,app,sha,environment:target==='web-dev'?'dev':undefined});
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
