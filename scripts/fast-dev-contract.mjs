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
  'scripts/validate.mjs',
  'scripts/affected.mjs',
  'scripts/workspaces.mjs',
  'scripts/check.mjs',
  'scripts/visual-budget.mjs',
  'scripts/code-health.mjs',
  'scripts/check-character-production.mjs',
  'scripts/develop-completion-contract.mjs',
  'scripts/prepare-basis-assets.mjs',
  'scripts/prepare-kaykit-foundation.mjs',
  'scripts/prepare-rinne-effects.mjs',
  'scripts/strip-retired-character-assets.mjs',
  'scripts/verify-build.mjs',
  'scripts/vite-app.mjs',
]);

const git = args => execFileSync('git', args, { encoding:'utf8', maxBuffer:16 * 1024 * 1024 });
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
  const violations = [], protectedSet = new Set(FAST_DEV_PROTECTED_PATHS);
  for (const row of changedRows(base,head)) {
    if (!row.path) continue;
    if (row.path.startsWith('.github/workflows/')) {
      violations.push({code:'ACTIONS_WORKFLOW_CHANGED',path:row.path,detail:'Routine work may not expand or rewrite GitHub Actions.'});
      continue;
    }
    if (protectedSet.has(row.path)) {
      violations.push({code:'FAST_DEV_CONTROL_CHANGED',path:row.path,detail:'This file is part of the frozen Fast DEV execution graph.'});
      continue;
    }
    if (/^apps\/[^/]+\/package\.json$/.test(row.path)) violations.push(...lifecycleViolations(base,head,row.path));
    if (/\.test\.mjs$/.test(row.path) && row.status !== 'D') {
      const before=countFastDevTests(readAt(base,row.path)||''), after=countFastDevTests(readAt(head,row.path)||'');
      if (after>before) violations.push({code:'TEST_INVENTORY_EXPANDED',path:row.path,detail:`Actions test declarations increased ${before} -> ${after}.`});
    }
  }
  return Object.freeze({state:violations.length?'violation':'clean',bootstrap:false,violations:Object.freeze(violations)});
}

export function inspectAuthorizedFastDevContraction(base, head) {
  const violations = [];
  const before = workflowPathsAt(base);
  const after = workflowPathsAt(head);
  const allowed = new Set(FAST_DEV_WORKFLOW_ALLOWLIST);
  const added = after.filter(path => !before.includes(path));
  const unexpected = after.filter(path => !allowed.has(path));
  const missing = FAST_DEV_WORKFLOW_ALLOWLIST.filter(path => !after.includes(path));
  if (added.length) violations.push({code:'ACTIONS_WORKFLOW_ADDED',path:added.join(', '),detail:'Authorized Fast DEV cleanup may contract the workflow surface but may not add workflows.'});
  if (unexpected.length) violations.push({code:'ACTIONS_WORKFLOW_SURFACE_NOT_PRUNED',path:unexpected.join(', '),detail:'Only the canonical Fast DEV, Production, and explicit distribution workflows may remain.'});
  if (missing.length) violations.push({code:'REQUIRED_WORKFLOW_REMOVED',path:missing.join(', '),detail:'A required Fast DEV, Production, or explicit distribution workflow was removed.'});
  if (after.length >= before.length) violations.push({code:'ACTIONS_WORKFLOW_COUNT_NOT_REDUCED',path:'.github/workflows',detail:`Workflow count must shrink for an authorized contraction (${before.length} -> ${after.length}).`});
  for (const row of changedRows(base,head)) {
    if (!row.path) continue;
    if (/^apps\/[^/]+\/package\.json$/.test(row.path)) violations.push(...lifecycleViolations(base,head,row.path));
    if (/\.test\.mjs$/.test(row.path) && row.status !== 'D') {
      const beforeCount=countFastDevTests(readAt(base,row.path)||''), afterCount=countFastDevTests(readAt(head,row.path)||'');
      if (afterCount>beforeCount) violations.push({code:'TEST_INVENTORY_EXPANDED',path:row.path,detail:`Actions test declarations increased ${beforeCount} -> ${afterCount}.`});
    }
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
  const receipt=process.argv.includes('--authorized-contraction')
    ? inspectAuthorizedFastDevContraction(base,head)
    : inspectFastDevContract(base,head,{bootstrap:process.argv.includes('--bootstrap')});
  console.log(JSON.stringify(receipt,null,2));
  writeSummary(receipt);
  if(receipt.state!=='clean')process.exitCode=42;
}
