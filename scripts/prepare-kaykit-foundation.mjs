import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KAYKIT_MODELS, KAYKIT_SOURCE_REPOSITORY, KAYKIT_SOURCE_REVISION } from '../packages/characters/src/kaykit-foundation.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(repoRoot, 'apps/rinne/public/simulator/assets/kaykit');

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

async function downloadModel(model) {
  const target = path.join(repoRoot, model.runtime.localPath);
  const existing = await currentBytes(target);
  if (existing) {
    try {
      verifyKayKitBytes(model, existing);
      return { model: model.label, target, source: 'verified-cache' };
    } catch {
      // A stale or partial cache is replaced only by the exact pinned upstream blob.
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

export async function prepareKayKitFoundation() {
  await mkdir(outputRoot, { recursive: true });
  const rows = [];
  for (const model of KAYKIT_MODELS) rows.push(await downloadModel(model));
  return Object.freeze(rows);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  prepareKayKitFoundation().then(rows => {
    for (const row of rows) console.log(`KayKit ${row.model}: ${row.source}`);
  }).catch(error => {
    console.error(`KayKit foundation preparation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
