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

test('distribution catalog separates buildable web targets from contract-only consumer targets',()=>{
  for(const id of ['web-dev','web-review','web-staging','web-prod'])assert.equal(distributionTarget(id).status,'buildable');
  for(const id of ['steam','android','ios','playstation','switch','xbox']){
    assert.equal(distributionTarget(id).status,'contract-only');
    assert.throws(()=>assertBuildableTarget(id,'demon'),/contract-only/);
  }
  assert.equal(webTargetForEnvironment('dev').id,'web-dev');
  assert.equal(webTargetForEnvironment('prod').id,'web-prod');
  assert.equal(targetSupportsApp('web-review','rinne'),true);
  assert.equal(targetSupportsApp('web-review','demon'),false);
  assert.ok(DISTRIBUTION_TARGETS.length>=10);
});

test('DEV distribution plan is app-scoped and fans shared dependencies out through workspace closure',()=>{
  const nodes=graph();
  assert.deepEqual(distributionPlanForDev(nodes,['apps/demon/src/main.js']),{apps:['demon'],include:[{app:'demon',target:'web-dev'}]});
  assert.deepEqual(distributionPlanForDev(nodes,['apps/rinne/src/main.js']),{apps:['rinne'],include:[{app:'rinne',target:'web-dev'},{app:'rinne',target:'web-review'}]});
  const shared=distributionPlanForDev(nodes,['packages/assets/src/index.js']);
  assert.deepEqual(shared.apps,['demon','rinne','village']);
  assert.deepEqual(shared.include,[
    {app:'demon',target:'web-dev'},{app:'rinne',target:'web-dev'},{app:'village',target:'web-dev'},{app:'rinne',target:'web-review'}
  ]);
  assert.deepEqual(distributionPlanForDev(nodes,['docs/PLATFORMS.md']),{apps:[],include:[]});
});

test('target build command never pretends consumer packaging exists',()=>{
  const dev=buildCommandForTarget('demon','web-dev');
  assert.deepEqual(dev.args.slice(0,3),['run','build','--workspace']);
  assert.equal(dev.environment,'dev');
  assert.equal(buildCommandForTarget('rinne','web-review').args[1],'build:review');
  assert.throws(()=>buildCommandForTarget('demon','steam'),/contract-only/);
});

test('static artifacts are immutable, idempotent and verified before installation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'soul-artifact-'));
  const source=join(root,'source'),artifacts=join(root,'artifacts'),destination=join(root,'published');
  const sha='a'.repeat(40),inputHash='b'.repeat(64);
  try{
    await mkdir(source,{recursive:true});await writeFile(join(source,'index.html'),'<h1>DEV</h1>');
    const first=await materializeStaticArtifact({sourceDir:source,artifactRoot:artifacts,app:'demon',target:'web-dev',sourceSha:sha,sourceBranch:'develop',inputHash,packageName:'@soul/demon',displayName:'尽喰廻遊',builtAt:'2026-09-19T00:00:00Z'});
    assert.equal(first.reused,false);
    assert.equal(first.receipt.target,'web-dev');
    assert.equal(artifactRelativePath({app:'demon',target:'web-dev',sourceSha:sha}),`demon/web-dev/${sha}`);
    const second=await materializeStaticArtifact({sourceDir:source,artifactRoot:artifacts,app:'demon',target:'web-dev',sourceSha:sha,sourceBranch:'develop',inputHash,packageName:'@soul/demon',displayName:'尽喰廻遊'});
    assert.equal(second.reused,true);
    await installStaticArtifact({artifactDir:first.artifactDir,destination});
    assert.equal(await readFile(join(destination,'index.html'),'utf8'),'<h1>DEV</h1>');
    const receipt=await readArtifactReceipt(first.artifactDir);assert.equal(receipt.sourceSha,sha);
    await writeFile(join(first.payloadDir,'index.html'),'tampered');
    await assert.rejects(installStaticArtifact({artifactDir:first.artifactDir,destination}),/integrity mismatch/);
  }finally{await rm(root,{recursive:true,force:true});}
});
