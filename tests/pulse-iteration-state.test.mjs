import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autonomousIterationMeta, buildAutonomousIterations, buildDevelopmentSessions } from '../ops-board/development-sessions.mjs';
import { createIterationTelemetry } from '../scripts/autonomous-iteration-telemetry.mjs';
import { iterationPresentation, iterationOverview, iterationTimingSteps } from '../ops-board/public/iteration-status.mjs';
import { progressStepDurationMs } from '../ops-board/public/progress-mini.js';
import { renderIterationCard, renderIterationSummary } from '../ops-board/public/iteration-summary.js';

const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const start = '2026-09-22T01:00:00Z', end = '2026-09-22T01:05:00Z';
function body(patch = {}) {
  const initial = createIterationTelemetry({ runKey:'pulse-test-run', game:'kuumetsu', sourceSha:A, startedAt:start });
  const data = { ...initial, ...patch, steps:{ ...initial.steps, ...patch.steps } };
  return '<!-- autonomous-iteration-telemetry:v1:' + Buffer.from(JSON.stringify(data)).toString('base64url') + ' -->';
}
const pull = (patch = {}) => ({ number:1, title:'喰滅廻遊：捕食の進行を表示', body:body(), state:'open', draft:true,
  head:{ sha:A, ref:'fix/iteration' }, merge_commit_sha:C, created_at:start, updated_at:end,
  html_url:'https://github.com/charukun/soul-lineage/pull/1', ...patch });
const run = (patch = {}) => ({ id:1, name:'Astra Work Validation', head_sha:A, head_branch:'fix/iteration',
  created_at:start, updated_at:end, status:'completed', conclusion:'success', html_url:'https://github.com/charukun/soul-lineage/actions/runs/1', ...patch });
const item = (pr = pull(), runs = []) => buildAutonomousIterations([pr], runs)[0];

test('PULSE screenshot false positive is not a game iteration even when the body names every game', () => {
  const pr = { title:'PULSE自律改善グラフをACTIVEと同じ読み方へ整理', body:'kuumetsu / rinne / village の Iteration 1 を表示', targetApps:[] };
  assert.equal(autonomousIterationMeta(pr), null);
  assert.equal(autonomousIterationMeta({ ...pr, targetApps:[{ id:'ops-board' }] }), null);
  assert.equal(autonomousIterationMeta({ title:'表示整理', body:pr.body, targetApps:[{ id:'ops-board' }] }), null);
});
test('real telemetry and explicit legacy game iterations remain discoverable', () => {
  assert.equal(autonomousIterationMeta(pull()).game, 'kuumetsu');
  assert.equal(autonomousIterationMeta({ title:'百年転生 iteration 2', body:'' }).game, 'rinne');
  assert.equal(autonomousIterationMeta({ title:'改善', body:'autonomous iteration\nautonomous-receipt:village:exp' }).game, 'village');
});
test('open PR synthetic merge SHA is not a merge fact or a publication queue', () => {
  const row = item();
  assert.equal(row.merged, false); assert.equal(row.mergeSha, null);
  assert.equal(row.status, 'waiting'); assert.equal(row.publication.state, 'notStarted');
  assert.equal(buildDevelopmentSessions([pull()], [])[0].mergeSha, null);
});
test('actual merge is complete even when the publication has not been observed', () => {
  const row = item(pull({ state:'closed', merged_at:end, merge_commit_sha:B }));
  assert.equal(row.status, 'complete'); assert.equal(row.publication.state, 'unknown');
  assert.match(iterationPresentation(row).publicationText, /未確認/);
});
test('publication process failure and inconclusive effect never erase completed intake', () => {
  const row = item(pull({ state:'closed', merged_at:end, merge_commit_sha:B, body:body({ verdict:'inconclusive' }) }),
    [run({ name:'Per-App DEV Publish', head_sha:B, head_branch:'develop', conclusion:'failure' })]);
  const view = iterationPresentation(row);
  assert.equal(view.status, 'complete'); assert.equal(view.publicationProblem, true); assert.equal(view.effect, '効果は未確定');
  assert.match(view.publicationText, /処理に問題/);
  const { counts } = iterationOverview({ syncStatus:'ok', autonomousIterations:[row] });
  assert.deepEqual(counts, { running:0, waiting:0, problem:0, complete:1, publicationProblem:1 });
});
test('telemetry running without a current exact-head Actions run is not counted as executing', () => {
  const row = item(); const view = iterationPresentation(row);
  assert.equal(row.execution.state, 'idle'); assert.equal(view.status, 'waiting');
  assert.match(view.reason, /Chat側の稼働・停止は判定できません/);
  assert.equal(iterationTimingSteps(row, { syncStatus:'ok' })[0].state, 'waiting');
  assert.equal(progressStepDurationMs(iterationTimingSteps(row, { syncStatus:'ok' })[0]), null);
});
test('current exact validation supersedes stale phase and has no fake completion timestamp', () => {
  const row = item(pull({ body:body({ currentStep:'afterObservation' }) }), [run({ status:'in_progress', conclusion:null })]);
  assert.equal(row.status, 'running'); assert.equal(row.currentStep, 'astraValidation');
  const step = row.steps.find(step => step.id === 'astraValidation');
  assert.equal(step.completedAt, null); assert.equal(step.durationMs, null);
  assert.equal(iterationTimingSteps(row, { syncStatus:'ok' }).find(step => step.id === 'astraValidation').state, 'running');
});
test('old-head failure and old-head running workflow cannot claim the current head is blocked or executing', () => {
  for (const previous of [run({ head_sha:B, conclusion:'failure' }), run({ head_sha:B, status:'in_progress', conclusion:null })]) {
    const row = item(pull(), [previous]);
    assert.equal(row.status, 'waiting'); assert.equal(row.lastFailure, null);
  }
});
test('latest failed exact-head attempt is not hidden by an older success', () => {
  const row = item(pull(), [run({ id:2, conclusion:'failure', updated_at:'2026-09-22T01:06:00Z' }), run()]);
  assert.equal(row.status, 'problem'); assert.equal(row.validatedHead, null);
  assert.equal(row.currentStep, 'astraValidation');
});
test('actual successful validation clears obsolete failed telemetry for the same head', () => {
  const row = item(pull({ body:body({ currentStep:'astraValidation', steps:{ astraValidation:{ state:'problem', startedAt:start, completedAt:end, summary:'old failure' } } }) }), [run()]);
  assert.equal(row.steps.find(step => step.id === 'astraValidation').state, 'done');
  assert.notEqual(row.status, 'problem'); assert.equal(row.validatedHead, A);
});
test('degraded snapshot cannot claim execution or extend a running clock', () => {
  const row = item(pull(), [run({ status:'in_progress', conclusion:null })]);
  assert.equal(iterationPresentation(row, { syncStatus:'degraded' }).status, 'waiting');
  const step = iterationTimingSteps(row, { syncStatus:'degraded' }).find(step => step.id === 'astraValidation');
  assert.equal(step.state, 'waiting'); assert.equal(progressStepDurationMs(step), null);
});
test('recorded durations, including zero, survive waiting and actual merge', () => {
  const row = { ...item(), steps:[{ id:'observation', state:'running', durationMs:0, startedAt:start }] };
  assert.equal(iterationTimingSteps(row, { syncStatus:'ok' })[0].durationMs, 0);
  assert.equal(progressStepDurationMs(iterationTimingSteps(row, { syncStatus:'ok' })[0]), 0);
});
test('genuine iterations are filtered before the recent-session limit', () => {
  const noise = Array.from({ length:130 }, (_, index) => pull({ number:index + 10, title:'PULSE自律改善表示', body:'kuumetsu iteration 1' }));
  const rows = buildAutonomousIterations([...noise, pull({ updated_at:start })], [], { limit:1 });
  assert.equal(rows.length, 1); assert.equal(rows[0].pr.number, 1);
});
test('overview partition separates observed execution, waiting, failure and merged work', () => {
  const rows = [item(), item(pull({ number:2 }), [run({ status:'in_progress', conclusion:null })]),
    item(pull({ number:3 }), [run({ conclusion:'failure' })]), item(pull({ number:4, state:'closed', merged_at:end }))];
  const { counts, entries } = iterationOverview({ syncStatus:'ok', autonomousIterations:rows });
  assert.deepEqual(counts, { running:1, waiting:1, problem:1, complete:1, publicationProblem:0 });
  assert.deepEqual(entries.map(({ view }) => view.status), ['problem', 'running', 'waiting', 'complete']);
});

class Node {
  constructor(tag) { this.tagName=tag; this.children=[]; this.dataset={}; this.attributes={}; this.style={ setProperty(){} }; this.className=''; this.open=false; this.text=''; }
  set textContent(value) { this.text=String(value); this.children=[]; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=nodes; this.text=''; }
  setAttribute(key,value) { this.attributes[key]=String(value); }
  addEventListener() {}
}
const walk = node => [node, ...node.children.flatMap(walk)];
function fakeDocument() {
  const nodes = { '#rapid-iteration-list':new Node('div'), '#rapid-iteration-count':new Node('span') };
  const head = new Node('head');
  return { head, nodes, createElement:tag=>new Node(tag), createElementNS:(_ns,tag)=>new Node(tag),
    querySelector:selector=>nodes[selector] || (selector==='[data-iteration-readable-style]' ? head.children.find(node => 'data-iteration-readable-style' in node.attributes) : null) };
}
test('card reads as game, improvement, status and next action before optional timing, without nested controls', () => {
  const previous = globalThis.document; globalThis.document=fakeDocument();
  try {
    const row = { ...item(), theme:'捕食の進行を表示', id:'run:test/1' };
    const card = renderIterationCard(row, { syncStatus:'ok' });
    assert.equal(card.tagName, 'article'); assert.equal(card.children[0].tagName, 'a');
    assert.equal(card.children[0].href, './iterations.html#iteration=run%3Atest%2F1');
    assert.match(card.children[0].textContent, /実行未確認/); assert.match(card.children[0].textContent, /次：/);
    assert.equal(walk(card.children[0]).some(node=>['details','button','svg'].includes(node.tagName)), false);
    assert.equal(card.children[1].tagName, 'details'); assert.equal(card.children[1].open, false);
    assert.match(card.children[1].textContent, /完了率や品質ではありません/);
    assert.equal(walk(card).some(node=>node.tagName==='h3'&&node.textContent==='捕食の進行を表示'), true);
  } finally { globalThis.document=previous; }
});
test('overview lists only three cards but explicitly exposes omitted records and honest Japanese counts', () => {
  const previous = globalThis.document; const doc = fakeDocument(); globalThis.document=doc;
  try {
    const rows=Array.from({ length:5 }, (_, index)=>({ ...item(pull({ number:index+1 })), id:'test:'+index }));
    renderIterationSummary({ syncStatus:'ok', generatedAt:end, autonomousIterations:rows });
    const root=doc.nodes['#rapid-iteration-list'];
    assert.equal(walk(root).filter(node=>node.tagName==='article').length, 3);
    assert.match(root.textContent, /ほか 2件も見る（全5件）/);
    assert.match(root.textContent, /待機・未確認/); assert.match(root.textContent, /取込済み＝develop/);
    assert.doesNotMatch(root.textContent, / Run ·| Issues ·| Done/);
    assert.equal(doc.head.children.length, 1);
    assert.equal(doc.nodes['#rapid-iteration-count'].textContent, '記録 5件');
  } finally { globalThis.document=previous; }
});
test('untrusted strings are text and iteration identifiers are encoded', () => {
  const previous=globalThis.document; globalThis.document=fakeDocument();
  try {
    const card=renderIterationCard({ ...item(), theme:'<img src=x onerror=alert(1)>', id:'a" onclick="bad' }, { syncStatus:'ok' });
    assert.equal(walk(card).some(node=>node.tagName==='img'), false);
    assert.match(card.children[0].href, /%22/); assert.match(card.textContent, /<img/);
  } finally { globalThis.document=previous; }
});
test('both surfaces use the shared meaning, expose publication evidence and preserve repair/deep links', () => {
  const rapid=readFileSync(new URL('../ops-board/public/rapid-board.js', import.meta.url),'utf8');
  const detail=readFileSync(new URL('../ops-board/public/iterations.js', import.meta.url),'utf8');
  const html=readFileSync(new URL('../ops-board/public/iterations.html', import.meta.url),'utf8');
  assert.match(rapid, /import \{ renderIterationSummary \}/); assert.match(rapid, /renderIterationSummary\(state\)/);
  assert.match(detail, /iterationOverview\(state\)/); assert.match(detail, /renderIterationStatus\(item, state\)/);
  assert.match(detail, /buildIterationRepairPrompt\(item, state\)/); assert.match(detail, /item.publication\?\.url/);
  assert.match(detail, /#iteration=/); assert.match(html, /iteration-waiting-count/); assert.match(html, /iteration-problem-count/);
});
