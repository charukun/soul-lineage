import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const message = process.env.ASTRA_COMMIT_MESSAGE || '';
const mode = process.argv[2] || 'run';

function cleanPath(value, kind) {
  const raw=String(value||'').trim().replaceAll('\\','/');
  if (!raw || path.posix.isAbsolute(raw) || raw.includes('\0')) throw new Error(`Invalid ${kind} path: ${value}`);
  const normalized=path.posix.normalize(raw);
  if (normalized==='..' || normalized.startsWith('../')) throw new Error(`Path escapes repository: ${value}`);
  return normalized;
}

function parsePlan(source) {
  const plan={ none:false, checks:[], tests:[], builds:[] };
  for (const line of String(source).split(/\r?\n/)) {
    const match=line.match(/^Astra-(Validation|Check|Test|Build):\s*(.+?)\s*$/);
    if (!match) continue;
    const [,kind,value]=match;
    if (kind==='Validation') {
      if (value!=='none') throw new Error('Astra-Validation only supports: none');
      plan.none=true;
    } else if (kind==='Check') plan.checks.push(cleanPath(value,'check'));
    else if (kind==='Test') plan.tests.push(cleanPath(value,'test'));
    else if (kind==='Build') plan.builds.push(String(value).trim());
  }
  plan.checks=[...new Set(plan.checks)];
  plan.tests=[...new Set(plan.tests)];
  plan.builds=[...new Set(plan.builds)];
  const hasWork=plan.checks.length||plan.tests.length||plan.builds.length;
  if (!plan.none && !hasWork) throw new Error('Final [astra-validate] commit must declare Astra-Validation: none or at least one Astra-Check/Test/Build directive.');
  if (plan.none && hasWork) throw new Error('Astra-Validation: none cannot be combined with Astra-Check/Test/Build.');
  for (const file of plan.checks) {
    if (!/\.(?:c|m)?js$/.test(file)) throw new Error(`Astra-Check only accepts JS files: ${file}`);
    if (!existsSync(file)) throw new Error(`Astra-Check target does not exist: ${file}`);
  }
  for (const file of plan.tests) {
    if (!file.endsWith('.test.mjs')) throw new Error(`Astra-Test only accepts .test.mjs files: ${file}`);
    if (!existsSync(file)) throw new Error(`Astra-Test target does not exist: ${file}`);
  }
  for (const app of plan.builds) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(app)) throw new Error(`Invalid Astra-Build app id: ${app}`);
    const manifest=`apps/${app}/package.json`;
    if (!existsSync(manifest)) throw new Error(`Unknown Astra-Build app: ${app}`);
    const pkg=JSON.parse(readFileSync(manifest,'utf8'));
    if (!pkg.scripts?.build) throw new Error(`Astra-Build app has no build script: ${app}`);
  }
  return Object.freeze(plan);
}

function output(name,value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,`${name}=${String(value)}\n`);
}

const plan=parsePlan(message);
const summary=plan.none
  ? 'none'
  : [
      ...plan.checks.map(value=>`check:${value}`),
      ...plan.tests.map(value=>`test:${value}`),
      ...plan.builds.map(value=>`build:${value}`),
    ].join(', ');

if (mode==='plan') {
  output('needs_install',plan.tests.length>0||plan.builds.length>0);
  output('has_work',!plan.none);
  output('summary',summary);
  console.log(`Astra focused validation plan: ${summary}`);
} else if (mode==='run') {
  if (plan.none) {
    console.log('Astra explicitly selected no task-specific runner command for this exact head.');
    process.exit(0);
  }
  for (const file of plan.checks) execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
  if (plan.tests.length) execFileSync(process.execPath,['--test',...plan.tests],{stdio:'inherit'});
  for (const app of plan.builds) {
    const pkg=JSON.parse(readFileSync(`apps/${app}/package.json`,'utf8'));
    execFileSync('npm',['run','build','--workspace',pkg.name],{stdio:'inherit'});
  }
  console.log(`Astra focused validation passed: ${summary}`);
} else {
  throw new Error('Use: node scripts/astra-focused-validation.mjs plan|run');
}
