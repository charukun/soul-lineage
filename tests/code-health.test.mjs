import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSource, buildAuditReport, duplicateGroups, evaluateGuard, isSourcePath, loadCodeHealthConfig, sanitizeSource } from '../scripts/code-health.mjs';
import { buildDispatchArtifacts, CODE_HEALTH_AUTO_MARKER } from '../scripts/code-health-dispatch.mjs';

const config = await loadCodeHealthConfig();

function block(lines, decisions = false) {
  const body = Array.from({ length: lines }, (_, index) => decisions ? `if (flag${index}) value += ${index};` : `value += ${index};`).join('\n');
  return `export function large(value) {\n${body}\nreturn value;\n}\n`;
}

test('source scope excludes tests, vendor and generated code', () => {
  assert.equal(isSourcePath('apps/rinne/src/game.js', config), true);
  assert.equal(isSourcePath('packages/world/src/state.mjs', config), true);
  assert.equal(isSourcePath('apps/rinne/tests/game.test.mjs', config), false);
  assert.equal(isSourcePath('apps/demon/public/assets/vendor/lib.js', config), false);
  assert.equal(isSourcePath('tests/integration.test.mjs', config), false);
});

test('sanitizer removes comments and strings without collapsing lines', () => {
  const input = `const a = "if fake"; // if fake\n/* for fake\nwhile fake */\nif (real) {\n  return 'case fake';\n}`;
  const output = sanitizeSource(input);
  assert.equal(output.split('\n').length, input.split('\n').length);
  assert.doesNotMatch(output, /fake/);
  assert.match(output, /if \(real\)/);
});

test('analysis detects long functions and decision density', () => {
  const metric = analyzeSource(block(140, true), 'apps/rinne/src/hotspot.js');
  assert.ok(metric.loc > 130);
  assert.ok(metric.maxFunctionSpan >= 140);
  assert.ok(metric.decisions >= 130);
  assert.ok(metric.decisionDensity > 50);
});

test('duplicate detector finds substantial cross-file clones but ignores tiny snippets', () => {
  const shared = Array.from({ length: 12 }, (_, index) => `if (state.step${index}) total += state.value${index};`).join('\n');
  const groups = duplicateGroups([
    { path: 'apps/rinne/src/a.js', source: `function a(state) {\n${shared}\n}` },
    { path: 'apps/village/src/b.js', source: `function b(state) {\n${shared}\n}` },
    { path: 'apps/demon/src/c.js', source: 'export const c = 1;' },
  ], config);
  assert.ok(groups.length > 0);
  assert.ok(groups.some(group => new Set(group.occurrences.map(item => item.path)).size >= 2));
});

test('audit ranks a structural hotspot actionable while small modules remain quiet', () => {
  const report = buildAuditReport([
    { path: 'apps/rinne/src/hot.js', source: block(1550) },
    { path: 'packages/world/src/tiny.js', source: 'export const tiny = () => 1;\n' },
  ], config, '2026-09-14T00:00:00.000Z');
  assert.equal(report.summary.actionable, true);
  assert.equal(report.candidates[0].path, 'apps/rinne/src/hot.js');
  assert.equal(report.candidates[0].actionable, true);
  assert.equal(report.candidates.at(-1).actionable, false);
});

test('guard permits small edits to legacy hotspots but rejects material new growth', () => {
  const base = analyzeSource(block(700), 'apps/rinne/src/a.js');
  const small = analyzeSource(block(730), 'apps/rinne/src/a.js');
  const large = analyzeSource(block(850), 'apps/rinne/src/a.js');
  assert.deepEqual(evaluateGuard(base, small, config, 'apps/rinne/src/a.js'), []);
  assert.ok(evaluateGuard(base, large, config, 'apps/rinne/src/a.js').some(item => item.reason.includes('grew by')));
});

test('guard rejects a newly introduced monolith and long function', () => {
  const current = analyzeSource(block(950), 'apps/rinne/src/new.js');
  const violations = evaluateGuard(null, current, config, 'apps/rinne/src/new.js');
  assert.ok(violations.some(item => item.reason.includes('new source file')));
});

test('dispatch artifacts focus one hotspot and preserve existing Dispatcher lifecycle', () => {
  const report = buildAuditReport([
    { path: 'apps/rinne/src/hot.js', source: block(1550) },
  ], config, '2026-09-14T00:00:00.000Z');
  const artifacts = buildDispatchArtifacts(report);
  assert.match(artifacts.body, new RegExp(CODE_HEALTH_AUTO_MARKER));
  assert.match(artifacts.body, /RINNE-Dispatch: implementation/);
  assert.match(artifacts.body, /## Request/);
  assert.match(artifacts.request, /1ホットスポットだけ/);
  assert.match(artifacts.request, /テストやブラウザassertion/);
  assert.match(artifacts.marker, /temporary bootstrap state/);
});
