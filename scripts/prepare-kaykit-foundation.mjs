import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KAYKIT_MODELS, KAYKIT_MODEL_BY_KEY, KAYKIT_REVIEW_EQUIPMENT_FILES, KAYKIT_SOURCE_REPOSITORY, KAYKIT_SOURCE_REVISION } from '../packages/characters/src/kaykit-foundation.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = Object.freeze({
  rinne: Object.freeze({root:path.join(repoRoot, 'apps/rinne/public/simulator/assets/kaykit'),models:Object.freeze([...KAYKIT_MODELS,...KAYKIT_REVIEW_EQUIPMENT_FILES])}),
  'character-studio': Object.freeze({root:path.join(repoRoot, 'apps/character-studio/public/simulator/assets/kaykit'),models:Object.freeze([...KAYKIT_MODELS,...KAYKIT_REVIEW_EQUIPMENT_FILES])}),
  village: Object.freeze({root:path.join(repoRoot, 'apps/village/public/assets/kaykit'),models:Object.freeze([KAYKIT_MODEL_BY_KEY.rogue,KAYKIT_MODEL_BY_KEY.knight])}),
  demon: Object.freeze({root:path.join(repoRoot, 'apps/demon/public/assets/kaykit'),models:Object.freeze([KAYKIT_MODEL_BY_KEY.knight])})
});

export function gitBlobSha(bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash('sha1').update(Buffer.from(`blob ${body.byteLength}\0`)).update(body).digest('hex');
}

export function verifyKayKitBytes(model, bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (body.byteLength !== model.source.byteLength) {
    throw new Error(`${model.label}: byte length mismatch; expected ${model.source.byteLength}, got ${body.byteLength}`);
  }
  const actual = gitBlobSha(body);
  if (actual !== model.source.gitBlobSha) {
    throw new Error(`${model.label}: Git blob mismatch; expected ${model.source.gitBlobSha}, got ${actual}`);
  }
  return true;
}

async function currentBytes(target) {
  try {
    const info = await stat(target);
    if (!info.isFile() || info.size === 0) return null;
    return await readFile(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function acquireModel(model, target) {
  const existing = await currentBytes(target);
  if (existing) {
    try {
      verifyKayKitBytes(model, existing);
      return { model: model.label, target, source: 'verified-cache' };
    } catch {
      // Replace stale/partial bytes only with the exact pinned upstream blob.
    }
  }

  const encodedPath = model.source.path.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${KAYKIT_SOURCE_REPOSITORY}/${KAYKIT_SOURCE_REVISION}/${encodedPath}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`${model.label}: KayKit download failed HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyKayKitBytes(model, bytes);

  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'w' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return { model: model.label, target, source: 'pinned-upstream' };
}

function normalizeTargets(targets) {
  const requested = Array.isArray(targets) ? targets : [targets];
  const expanded = requested.flatMap(value => value === 'all' ? Object.keys(TARGETS) : [value || 'rinne']);
  const unique = [...new Set(expanded)];
  for (const app of unique) if (!Object.hasOwn(TARGETS, app)) throw new Error(`Unknown KayKit app target: ${app}`);
  return unique;
}

export async function prepareKayKitFoundation(targets = ['rinne']) {
  const rows = [];
  for (const app of normalizeTargets(targets)) {
    const {root:outputRoot,models}=TARGETS[app];
    await mkdir(outputRoot, { recursive: true });
    for (const model of models) {
      const target = path.join(outputRoot, path.basename(model.runtime.localPath));
      rows.push({ app, ...await acquireModel(model, target) });
    }
  }
  return Object.freeze(rows.map(Object.freeze));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const targets = process.argv.slice(2);
  prepareKayKitFoundation(targets.length ? targets : ['rinne']).then(rows => {
    for (const row of rows) console.log(`KayKit ${row.app}/${row.model}: ${row.source}`);
  }).catch(error => {
    console.error(`KayKit foundation preparation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
