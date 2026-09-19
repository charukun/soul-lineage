import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  REVIEW_SKELETON_DOWNLOADS,
  REVIEW_SKELETON_EQUIPMENT,
  REVIEW_SKELETON_MODELS,
  REVIEW_SKELETON_SOURCE,
} from '../packages/assets/src/review-skeleton-library.js';

export const reviewAssetSourceUrl = row => `https://raw.githubusercontent.com/${row.repository}/${row.commit}/${row.path}`;
export const reviewAssetDigest = bytes => createHash('sha256').update(bytes).digest('hex');

export function verifyReviewAssetBytes(row, bytes) {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error(`Invalid review asset byte count: ${row.id}`);
  if (row.size !== null && row.size !== undefined && bytes.length !== row.size) throw new Error(`Review asset size mismatch: ${row.id}`);
  if (bytes.subarray(0, 80).toString().includes('git-lfs.github.com/spec')) throw new Error(`Review asset resolved to an LFS pointer: ${row.id}`);
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (row.gitBlob && gitBlob !== row.gitBlob) throw new Error(`Review asset Git blob mismatch: ${row.id}`);
  return reviewAssetDigest(bytes);
}

export function reviewAssetOutput(root, path) {
  if (typeof path !== 'string' || !/^[\w./-]+$/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe review asset output path: ${path}`);
  }
  return resolve(root, path);
}

function parseGlb(bytes, id) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`Invalid GLB header: ${id}`);
  }
  let offset = 12, json = null;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error(`Truncated GLB chunk: ${id}`);
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4); offset += 8;
    if (length % 4 || offset + length > bytes.length) throw new Error(`Invalid GLB chunk: ${id}`);
    if (type === 0x4e4f534a && !json) json = JSON.parse(bytes.subarray(offset, offset + length).toString('utf8'));
    offset += length;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error(`Missing glTF 2.0 document: ${id}`);
  return json;
}

async function download(row) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(reviewAssetSourceUrl(row), { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Review asset HTTP ${response.status}: ${row.id}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      verifyReviewAssetBytes(row, bytes);
      return bytes;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function verifyBundle(root) {
  for (const model of REVIEW_SKELETON_MODELS) {
    const bytes = await readFile(join(root, 'models', 'kaykit-skeletons', model.source.path.split('/').pop()));
    const document = parseGlb(bytes, model.id);
    const external = [...(document.buffers || []), ...(document.images || [])].map(row => row.uri).filter(Boolean);
    if (external.length) throw new Error(`Review model has unexpected external resources: ${model.id}`);
    const names = (document.nodes || []).map(row => String(row.name || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
    for (const required of ['hips', 'spine', 'chest', 'head']) {
      if (!names.some(name => name === required || name.endsWith(required))) throw new Error(`Review model missing ${required}: ${model.id}`);
    }
  }
  for (const item of REVIEW_SKELETON_EQUIPMENT) {
    const document = JSON.parse(await readFile(join(root, 'equipment', `${item.file}.gltf`), 'utf8'));
    if (document.asset?.version !== '2.0') throw new Error(`Equipment is not glTF 2.0: ${item.id}`);
    const resources = [...(document.buffers || []), ...(document.images || [])].map(row => row.uri).filter(Boolean);
    if (!resources.length) throw new Error(`Equipment has no local dependencies: ${item.id}`);
    for (const uri of resources) {
      if (typeof uri !== 'string' || uri.includes('/') || uri.includes('\\') || /^https?:/i.test(uri) || uri === '.' || uri === '..') {
        throw new Error(`Unsafe equipment dependency: ${item.id}: ${uri}`);
      }
      await readFile(join(root, 'equipment', uri));
    }
  }
}

export async function prepareReviewAssets() {
  const root = await mkdtemp(join(tmpdir(), 'rinne-review-skeletons-'));
  try {
    const files = [];
    for (let start = 0; start < REVIEW_SKELETON_DOWNLOADS.length; start += 4) {
      const batch = REVIEW_SKELETON_DOWNLOADS.slice(start, start + 4);
      const rows = await Promise.all(batch.map(async row => {
        const bytes = await download(row), output = reviewAssetOutput(root, row.output);
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, bytes);
        return { id: row.id, output: row.output, size: bytes.length, sha256: reviewAssetDigest(bytes) };
      }));
      files.push(...rows);
    }
    await verifyBundle(root);
    const manifest = {
      revision: 'develop-visual-review-skeletons.1',
      buildCommit: process.env.GITHUB_SHA || null,
      scope: 'visual-review-only',
      source: REVIEW_SKELETON_SOURCE,
      models: REVIEW_SKELETON_MODELS.map(({id,label,source,runtime}) => ({id,label,source,runtime})),
      equipment: REVIEW_SKELETON_EQUIPMENT.map(({id,label,family,slots,runtime}) => ({id,label,family,slots,runtime})),
      files,
    };
    await writeFile(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeFile(join(root, 'CREDITS.txt'), [
      'RINNE Visual Review asset library.',
      `KayKit Skeletons: ${REVIEW_SKELETON_SOURCE.repository}@${REVIEW_SKELETON_SOURCE.commit}`,
      'License: CC0 1.0 Universal.',
      'These assets are review-only and do not grant gameplay inventory, save state, Production stage, or visual approval.',
      'Pinned input hashes and produced SHA-256 values are recorded in manifest.json.',
    ].join('\n') + '\n');
    return { root, manifest };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function materializeReviewAssets(targetRoot = resolve(repoRoot, 'apps/rinne/public/asset-review')) {
  const prepared = await prepareReviewAssets();
  const target = resolve(targetRoot);
  const staging = `${target}.next-${process.pid}`;
  try {
    await rm(staging, { recursive: true, force: true });
    await mkdir(dirname(staging), { recursive: true });
    await cp(prepared.root, staging, { recursive: true });
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
    return Object.freeze({ target, manifest: prepared.manifest });
  } finally {
    await rm(prepared.root, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const target = process.argv[2] ? resolve(process.argv[2]) : resolve(repoRoot, 'apps/rinne/public/asset-review');
  materializeReviewAssets(target)
    .then(({ manifest }) => console.log(`Review assets materialized: ${manifest.files.length} pinned files`))
    .catch(error => {
      console.error(`Review asset preparation failed: ${error.message}`);
      process.exitCode = 1;
    });
}
