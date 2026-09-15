import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VISUAL_REPAIR_RUBRIC, buildVisualRepairPrompt, buildVisualJudgePrompt, parseVisualJudgeResult, visualJudgeResultText } from '../src/review/visual-repair-contract.js';

test('visual repair rubric is repository-oriented and totals ten points',()=>{
  assert.equal(VISUAL_REPAIR_RUBRIC.reduce((sum,row)=>sum+row.max,0),10);
  assert.deepEqual(VISUAL_REPAIR_RUBRIC.map(row=>row.id),['form','identity','materials','intersections','presentation','deformation']);
});

test('Astra repair handoff stays in the Lab loop, protects real sources and bans Fal',()=>{
  const prompt=buildVisualRepairPrompt({model:'SHINO',motion:'Idle',view:'three',build:'abc123'});
  assert.match(prompt,/latest develop/);
  assert.match(prompt,/work\/visual-review-lab-v2/);
  assert.match(prompt,/Draft PR #23/);
  assert.match(prompt,/Keep PR #23 Draft/);
  assert.match(prompt,/actual shared production model\/source/);
  assert.match(prompt,/Fal, fal\.ai, FAL_KEY, FAL_API_KEY, queue\.fal\.run/);
  assert.match(prompt,/external image-to-3D generation API/);
  assert.match(prompt,/human visual approval remains separate/);
  assert.match(prompt,/stop without polling CI\/deployment/);
});

test('judge handoff is diagnostic and parses bounded scores',()=>{
  const prompt=buildVisualJudgePrompt({model:'SHINO'});
  assert.match(prompt,/Human approval is separate/);
  const result=parseVisualJudgeResult(JSON.stringify({
    version:1,
    scores:{form:2.5,identity:1.5,materials:1.5,intersections:.75,presentation:.75,deformation:.5},
    summary:'close but not done',
    blockers:['hair silhouette'],
    next_actions:['reshape hair'],
    preserve:['body proportions']
  }));
  assert.equal(result.total,7.5);
  assert.match(visualJudgeResultText(result),/Visual Judge 7.5\/10/);
  assert.throws(()=>parseVisualJudgeResult(JSON.stringify({version:1,scores:{form:4,identity:0,materials:0,intersections:0,presentation:0,deformation:0}})),/Form & silhouette/);
});

test('Visual Review Lab handoff has no hidden AI network client or Fal credential path',()=>{
  const source=readFileSync(new URL('../src/review/visual-repair.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/FAL_KEY|FAL_API_KEY|queue\.fal\.run|apiKey\s*[:=]/i);
  assert.match(source,/indexedDB\.open/);
  assert.match(source,/navigator\.share/);
  assert.match(source,/TARGET 理想/);
  assert.match(source,/Astraへ修正依頼/);
});
