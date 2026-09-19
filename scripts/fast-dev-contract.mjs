import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const FAST_DEV_LIFECYCLE_KEYS = Object.freeze(['predev','prebuild','build','postbuild']);
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

function writeSummary(receipt) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines=receipt.state==='clean'
    ? ['## Fast DEV contract: clean',receipt.bootstrap?'Bootstrap run: current develop did not contain the trusted checker yet.':'No Actions execution expansion detected.']
    : ['## Fast DEV contract: violation','The remaining focused tests/builds were intentionally skipped. Repair this same branch / PR and validate a new final head.','',...receipt.violations.map(row=>`- **${row.code}** \`${row.path}\` — ${row.detail}`)];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n')+'\n');
}

const isMain=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(isMain){
  const base=process.argv[2],head=process.argv[3]||'HEAD';
  if(!base)throw new Error('Usage: node fast-dev-contract.mjs <base> <head> [--bootstrap]');
  const receipt=inspectFastDevContract(base,head,{bootstrap:process.argv.includes('--bootstrap')});
  console.log(JSON.stringify(receipt,null,2));
  writeSummary(receipt);
  if(receipt.state!=='clean')process.exitCode=42;
}
