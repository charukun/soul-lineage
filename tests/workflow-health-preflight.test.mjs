import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const health = readFileSync('.github/workflows/code-health.yml', 'utf8');
const pulse = readFileSync('.github/workflows/ops-board.yml', 'utf8');

function runBlock(workflow, name) {
  const step = workflow.split(`      - name: ${name}\n`)[1]?.split(/^      - /m)[0];
  assert.ok(step, `Missing workflow step: ${name}`);
  const block = step.split('        run: |\n')[1];
  assert.ok(block, `Missing shell block: ${name}`);
  return block.split('\n').filter(line => line.startsWith('          '))
    .map(line => line.slice(10)).join('\n');
}

function shell(script, env = {}) {
  return spawnSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
    encoding: 'utf8', env: { ...process.env, ...env },
  });
}

test('Code Health initializes all audit paths after the runner starts', () => {
  const beforeSteps = health.split('    steps:')[0];
  assert.doesNotMatch(beforeSteps, /\$\{\{\s*runner\./);
  const directory = mkdtempSync(join(tmpdir(), 'code-health-workflow-'));
  try {
    const output = join(directory, 'github-env');
    const result = shell(runBlock(health, 'Initialize audit paths'), {
      RUNNER_TEMP: directory, GITHUB_ENV: output,
    });
    assert.equal(result.status, 0, result.stderr);
    const values = Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n')
      .map(line => line.split('=')));
    assert.deepEqual(values, {
      REPORT_FILE: join(directory, 'code-health-report.json'),
      MARKER_FILE: join(directory, 'code-health-task-start.md'),
      BODY_FILE: join(directory, 'code-health-pr-body.md'),
      DISPATCH_FILE: join(directory, 'code-health-dispatch.json'),
    });
    assert.ok(health.indexOf('name: Initialize audit paths') < health.indexOf('name: Audit source health'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('PULSE workflow shell checks accept the current disclosure UI', () => {
  const script = runBlock(pulse, 'Fast PULSE verification');
  const checks = script.slice(script.indexOf("grep -q '<title>PULSE</title>'"));
  assert.ok(checks.startsWith('grep -q'), 'Expected existing preflight assertions');
  const result = shell(checks);
  assert.equal(result.status, 0, result.stderr);
});

test('public PULSE shell checks accept the current UI and reject missing operations content', () => {
  const checks = runBlock(pulse, 'Verify public board and API').split('\n')
    .filter(line => /^(?:! )?printf .*\| grep /.test(line)).join('\n');
  assert.ok(checks.includes('diagnostic-grid'), 'Public diagnostic assertion must remain');
  const page = readFileSync('ops-board/public/index.html', 'utf8');
  assert.equal(shell(checks, { page }).status, 0);
  assert.notEqual(shell(checks, { page: page.replaceAll('技術詳細', '') }).status, 0);
  assert.notEqual(shell(checks, { page: page.replaceAll('diagnostic-grid', '') }).status, 0);
});
