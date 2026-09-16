import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSource, buildAuditReport, evaluateGuard, formatMarkdownReport, loadCodeHealthConfig } from '../scripts/code-health.mjs';
import { buildDispatchArtifacts } from '../scripts/code-health-dispatch.mjs';

const config = await loadCodeHealthConfig();

function compactSource(targetBytes) {
  const prefix = 'export const compact=';
  const suffix = '0;\n';
  const repeat = Math.max(1, Math.ceil((targetBytes - prefix.length - suffix.length) / 2));
  return `${prefix}${'1+'.repeat(repeat)}${suffix}`;
}

test('analysis exposes UTF-8 source bytes and unique direct dependency breadth', () => {
  const source = `import './a.js';\nimport { b } from './b.js';\nexport { c } from './b.js';\nconst d = require('./c.cjs');\n`;
  const metric = analyzeSource(source, 'apps/rinne/src/sample.js');
  assert.equal(metric.sourceBytes, Buffer.byteLength(source, 'utf8'));
  assert.equal(metric.directDependencies, 3);
});

test('byte-heavy low-LOC source becomes an actionable AI context hotspot', () => {
  const source = compactSource(config.thresholds.contextBytesHard + 1024);
  const report = buildAuditReport([{ path: 'apps/village/src/game/compact.js', source }], config, '2026-09-17T00:00:00.000Z');
  const candidate = report.candidates[0];
  assert.ok(candidate.loc <= 2);
  assert.ok(candidate.sourceBytes > config.thresholds.contextBytesHard);
  assert.equal(candidate.actionable, true);
  assert.ok(candidate.reasons.some(reason => reason.includes('KiB source context')));
  assert.equal(report.summary.contextHotspots, 1);
  assert.match(formatMarkdownReport(report), /direct deps/);
});

test('guard catches context growth even when LOC stays flat', () => {
  const path = 'apps/village/src/game/compact.js';
  const base = analyzeSource(compactSource(config.thresholds.contextBytesSoft + 1024), path);
  const current = analyzeSource(compactSource(base.sourceBytes + config.guard.existingContextByteIncrease + 1024), path);
  assert.equal(base.loc, current.loc);
  const violations = evaluateGuard(base, current, config, path);
  assert.ok(violations.some(item => item.reason.includes('AI context surface grew by')));
});

test('guard rejects a new source that exceeds the AI context creation limit', () => {
  const path = 'apps/rinne/src/game/new-compact.js';
  const current = analyzeSource(compactSource(config.guard.newFileContextBytes + 1024), path);
  const violations = evaluateGuard(null, current, config, path);
  assert.ok(violations.some(item => item.reason.includes('AI context surface')));
});

test('dispatch carries context-surface evidence into the existing one-hotspot request', () => {
  const imports = Array.from({ length: 7 }, (_, index) => `import './dep-${index}.js';`).join('\n');
  const source = `${imports}\n${compactSource(config.thresholds.contextBytesHard + 1024)}`;
  const report = buildAuditReport([{ path: 'apps/village/src/game/context-hotspot.js', source }], config, '2026-09-17T00:00:00.000Z');
  const artifacts = buildDispatchArtifacts(report);
  assert.match(artifacts.request, /AI context surface/);
  assert.match(artifacts.request, /必要な責務だけを読めるmodule境界/);
  assert.match(artifacts.marker, /KiB source context/);
  assert.match(artifacts.marker, /direct dependencies/);
});
