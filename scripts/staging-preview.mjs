import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const SHA=/^[0-9a-f]{40}$/;
const VERSION=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const APP_URLS=Object.freeze({
  village:'https://soul-lineage-village-dev.c-okamoto.workers.dev/',
  demon:'https://soul-lineage-demon-dev.c-okamoto.workers.dev/',
  rinne:'https://soul-lineage-rinne-dev.c-okamoto.workers.dev/',
});

export function workerPreviewUrl({app,versionId,deploymentUrl=APP_URLS[app]}={}){
  assert.ok(APP_URLS[app],`Unsupported staging app: ${app}`);
  assert.match(String(versionId||''),VERSION,'Cloudflare Worker version ID is required');
  const base=new URL(deploymentUrl);
  const prefix=versionId.slice(0,8);
  return `https://${prefix}-${base.host}/`;
}

export function parseWranglerDeployment(output,{app}={}){
  const text=String(output||'');
  const versionId=text.match(/Current Version ID:\s*([0-9a-f-]{36})/i)?.[1]?.toLowerCase();
  const deploymentUrl=text.match(/https:\/\/soul-lineage-(?:village|demon|rinne)-dev\.c-okamoto\.workers\.dev\/?/i)?.[0];
  assert.ok(versionId,'Wrangler output is missing Current Version ID');
  assert.ok(deploymentUrl,'Wrangler output is missing deployment URL');
  return Object.freeze({versionId,deploymentUrl,previewUrl:workerPreviewUrl({app,versionId,deploymentUrl})});
}

export function stagingObservation({app,sourceSha,versionId,deploymentUrl=APP_URLS[app],observedAt=new Date().toISOString(),conditions={},notVerified=[]}={}){
  assert.match(String(sourceSha||''),SHA,'Exact source SHA is required');
  assert.ok(Number.isFinite(Date.parse(observedAt)),'Valid observedAt is required');
  const reference=workerPreviewUrl({app,versionId,deploymentUrl});
  return Object.freeze({
    kind:'immutable-staging',
    sourceSha,
    reference,
    observedAt,
    conditions:Object.freeze({...conditions}),
    notVerified:Object.freeze([...notVerified]),
    provider:'cloudflare-worker-version-preview',
    versionId,
  });
}

function option(args,name,fallback=null){
  const i=args.indexOf(name);
  return i>=0?args[i+1]:fallback;
}

async function main(){
  const args=process.argv.slice(2),app=option(args,'--app'),sourceSha=option(args,'--sha'),versionId=option(args,'--version');
  if(!app||!sourceSha||!versionId)throw new Error('Usage: node scripts/staging-preview.mjs --app <village|demon|rinne> --sha <40-hex> --version <worker-version-uuid>');
  console.log(JSON.stringify(stagingObservation({app,sourceSha,versionId}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
