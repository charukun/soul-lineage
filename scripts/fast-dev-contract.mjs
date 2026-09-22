import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const FAST_DEV_LIFECYCLE_KEYS = Object.freeze(['predev','prebuild','build','postbuild']);
export const FAST_DEV_WORKFLOW_ALLOWLIST = Object.freeze([
  '.github/workflows/astra-work-validation.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/dev-app-publish.yml',
  '.github/workflows/distribution-artifact.yml',
]);

export const FAST_DEV_PROTECTED_PATHS = Object.freeze([
  '.github/workflows/astra-work-validation.yml',
  'scripts/fast-dev-contract.mjs',
  'scripts/astra-focused-validation.mjs',
  'scripts/workspaces.mjs',
]);

const git = args => execFileSync('git', args, { encoding:'utf8', maxBuffer:16 * 1024 * 1024 });
const mergeBase = (base, head) => git(['merge-base',base,head]).trim();
const workflowPathsAt = ref => git(['ls-tree','-r','--name-only',ref,'--','.github/workflows'])
  .split(/\r?\n/).filter(Boolean).filter(path => path.endsWith('.yml') || path.endsWith('.yaml'));

const changedRows = (base, head) => git(['diff','--name-status','--no-renames',base,head])
  .split(/\r?\n/).filter(Boolean).map(line => {
    const [status, ...rest] = line.split('\t');
    return { status, path:rest.at(-1) || '' };
  });
const readAt = (ref, path) => {
  try { return git(['show',`${ref}:${path}`]); }
  catch { return null; }
};

export function countFastDevTests(source='') {
  return (String(source).match(/^\s*(?:test|it)(?:\.(?:skip|todo|only))?\s*\(/gm) || []).length;
}

const lifecycleViolations = (base, head, path) => {
  const before = readAt(base,path), after = readAt(head,path);
  if (!after) return [];
  let a, b;
  try { a = before ? JSON.parse(before) : {}; b = JSON.parse(after); }
  catch { return [{code:'FAST_DEV_PACKAGE_PARSE_FAILED',path,detail:'package.json could not be compared safely'}]; }
  return FAST_DEV_LIFECYCLE_KEYS.flatMap(key => {
    const oldValue = a.scripts?.[key] ?? null;
    const newValue = b.scripts?.[key] ?? null;
    return oldValue === newValue ? [] : [{code:'FAST_DEV_LIFECYCLE_CHANGED',path,detail:`${key}: ${JSON.stringify(oldValue)} -> ${JSON.stringify(newValue)}`}];
  });
};

export function inspectFastDevContract(base, head, {bootstrap=false}={}) {
  if (bootstrap) return Object.freeze({state:'clean',bootstrap:true,violations:[]});
  const branchBase = mergeBase(base, head);
  const violations = [], protectedSet = new Set(FAST_DEV_PROTECTED_PATHS);
  for (const row of changedRows(branchBase,head)) {
    if (!row.path) continue;
    if (row.path.startsWith('.github/workflows/')) {
      violations.push({code:'ACTIONS_WORKFLOW_CHANGED',path:row.path,detail:'Routine work may not expand or rewrite GitHub Actions.'});
      continue;
    }
    if (protectedSet.has(row.path)) {
      violations.push({code:'FAST_DEV_CONTROL_CHANGED',path:row.path,detail:'This file is part of the frozen Fast DEV execution graph.'});
      continue;
    }
    if (/^apps\/[^/]+\/package\.json$/.test(row.path)) violations.push(...lifecycleViolations(branchBase,head,row.path));
  }
  return Object.freeze({state:violations.length?'violation':'clean',bootstrap:false,violations:Object.freeze(violations)});
}

export function inspectAuthorizedFreshnessHardening(base, head) {
  const branchBase = mergeBase(base, head);
  const violations = [];
  const allowed = new Set([
    '.github/workflows/astra-work-validation.yml',
    'scripts/fast-dev-contract.mjs',
    'AGENTS.md',
    'docs/DEVELOPMENT.md',
    'docs/DEVELOP_MERGE.md',
  ]);
  for (const row of changedRows(branchBase,head)) {
    if (!row.path || allowed.has(row.path)) continue;
    if (/^apps\/[^/]+\/package\\.json$/.test(row.path)) violations.push(...lifecycleViolations(branchBase,head,row.path));
    else if (/\\.test\\.mjs$/.test(row.path) && row.status !== 'D') {
      const before=countFastDevTests(readAt(branchBase,row.path)||''), after=countFastDevTests(readAt(head,row.path)||'');
      if (after>before) violations.push({code:'TEST_INVENTORY_EXPANDED',path:row.path,detail:`Actions test declarations increased ${before} -> ${after}.`});
    } else violations.push({code:'FRESHNESS_HARDENING_SCOPE_EXPANDED',path:row.path,detail:'Explicit freshness hardening may only change the Astra validation workflow and its contract checker.'});
  }
  const workflow=readAt(head,'.github/workflows/astra-work-validation.yml')||'';
  for (const token of ['VALIDATION_BASE_SHA','merge-tree','affectedForDev','ASTRA_REVALIDATE_REQUIRED','astra/merge-freshness']) {
    if (!workflow.includes(token)) violations.push({code:'FRESHNESS_GATE_MISSING',path:'.github/workflows/astra-work-validation.yml',detail:`Required freshness guard token missing: ${token}`});
  }
  return Object.freeze({state:violations.length?'violation':'clean',authorizedFreshnessHardening:true,violations:Object.freeze(violations)});
}

export function inspectAuthorizedFastDevRestore(base, head) {
  const violations = [];
  const after = workflowPathsAt(head);
  const expected = new Set(FAST_DEV_WORKFLOW_ALLOWLIST);
  const unexpected = after.filter(path => !expected.has(path));
  const missing = FAST_DEV_WORKFLOW_ALLOWLIST.filter(path => !after.includes(path));
  if (unexpected.length) violations.push({code:'RESTORE_UNEXPECTED_WORKFLOW',path:unexpected.join(', '),detail:'Emergency restore may only reinstate the canonical pre-incident workflow surface.'});
  if (missing.length) violations.push({code:'RESTORE_REQUIRED_WORKFLOW_MISSING',path:missing.join(', '),detail:'Emergency restore must reinstate the complete canonical pre-incident workflow surface.'});
  if (!after.includes('.github/workflows/dev-app-publish.yml')) violations.push({code:'DEV_PUBLISH_NOT_RESTORED',path:'.github/workflows/dev-app-publish.yml',detail:'Automatic DEV publication must be restored.'});
  return Object.freeze({state:violations.length?'violation':'clean',authorizedRestore:true,afterWorkflows:Object.freeze(after),violations:Object.freeze(violations)});
}

export function inspectAuthorizedFastDevContraction(base, head) {
  const branchBase = mergeBase(base, head);
  const violations = [];
  const before = workflowPathsAt(branchBase);
  const after = workflowPathsAt(head);
  const canonical = new Set(FAST_DEV_WORKFLOW_ALLOWLIST);
  const allowedChanges = new Set([
    '.github/workflows/astra-work-validation.yml',
    'scripts/fast-dev-contract.mjs',
    'scripts/astra-focused-validation.mjs',
    'scripts/actions-result-summary.mjs',
    'scripts/lib/actions-summary-core.mjs',
    'tests/actions-result-summary.test.mjs',
    'AGENTS.md',
    'docs/DEVELOPMENT.md',
    'docs/DEVELOP_MERGE.md',
  ]);
  const added = after.filter(path => !before.includes(path));
  const unexpected = after.filter(path => !canonical.has(path));
  const missing = FAST_DEV_WORKFLOW_ALLOWLIST.filter(path => !after.includes(path));
  if (added.length) violations.push({code:'ACTIONS_WORKFLOW_ADDED',path:added.join(', '),detail:'Authorized Fast DEV contraction may not add workflows.'});
  if (unexpected.length) violations.push({code:'ACTIONS_WORKFLOW_SURFACE_EXPANDED',path:unexpected.join(', '),detail:'Only the canonical Fast DEV, Production, and explicit distribution workflows may remain.'});
  if (missing.length) violations.push({code:'REQUIRED_WORKFLOW_REMOVED',path:missing.join(', '),detail:'A required workflow was removed.'});
  if (after.length > before.length) violations.push({code:'ACTIONS_WORKFLOW_COUNT_EXPANDED',path:'.github/workflows',detail:`Workflow count may stay equal or shrink, never grow (${before.length} -> ${after.length}).`});
  for (const row of changedRows(branchBase,head)) {
    if (!row.path || allowedChanges.has(row.path)) continue;
    if (/^apps\/[^/]+\/package\.json$/.test(row.path)) violations.push(...lifecycleViolations(branchBase,head,row.path));
    else violations.push({code:'CONTRACTION_SCOPE_EXPANDED',path:row.path,detail:'Fast DEV contraction may only change the validation workflow, anti-expansion contract, focused runner, status-first Actions inspector, its focused test, and execution docs.'});
  }
  const workflow=readAt(head,'.github/workflows/astra-work-validation.yml')||'';
  for (const token of ['fetch-depth: 1','scripts/astra-focused-validation.mjs plan','scripts/astra-focused-validation.mjs run','needs_install','npm ci --ignore-scripts','astra/merge-freshness','ASTRA_REVALIDATE_REQUIRED']) {
    if (!workflow.includes(token)) violations.push({code:'FAST_DEV_MINIMAL_PATH_MISSING',path:'.github/workflows/astra-work-validation.yml',detail:`Required minimal validation token missing: ${token}`});
  }
  for (const token of ['fetch-depth: 0','node scripts/validate.mjs dev','Run changed focused tests','scripts/check.mjs','scripts/code-health.mjs','scripts/visual-budget.mjs']) {
    if (workflow.includes(token)) violations.push({code:'FAST_DEV_HEAVY_PATH_RETAINED',path:'.github/workflows/astra-work-validation.yml',detail:`Heavy legacy validation token remains: ${token}`});
  }
  const focused=readAt(head,'scripts/astra-focused-validation.mjs')||'';
  for (const token of ['Astra-Validation','Astra-Check','Astra-Test','Astra-Build','execFileSync']) {
    if (!focused.includes(token)) violations.push({code:'FOCUSED_RUNNER_CONTRACT_MISSING',path:'scripts/astra-focused-validation.mjs',detail:`Focused runner token missing: ${token}`});
  }
  return Object.freeze({state:violations.length?'violation':'clean',authorizedContraction:true,beforeWorkflows:Object.freeze(before),afterWorkflows:Object.freeze(after),violations:Object.freeze(violations)});
}

function writeSummary(receipt) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines=receipt.state==='clean'
    ? ['## Fast DEV contract: clean',receipt.authorizedContraction?'Explicitly authorized workflow contraction passed.':receipt.bootstrap?'Bootstrap run: current develop did not contain the trusted checker yet.':'No Actions execution expansion detected.']
    : ['## Fast DEV contract: violation','The remaining focused tests/builds were intentionally skipped. Repair this same branch / PR and validate a new final head.','',...receipt.violations.map(row=>`- **${row.code}** \`${row.path}\` — ${row.detail}`)];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isMain){
  const base=process.argv[2],head=process.argv[3]||'HEAD';
  if(!base)throw new Error('Usage: node fast-dev-contract.mjs <base> <head> [--bootstrap]');
  const receipt=process.argv.includes('--authorized-restore')
    ? inspectAuthorizedFastDevRestore(base,head)
    : process.argv.includes('--authorized-contraction')
    ? inspectAuthorizedFastDevContraction(base,head)
    : process.argv.includes('--authorized-freshness-hardening')
      ? inspectAuthorizedFreshnessHardening(base,head)
      : inspectFastDevContract(base,head,{bootstrap:process.argv.includes('--bootstrap')});
  console.log(JSON.stringify(receipt,null,2));
  writeSummary(receipt);
  if(receipt.state!=='clean')process.exitCode=42;
}
