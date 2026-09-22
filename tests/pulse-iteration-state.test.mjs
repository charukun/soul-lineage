import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autonomousIterationMeta, buildAutonomousIterations, buildDevelopmentSessions } from '../ops-board/development-sessions.mjs';
import { createIterationTelemetry } from '../scripts/autonomous-iteration-telemetry.mjs';
import { iterationPresentation, iterationOverview, iterationTimingSteps, iterationStartAt } from '../ops-board/public/iteration-status.mjs';
import { progressStepDurationMs } from '../ops-board/public/progress-mini.js';
import { renderIterationCard, renderIterationSummary, renderIterationChronology } from '../ops-board/public/iteration-summary.js';

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
test('overview keeps honest status counts independently of chronological ordering', () => {
  const rows = [item(), item(pull({ number:2 }), [run({ status:'in_progress', conclusion:null })]),
    item(pull({ number:3 }), [run({ conclusion:'failure' })]), item(pull({ number:4, state:'closed', merged_at:end }))];
  const { counts, entries } = iterationOverview({ syncStatus:'ok', autonomousIterations:rows });
  assert.deepEqual(counts, { running:1, waiting:1, problem:1, complete:1, publicationProblem:0 });
  assert.deepEqual(entries.map(({ item }) => item.pr.number), [4, 3, 2, 1]);
  assert.deepEqual(Object.fromEntries(entries.map(({ item, view }) => [item.pr.number, view.status])), { 1:'waiting', 2:'running', 3:'problem', 4:'complete' });
});

class Node {
  constructor(tag) { this.tagName=tag; this.children=[]; this.dataset={}; this.attributes={}; this.style={ setProperty(){} }; this.className=''; this.open=false; this.text=''; this.events={}; }
  set textContent(value) { this.text=String(value); this.children=[]; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=nodes; this.text=''; }
  setAttribute(key,value) { this.attributes[key]=String(value); }
  addEventListener(name, handler) { this.events[name]=handler; }
  focus() {}
}
const walk = node => [node, ...node.children.flatMap(walk)];
function fakeDocument() {
  const nodes = { '#rapid-iteration-list':new Node('div'), '#rapid-iteration-count':new Node('span') };
  const head = new Node('head');
  return { head, nodes, createElement:tag=>new Node(tag), createElementNS:(_ns,tag)=>new Node(tag),
    querySelector:selector=>nodes[selector] || (selector==='[data-iteration-readable-style]' ? head.children.find(node => 'data-iteration-readable-style' in node.attributes) : Object.values(nodes).flatMap(walk).find(node => node.id && '#' + node.id === selector)) };
}
test('card keeps the graph visible before explanatory status, without nested interactive controls', () => {
  const previous = globalThis.document; globalThis.document=fakeDocument();
  try {
    const row = { ...item(), theme:'捕食の進行を表示', id:'run:test/1' };
    const card = renderIterationCard(row, { syncStatus:'ok' });
    assert.equal(card.tagName, 'article'); assert.equal(card.children[0].tagName, 'a');
    const main = card.children[0], nodes = walk(main);
    assert.equal(main.href, './iterations.html#iteration=run%3Atest%2F1');
    assert.match(main.textContent, /実行未確認/);
    assert.equal(nodes.some(node=>['details','button','select'].includes(node.tagName)), false);
    assert.equal(walk(card).some(node=>node.tagName==='details'), false);
    assert.equal(nodes.filter(node=>node.tagName==='svg').length, 1);
    assert.ok(nodes.findIndex(node=>node.tagName==='svg') < nodes.findIndex(node=>node.className==='iteration-readable-status'));
    assert.match(main.textContent, /点の高さは所要時間/);
    assert.equal(nodes.some(node=>node.tagName==='h3'&&node.textContent==='捕食の進行を表示'), true);
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
test('both surfaces use shared state and chronological order, preserve repair/deep links and show timing before prose', () => {
  const rapid=readFileSync(new URL('../ops-board/public/rapid-board.js', import.meta.url),'utf8');
  const detail=readFileSync(new URL('../ops-board/public/iterations.js', import.meta.url),'utf8');
  const html=readFileSync(new URL('../ops-board/public/iterations.html', import.meta.url),'utf8');
  assert.match(rapid, /import \{ renderIterationSummary \}/); assert.match(rapid, /renderIterationSummary\(state\)/);
  assert.match(detail, /iterationOverview\(state, \{ order \}\)/); assert.match(detail, /renderIterationStatus\(item, state\)/);
  assert.match(detail, /buildIterationRepairPrompt\(item, state\)/); assert.match(detail, /item.publication\?\.url/);
  assert.match(detail, /#iteration=/); assert.match(html, /iteration-waiting-count/); assert.match(html, /iteration-problem-count/);
  assert.match(detail, /timingPanel\(item, state\), renderIterationStatus\(item, state\)/);
  assert.match(detail, /el\('section', 'iteration-panel iteration-timeline-panel'\)/);
  assert.match(detail, /el\('ol', 'iteration-step-history'\)/);
  assert.match(detail, /clock\(step.startedAt\).*clock\(step.completedAt\)/);
  assert.doesNotMatch(detail, /el\('details'|timingOpen/);
  assert.match(html, /id="iteration-order"/); assert.match(html, /value="oldest"/);
});

test('chronology uses start rather than status or update, supports both directions and never mutates input', () => {
  const older = Object.freeze({ ...item(), id:'old', startedAt:start, updatedAt:'2026-09-23T01:00:00Z' });
  const newer = Object.freeze({ ...item(pull({ number:2, state:'closed', merged_at:end })), id:'new', startedAt:end, updatedAt:end });
  const state = { syncStatus:'ok', autonomousIterations:Object.freeze([older, newer]) };
  assert.deepEqual(iterationOverview(state).entries.map(({ item }) => item.id), ['new', 'old']);
  assert.deepEqual(iterationOverview(state, { order:'oldest' }).entries.map(({ item }) => item.id), ['old', 'new']);
  const changed = { ...state, autonomousIterations:[{ ...older, steps:[{ id:'merge', state:'problem' }] }, newer] };
  assert.deepEqual(iterationOverview(changed).entries.map(({ item }) => item.id), ['new', 'old']);
  assert.deepEqual(state.autonomousIterations.map(item => item.id), ['old', 'new']);
});
test('earliest recorded step is the explicit legacy fallback; update time never fabricates a start', () => {
  assert.equal(iterationStartAt({ startedAt:start, steps:[{ startedAt:end }] }), start);
  assert.equal(iterationStartAt({ startedAt:'invalid', steps:[{ startedAt:end }, { startedAt:start }] }), start);
  assert.equal(iterationStartAt({ updatedAt:end, steps:[{ completedAt:end }] }), null);
  const known={ ...item(), id:'known', startedAt:start }, unknown={ ...known, id:'unknown', startedAt:null, steps:[], updatedAt:end };
  for (const order of ['newest', 'oldest']) {
    assert.deepEqual(iterationOverview({ autonomousIterations:[unknown, known] }, { order }).entries.map(({ item }) => item.id), ['known', 'unknown']);
  }
});
test('three sequential iterations and a parallel run retain identities in chronological order', () => {
  const rows = [1, 2, 3].map(n => ({ ...item(), id:'run-a:'+n, runKey:'run-a', iteration:n, startedAt:`2026-09-22T0${n}:00:00Z` }));
  rows.push({ ...rows[0], id:'run-b:1', runKey:'run-b', startedAt:'2026-09-22T02:30:00Z' });
  assert.deepEqual(iterationOverview({ autonomousIterations:rows }, { order:'oldest' }).entries.map(({ item }) => item.id), ['run-a:1', 'run-a:2', 'run-b:1', 'run-a:3']);
  const tied = rows.slice(0, 3).reverse().map(row => ({ ...row, startedAt:start }));
  assert.deepEqual(iterationOverview({ autonomousIterations:tied }, { order:'oldest' }).entries.map(({ item }) => item.iteration), [1, 2, 3]);
});
test('chronology has machine-readable start and real merge times, without invented completion', () => {
  const previous=globalThis.document; globalThis.document=fakeDocument();
  try {
    const row = renderIterationChronology({ startedAt:start, mergedAt:end });
    assert.deepEqual(walk(row).filter(node=>node.tagName==='time').map(node=>node.dateTime), [start, end]);
    assert.match(row.textContent, /開始/); assert.match(row.textContent, /develop反映/);
    const legacy = renderIterationChronology({ updatedAt:end, steps:[] });
    assert.match(legacy.textContent, /時刻未記録/); assert.doesNotMatch(legacy.textContent, /develop反映/);
    assert.equal(walk(legacy).some(node=>node.dateTime), false);
  } finally { globalThis.document=previous; }
});
test('overview order control changes the visible three records and carries order to details', () => {
  const previous=globalThis.document; const doc=fakeDocument(); globalThis.document=doc;
  try {
    const rows=Array.from({ length:5 }, (_, n)=>({ ...item(), id:'row:'+n, startedAt:`2026-09-22T0${n}:00:00Z` }));
    renderIterationSummary({ syncStatus:'ok', autonomousIterations:rows });
    const cards = () => walk(doc.nodes['#rapid-iteration-list']).filter(node=>node.tagName==='article');
    assert.deepEqual(cards().map(node=>node.dataset.iterationId), ['row:4', 'row:3', 'row:2']);
    doc.querySelector('#rapid-iteration-order').events.change({ target:{ value:'oldest' } });
    assert.deepEqual(cards().map(node=>node.dataset.iterationId), ['row:0', 'row:1', 'row:2']);
    assert.match(cards()[0].children[0].href, /\?order=oldest#iteration=/);
    assert.equal(doc.querySelector('#rapid-iteration-order').value, 'oldest');
    assert.equal(walk(doc.nodes['#rapid-iteration-list']).find(node=>node.className==='iteration-all-link').href, './iterations.html?order=oldest');
    doc.querySelector('#rapid-iteration-order').events.change({ target:{ value:'newest' } });
  } finally { globalThis.document=previous; }
});
test('visible summary preserves recorded phase order and keeps After before final validation', () => {
  const previous=globalThis.document; globalThis.document=fakeDocument();
  try {
    const ids=['observation','implementation','afterObservation','astraValidation','merge','devPublish'];
    const row={ ...item(), steps:ids.map(id=>({ id, state:'done', durationMs:0 })) };
    const card=renderIterationCard(row, { syncStatus:'ok' });
    const labels=walk(card).filter(node=>node.className.startsWith('rapid-progress-label '));
    assert.deepEqual(labels.map(node=>node.children[0].textContent), ['事前確認','修正','改善確認','最終検証','反映','公開']);
    assert.equal(labels.every(node=>node.children[1].textContent==='0.0s'), true);
  } finally { globalThis.document=previous; }
});
