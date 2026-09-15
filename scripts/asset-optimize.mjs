import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { STYLIZED_ART_PROFILES } from '../packages/characters/src/art-direction.js';

export const ASSET_COMPILER_VERSION = 1;
export const ASSET_ROLES = Object.freeze(Object.keys(STYLIZED_ART_PROFILES));
const CHARACTER_ROLES = new Set(['hero', 'npc', 'enemy']);
const SOURCE_EXTENSIONS = new Set(['.blend', '.glb', '.gltf']);

const finitePositive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const boolValue = value => value === true || value === 'true' || value === '1';

function slugFor(input) {
  const name = basename(input, extname(input));
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
}

export function roleBudget(role) {
  const profile = STYLIZED_ART_PROFILES[role];
  if (!profile) throw new Error(`Unknown asset role: ${role}. Expected one of ${ASSET_ROLES.join(', ')}`);
  return Object.freeze({
    role: profile.id,
    styleId: profile.styleId,
    density: profile.density,
    lodRatios: [...profile.lod],
    softTriangleBudget: profile.performance.softTriangleBudget,
    softMaterialBudget: profile.performance.softMaterialBudget,
    softDrawCallBudget: profile.performance.softDrawCallBudget,
  });
}

export function buildAssetOptimizationPlan({
  input,
  role,
  outputDir = null,
  report = null,
  skipLod = false,
  skipCompress = false,
} = {}) {
  if (!input) throw new Error('Use --input <.blend/.glb/.gltf>');
  const source = resolve(input);
  const sourceExt = extname(source).toLowerCase();
  if (!SOURCE_EXTENSIONS.has(sourceExt)) throw new Error(`Unsupported asset source: ${sourceExt || '(none)'}`);
  const budget = roleBudget(role);
  const id = slugFor(source);
  const directory = resolve(outputDir || `generated/asset-compiler/${id}`);
  const lodOutput = resolve(directory, `${id}.lod.glb`);
  const auditOutput = resolve(directory, `${id}.lod.audit.json`);
  const optimizedOutput = resolve(directory, `${id}.optimized.glb`);
  const reportOutput = resolve(report || `${directory}/${id}.asset-report.json`);
  const mode = CHARACTER_ROLES.has(role) ? 'character' : 'static';
  const lod1 = budget.lodRatios[1];
  const lod2 = budget.lodRatios[2];
  if (sourceExt === '.blend' && skipLod) throw new Error('A .blend source requires LOD/export before runtime compression');
  if (skipLod && skipCompress) throw new Error('At least one optimization stage must be enabled');
  const compressionInput = skipLod ? source : lodOutput;
  return Object.freeze({
    version: ASSET_COMPILER_VERSION,
    input: source,
    sourceExt,
    role,
    mode,
    budget,
    outputs: {
      directory,
      lod: skipLod ? null : lodOutput,
      audit: skipLod ? null : auditOutput,
      optimized: skipCompress ? null : optimizedOutput,
      report: reportOutput,
      final: skipCompress ? lodOutput : optimizedOutput,
    },
    stages: {
      lod: skipLod ? null : {
        command: process.execPath,
        args: [resolve('scripts/generate-lods.mjs'), '--input', source, '--output', lodOutput, '--audit', auditOutput, '--mode', mode, '--lod1', String(lod1), '--lod2', String(lod2)],
      },
      compress: skipCompress ? null : {
        command: process.execPath,
        args: [resolve('scripts/compress-gltf.mjs'), '--input', compressionInput, '--output', optimizedOutput],
      },
    },
  });
}

function sumAuditTriangles(audit, level = 0) {
  if (!audit?.objects?.length) return null;
  let total = 0;
  for (const row of audit.objects) {
    const value = level === 0 ? row.triangles : row.lods?.find(item => item.level === level)?.triangles;
    if (!finitePositive(value)) return null;
    total += value;
  }
  return total || null;
}

export function evaluateAssetOptimization({ plan, audit = null, sourceBytes = null, lodBytes = null, optimizedBytes = null } = {}) {
  if (!plan?.budget) throw new Error('Asset optimization evaluation requires a plan');
  const triangles = {
    lod0: sumAuditTriangles(audit, 0),
    lod1: sumAuditTriangles(audit, 1),
    lod2: sumAuditTriangles(audit, 2),
  };
  const ratios = {
    lod1: finitePositive(triangles.lod0) && finitePositive(triangles.lod1) ? triangles.lod1 / triangles.lod0 : null,
    lod2: finitePositive(triangles.lod0) && finitePositive(triangles.lod2) ? triangles.lod2 / triangles.lod0 : null,
  };
  const warnings = [], errors = [];
  if (audit?.errors?.length) errors.push(...audit.errors.map(message => `DCC: ${message}`));
  if (finitePositive(triangles.lod0) && triangles.lod0 > plan.budget.softTriangleBudget) {
    warnings.push(`LOD0 triangles ${triangles.lod0} exceed ${plan.role} soft budget ${plan.budget.softTriangleBudget}`);
  }
  const ratioTolerance = .08;
  if (finitePositive(ratios.lod1) && ratios.lod1 > plan.budget.lodRatios[1] + ratioTolerance) warnings.push(`LOD1 ratio ${ratios.lod1.toFixed(3)} is above target ${plan.budget.lodRatios[1].toFixed(3)}`);
  if (finitePositive(ratios.lod2) && ratios.lod2 > plan.budget.lodRatios[2] + ratioTolerance) warnings.push(`LOD2 ratio ${ratios.lod2.toFixed(3)} is above target ${plan.budget.lodRatios[2].toFixed(3)}`);
  if (!audit && plan.stages.lod) warnings.push('LOD audit was not measured');
  const bytes = { source: sourceBytes, lod: lodBytes, optimized: optimizedBytes };
  const gate = errors.length ? 'fail' : warnings.length ? 'review' : 'pass';
  return Object.freeze({ gate, warnings, errors, triangles, ratios, bytes, budget: plan.budget });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function bytesOf(file) {
  return file && existsSync(file) ? statSync(file).size : null;
}

export function runAssetOptimization(plan, { exec = execFileSync } = {}) {
  if (!plan?.input) throw new Error('Asset optimization requires a plan');
  if (!existsSync(plan.input)) throw new Error(`Missing input: ${plan.input}`);
  mkdirSync(plan.outputs.directory, { recursive: true });
  const executed = [];
  let audit = null;
  for (const name of ['lod', 'compress']) {
    const stage = plan.stages[name];
    if (!stage) continue;
    exec(stage.command, stage.args, { stdio: 'inherit' });
    if (name === 'lod') {
      if (!existsSync(plan.outputs.lod) || !existsSync(plan.outputs.audit)) throw new Error('LOD stage did not produce expected artifacts');
      audit = readJson(plan.outputs.audit);
    }
    if (name === 'compress' && !existsSync(plan.outputs.optimized)) throw new Error('Compression stage did not produce expected artifact');
    executed.push(name);
  }
  const evaluation = evaluateAssetOptimization({
    plan,
    audit,
    sourceBytes: bytesOf(plan.input),
    lodBytes: bytesOf(plan.outputs.lod),
    optimizedBytes: bytesOf(plan.outputs.optimized),
  });
  const result = {
    schema: 'soul-asset-optimization',
    version: ASSET_COMPILER_VERSION,
    createdAt: new Date().toISOString(),
    plan,
    executed,
    audit,
    evaluation,
  };
  writeFileSync(plan.outputs.report, `${JSON.stringify(result, null, 2)}\n`);
  if (evaluation.errors.length) throw new Error(`Asset optimization failed: ${evaluation.errors.join('; ')}`);
  return result;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) values[key] = true;
    else { values[key] = next; index++; }
  }
  return values;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const plan = buildAssetOptimizationPlan({
    input: args.input,
    role: args.role,
    outputDir: args.output,
    report: args.report,
    skipLod: boolValue(args['skip-lod']),
    skipCompress: boolValue(args['skip-compress']),
  });
  if (boolValue(args.plan)) console.log(JSON.stringify(plan, null, 2));
  else {
    const result = runAssetOptimization(plan);
    console.log(JSON.stringify({ report: plan.outputs.report, final: plan.outputs.final, gate: result.evaluation.gate, warnings: result.evaluation.warnings }, null, 2));
  }
}
