import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {GAMES,loadContext} from '../.autonomous/lib/contract.mjs';
import {captureProbe} from '../.autonomous/lib/probes.mjs';
import {isolatedPublicationPlan,bindImmutableVersion} from '../scripts/autonomous-run-controller.mjs';
import {workerPreviewUrl} from '../scripts/staging-preview.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const SHA='0123456789abcdef0123456789abcdef01234567';
const VERSION='12345678-1234-1234-1234-123456789abc';

test('rinne is a first-class autonomous target with bounded context',()=>{
  assert.equal(GAMES.rinne,'apps/rinne');
  const context=loadContext(root,'rinne');
  assert.equal(context.game,'rinne');
  assert.equal(context.app,'apps/rinne');
  assert.equal(context.recent.length,0);
  assert.ok(context.readFirst.includes('.autonomous/rinne/protected-rules.md'));
});

test('rinne controller publishes exact source and binds immutable preview',()=>{
  const plan=isolatedPublicationPlan({game:'rinne',sourceSha:SHA,runKey:'rinne-run',iteration:1,iterations:3,phase:'before'});
  assert.equal(plan.app,'rinne');
  assert.deepEqual(plan.dispatch.inputs,{app:'rinne',source_sha:SHA});
  const staged=bindImmutableVersion({plan,versionId:VERSION});
  assert.equal(staged.reference,'https://12345678-soul-lineage-rinne-dev.c-okamoto.workers.dev/');
  assert.equal(workerPreviewUrl({app:'rinne',versionId:VERSION}),staged.reference);
});

test('rinne has a deterministic portable life-clock probe',async()=>{
  const report=await captureProbe(root,'rinne',{ref:'HEAD',seeds:[11,30,49]});
  assert.equal(report.game,'rinne');
  assert.equal(report.source.path,'apps/rinne/public/simulator/src/life-clock.js');
  assert.equal(report.rows.length,3);
  assert.ok(report.rows.every(row=>typeof row.metrics.stage==='string'&&Number.isFinite(row.metrics.ageAfter)));
});
