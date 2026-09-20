import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { graph } from '../scripts/workspaces.mjs';
import { DISTRIBUTION_TARGETS, assertBuildableTarget, distributionTarget, targetSupportsApp, webTargetForEnvironment } from '../scripts/distribution-targets.mjs';
import { distributionPlanForDev } from '../scripts/distribution-plan.mjs';
import { artifactRelativePath, installStaticArtifact, materializeStaticArtifact, readArtifactReceipt } from '../scripts/distribution-artifacts.mjs';
import { buildCommandForTarget } from '../scripts/build-target.mjs';
import { fastDevEmailMessage } from '../scripts/notify-fast-dev.mjs';
import { parseWranglerDeployment, stagingObservation, workerPreviewUrl } from '../scripts/staging-preview.mjs';

test('distribution catalog separates buildable web targets from contract-only consumer targets',()=>{
  for(const id of ['web-dev','web-staging','web-prod'])assert.equal(distributionTarget(id).status,'buildable');
  for(const id of ['steam','android','ios','playstation','switch','xbox']){
    assert.equal(distributionTarget(id).status,'contract-only');
    assert.throws(()=>assertBuildableTarget(id,'demon'),/contract-only/);
  }
  assert.equal(webTargetForEnvironment('dev').id,'web-dev');
  assert.equal(webTargetForEnvironment('prod').id,'web-prod');
  assert.equal(targetSupportsApp('web-dev','review'),true);
  assert.equal(targetSupportsApp('web-dev','character-studio'),true);
  assert.equal(targetSupportsApp('web-staging','review'),false);
  assert.equal(targetSupportsApp('web-staging','character-studio'),false);
  assert.ok(DISTRIBUTION_TARGETS.length>=9);
  const version='6c6f6499-055b-47e2-97bc-8d837434c084',sha='1'.repeat(40);
  assert.equal(workerPreviewUrl({app:'village',versionId:version}),'https://6c6f6499-soul-lineage-village-dev.c-okamoto.workers.dev/');
  const parsed=parseWranglerDeployment('Deployed\n  https://soul-lineage-village-dev.c-okamoto.workers.dev\nCurrent Version ID: '+version,{app:'village'});
  assert.equal(parsed.previewUrl,'https://6c6f6499-soul-lineage-village-dev.c-okamoto.workers.dev/');
  const observation=stagingObservation({app:'village',sourceSha:sha,versionId:version,observedAt:'2026-09-20T00:00:00Z',conditions:{scenario:'baseline'}});
  assert.equal(observation.sourceSha,sha);
  assert.equal(observation.provider,'cloudflare-worker-version-preview');
});

test('DEV distribution plan is app-scoped and fans shared dependencies out through workspace closure',()=>{
  const nodes=graph();
  assert.deepEqual(distributionPlanForDev(nodes,['apps/demon/src/main.js']),{apps:['demon'],include:[{app:'demon',target:'web-dev'}]});
  assert.deepEqual(distributionPlanForDev(nodes,['apps/rinne/src/main.js']),{apps:['rinne'],include:[{app:'rinne',target:'web-dev'}]});
  assert.deepEqual(distributionPlanForDev(nodes,['apps/review/src/main.js']),{apps:['review'],include:[{app:'review',target:'web-dev'}]});
  assert.deepEqual(distributionPlanForDev(nodes,['apps/character-studio/src/character-review.js']),{apps:['character-studio'],include:[{app:'character-studio',target:'web-dev'}]});
  const shared=distributionPlanForDev(nodes,['packages/assets/src/index.js']);
  assert.deepEqual(shared.apps,['character-studio','demon','rinne','village']);
  assert.deepEqual(shared.include,[
    {app:'character-studio',target:'web-dev'},{app:'demon',target:'web-dev'},{app:'rinne',target:'web-dev'},{app:'village',target:'web-dev'}
  ]);
  assert.deepEqual(distributionPlanForDev(nodes,['docs/PLATFORMS.md']),{apps:[],include:[]});
});

test('target build command never pretends consumer packaging exists',()=>{
  const dev=buildCommandForTarget('demon','web-dev');
  assert.deepEqual(dev.args.slice(0,3),['run','build','--workspace']);
  assert.equal(dev.environment,'dev');
  assert.throws(()=>buildCommandForTarget('demon','steam'),/contract-only/);
});

test('static artifacts are immutable, idempotent and verified before installation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'soul-artifact-'));
  const source=join(root,'source'),artifacts=join(root,'artifacts'),destination=join(root,'published');
  const sha='a'.repeat(40),inputHash='b'.repeat(64);
  try{
    await mkdir(source,{recursive:true});await writeFile(join(source,'index.html'),'<h1>DEV</h1>');
    const first=await materializeStaticArtifact({sourceDir:source,artifactRoot:artifacts,app:'demon',target:'web-dev',sourceSha:sha,sourceBranch:'develop',inputHash,packageName:'@soul/demon',displayName:'喰滅廻遊',builtAt:'2026-09-19T00:00:00Z'});
    assert.equal(first.reused,false);
    assert.equal(first.receipt.target,'web-dev');
    assert.equal(artifactRelativePath({app:'demon',target:'web-dev',sourceSha:sha}),`demon/web-dev/${sha}`);
    const second=await materializeStaticArtifact({sourceDir:source,artifactRoot:artifacts,app:'demon',target:'web-dev',sourceSha:sha,sourceBranch:'develop',inputHash,packageName:'@soul/demon',displayName:'喰滅廻遊'});
    assert.equal(second.reused,true);
    await installStaticArtifact({artifactDir:first.artifactDir,destination});
    assert.equal(await readFile(join(destination,'index.html'),'utf8'),'<h1>DEV</h1>');
    const receipt=await readArtifactReceipt(first.artifactDir);assert.equal(receipt.sourceSha,sha);
    await writeFile(join(first.payloadDir,'index.html'),'tampered');
    await assert.rejects(installStaticArtifact({artifactDir:first.artifactDir,destination}),/integrity mismatch/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('fast DEV notification lists only affected per-app live targets',()=>{
  const message=fastDevEmailMessage({repository:'charukun/soul-lineage',apps:['demon'],pr:{number:925,title:'distribution',body:'配信基盤改善\n詳細'}});
  assert.match(message,/DEV反映完了/);
  assert.match(message,/喰滅廻遊/);
  assert.match(message,/soul-lineage-demon-dev\.c-okamoto\.workers\.dev/);
  assert.doesNotMatch(message,/MURAAAAAAA/);
});

test('independent developer-tool DEV targets are separate from Production game targets',()=>{
  assert.equal(distributionTarget('web-dev').compatibilityPublisher,undefined);
  for(const app of ['review','character-studio']){
    assert.equal(targetSupportsApp('web-dev',app),true);
    assert.equal(targetSupportsApp('web-prod',app),false);
  }
});
