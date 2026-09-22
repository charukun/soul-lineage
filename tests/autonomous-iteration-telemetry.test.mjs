import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ITERATION_STEPS,
  advanceIterationTelemetry,
  createIterationTelemetry,
  patchIterationTelemetry,
  readIterationTelemetry,
  upsertIterationTelemetry,
} from '../scripts/autonomous-iteration-telemetry.mjs';

const SHA='a'.repeat(40);

test('iteration telemetry records canonical step boundaries and measured durations',()=>{
  let state=createIterationTelemetry({
    runKey:'parallel-run-a',game:'kuumetsu',iteration:2,iterations:3,sourceSha:SHA,
    startedAt:'2026-09-22T00:00:00.000Z',
  });
  state=advanceIterationTelemetry(state,{from:'observation',to:'investigation',at:'2026-09-22T00:00:12.000Z'});
  state=advanceIterationTelemetry(state,{from:'investigation',to:'implementation',at:'2026-09-22T00:00:20.000Z',patch:{
    theme:'enemy reaction clarity',themeKey:'enemy-reaction-clarity',
    rootCauses:[{key:'flat-reaction',summary:'enemy reaction is visually flat'}],
  }});
  state=advanceIterationTelemetry(state,{from:'implementation',to:'causalValidation',at:'2026-09-22T00:00:50.000Z',patch:{
    improvementSummary:'stagger and threat reaction were connected',
    changes:['threat state now drives reaction strength'],
    changedPaths:['apps/demon/src/combat.js'],
  }});
  assert.equal(state.currentStep,'causalValidation');
  assert.equal(state.steps.observation.durationMs,12000);
  assert.equal(state.steps.investigation.durationMs,8000);
  assert.equal(state.steps.implementation.durationMs,30000);
  assert.equal(state.theme,'enemy reaction clarity');
  assert.equal(state.iterationId,'parallel-run-a:2');
  assert.deepEqual(ITERATION_STEPS.map(step=>step.id),[
    'observation','investigation','implementation','causalValidation','afterObservation',
    'verdict','astraValidation','freshness','merge','devPublish',
  ]);
});

test('telemetry marker round-trips without replacing the human PR body',()=>{
  let state=createIterationTelemetry({
    runKey:'marker-run',game:'rinne',iteration:1,iterations:1,sourceSha:SHA,
    startedAt:'2026-09-22T01:00:00Z',
  });
  state=patchIterationTelemetry(state,{prNumber:99,theme:'HUD cohesion'});
  const body=upsertIterationTelemetry('Human summary\n\nBrowser-Playtest: rinne',state);
  assert.match(body,/Human summary/);
  assert.match(body,/Browser-Playtest: rinne/);
  assert.equal((body.match(/autonomous-iteration-telemetry:v1/g)||[]).length,1);
  const parsed=readIterationTelemetry(body);
  assert.equal(parsed.prNumber,99);
  assert.equal(parsed.theme,'HUD cohesion');
  const updated=upsertIterationTelemetry(body,patchIterationTelemetry(parsed,{changes:['one','two']}));
  assert.equal((updated.match(/autonomous-iteration-telemetry:v1/g)||[]).length,1);
  const reparsed=readIterationTelemetry(updated);
  assert.deepEqual(reparsed.changes,['one','two']);
  assert.equal(reparsed.steps.astraValidation.durationMs,null);
});

test('parallel sessions with the same iteration number cannot collide',()=>{
  const a=createIterationTelemetry({runKey:'parallel-a',game:'village',iteration:1,iterations:3,sourceSha:SHA,startedAt:'2026-09-22T02:00:00Z'});
  const b=createIterationTelemetry({runKey:'parallel-b',game:'village',iteration:1,iterations:3,sourceSha:SHA,startedAt:'2026-09-22T02:00:00Z'});
  assert.notEqual(a.iterationId,b.iterationId);
  assert.equal(a.iteration,1);
  assert.equal(b.iteration,1);
});

test('shared telemetry source remains Worker-compatible and has no Node builtin imports',()=>{
  const source=readFileSync(new URL('../scripts/autonomous-iteration-telemetry.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/from ['"]node:/);
  assert.match(source,/TextEncoder/);
  assert.match(source,/autonomous-iteration-telemetry:v1/);
});
