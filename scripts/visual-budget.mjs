import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const VISUAL_BUDGETS = Object.freeze({
  rasterSoftBytes: 2 * 1024 * 1024,
  rasterHardBytes: 6 * 1024 * 1024,
  modelSoftBytes: 20 * 1024 * 1024,
  modelHardBytes: 32 * 1024 * 1024,
  binaryHardBytes: 32 * 1024 * 1024,
  gltfMaterialsSoft: 48,
  gltfMeshesSoft: 96,
  gltfImagesSoft: 32,
});

const raster = new Set(['.png','.jpg','.jpeg','.webp','.avif','.ktx2']);
const model = new Set(['.glb','.gltf','.vrm']);
const visual = file => raster.has(path.extname(file).toLowerCase()) || model.has(path.extname(file).toLowerCase()) || path.extname(file).toLowerCase() === '.bin';

export function inspectVisualFile(file, { root = process.cwd() } = {}) {
  const target = path.resolve(root, file);
  if (!existsSync(target) || !statSync(target).isFile() || !visual(file)) return null;
  const ext = path.extname(file).toLowerCase(), bytes = statSync(target).size, warnings = [], errors = [];
  if (raster.has(ext)) {
    if (bytes > VISUAL_BUDGETS.rasterSoftBytes && ext !== '.ktx2') warnings.push(`large raster ${Math.ceil(bytes/1024)} KiB; prefer KTX2/Basis or a smaller authored source`);
    if (bytes > VISUAL_BUDGETS.rasterHardBytes) errors.push(`raster exceeds hard ${VISUAL_BUDGETS.rasterHardBytes/1024/1024} MiB budget`);
  }
  if (model.has(ext)) {
    if (bytes > VISUAL_BUDGETS.modelSoftBytes) warnings.push(`large model ${Math.ceil(bytes/1024/1024)} MiB; verify authored LODs/material count`);
    if (bytes > VISUAL_BUDGETS.modelHardBytes) errors.push(`model exceeds hard ${VISUAL_BUDGETS.modelHardBytes/1024/1024} MiB budget`);
  }
  if (ext === '.bin' && bytes > VISUAL_BUDGETS.binaryHardBytes) errors.push(`visual binary exceeds hard ${VISUAL_BUDGETS.binaryHardBytes/1024/1024} MiB budget`);
  if (ext === '.gltf') {
    try {
      const json = JSON.parse(readFileSync(target, 'utf8'));
      const materials = json.materials?.length || 0, meshes = json.meshes?.length || 0, images = json.images?.length || 0;
      if (materials > VISUAL_BUDGETS.gltfMaterialsSoft) warnings.push(`glTF has ${materials} materials; consolidate/atlas before scaling population`);
      if (meshes > VISUAL_BUDGETS.gltfMeshesSoft) warnings.push(`glTF has ${meshes} meshes; verify draw-call/HLOD plan`);
      if (images > VISUAL_BUDGETS.gltfImagesSoft) warnings.push(`glTF has ${images} images; verify texture atlas/compression plan`);
    } catch (error) { errors.push(`invalid glTF JSON: ${error.message}`); }
  }
  return { file, ext, bytes, warnings, errors, gate: errors.length ? 'fail' : warnings.length ? 'review' : 'pass' };
}

export function inspectVisualFiles(files, options = {}) {
  const rows = files.map(file => inspectVisualFile(file, options)).filter(Boolean);
  return { rows, warnings: rows.flatMap(row => row.warnings.map(message => `${row.file}: ${message}`)), errors: rows.flatMap(row => row.errors.map(message => `${row.file}: ${message}`)) };
}

function changedFiles(base, head) {
  if (!base || !head) return [];
  return execFileSync('git', ['diff','--name-only','--diff-filter=AM',`${base}...${head}`], { encoding:'utf8' }).split(/\r?\n/).filter(Boolean);
}

function trackedVisualFiles() {
  return execFileSync('git', ['ls-files'], { encoding:'utf8' }).split(/\r?\n/).filter(file => file && visual(file));
}

function print(result) {
  for (const row of result.rows) console.log(`[visual-budget] ${row.gate.toUpperCase()} ${row.file} ${(row.bytes/1024).toFixed(1)} KiB`);
  for (const warning of result.warnings) console.warn(`[visual-budget] WARN ${warning}`);
  for (const error of result.errors) console.error(`[visual-budget] ERROR ${error}`);
  console.log(`[visual-budget] files=${result.rows.length} warnings=${result.warnings.length} errors=${result.errors.length}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const mode = process.argv[2];
  if (!['guard','audit'].includes(mode)) throw new Error('Use visual-budget.mjs guard <base> <head> or audit');
  const files = mode === 'guard' ? changedFiles(process.argv[3], process.argv[4]) : trackedVisualFiles();
  const result = inspectVisualFiles(files); print(result);
  if (mode === 'guard' && result.errors.length) process.exitCode = 1;
}
