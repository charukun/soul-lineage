import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KAYKIT_MODELS } from '../packages/characters/src/kaykit-foundation.js';
import { MOTION_LIBRARY_SOURCES } from '../apps/rinne/src/review-motion-sources.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const gitBlobSha = bytes => createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
export function verifySourceBytes(source, bytes) {
  if (bytes.byteLength !== source.byteLength || gitBlobSha(bytes) !== source.gitBlobSha) {
    throw new Error(`Immutable motion source mismatch: ${source.id}`);
  }
  return true;
}
export async function acquireMotionSource(source) {
  if (!/^\.\/simulator\/assets\/[a-zA-Z0-9_./-]+\.glb$/.test(source.url) || source.url.includes('..')) throw new Error('Unsafe motion asset path');
  const target = path.join(root, 'apps/rinne/public', source.url.slice(2));
  try {
    const bytes = await readFile(target);
    verifySourceBytes(source, bytes);
    return bytes;
  } catch (error) {
    if (error.code !== 'ENOENT' && !error.message.startsWith('Immutable motion source mismatch')) throw error;
  }
  const encoded = source.path.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${source.repository}/${source.revision}/${encoded}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifySourceBytes(source, bytes);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  try { await writeFile(temporary, bytes); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }); }
  return bytes;
}
export function readSourceGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid glTF binary');
  let json, binary;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), kind = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + length > bytes.length) throw new Error('Truncated glTF chunk');
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    if (kind === 0x004e4942) binary = chunk;
    offset += length + 8;
  }
  if (!json || !binary || json.buffers?.some(buffer => buffer.uri)) throw new Error('Motion source must be a self-contained GLB');
  return { json, binary };
}
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const types = { 5120: ['readInt8', 1], 5121: ['readUInt8', 1], 5122: ['readInt16LE', 2], 5123: ['readUInt16LE', 2], 5125: ['readUInt32LE', 4], 5126: ['readFloatLE', 4] };
export function sourceAccessor(document, index) {
  const accessor = document.json.accessors[index], view = document.json.bufferViews[accessor.bufferView];
  if (accessor.sparse || !view || view.buffer) throw new Error('Unsupported animation accessor');
  const size = components[accessor.type], [reader, width] = types[accessor.componentType] || [];
  if (!size || !reader) throw new Error('Unknown animation accessor type');
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0), stride = view.byteStride || size * width, values = [];
  for (let i = 0; i < accessor.count; i++) for (let k = 0; k < size; k++) {
    const value = document.binary[reader](start + i * stride + k * width);
    if (!Number.isFinite(value)) throw new Error('Non-finite source animation value');
    values.push(value);
  }
  return values;
}
const round = value => Math.round(value * 100000) / 100000;
export function inspectSourceAnimations(document) {
  const { json } = document;
  return (json.animations || []).map((animation, index) => {
    let duration = 0;
    const channels = animation.channels.map(channel => {
      const sampler = animation.samplers[channel.sampler], times = sourceAccessor(document, sampler.input), values = sourceAccessor(document, sampler.output);
      const start = times[0] || 0, span = times.at(-1) - start;
      duration = Math.max(duration, times.at(-1) || 0);
      return {
        node: String(json.nodes[channel.target.node]?.name || channel.target.node).toLowerCase().replace(/[^a-z0-9]/g, ''),
        path: channel.target.path,
        times: times.map(value => round(span > 0 ? (value - start) / span : 0)),
        values: values.map(round)
      };
    }).sort((a, b) => `${a.node}:${a.path}`.localeCompare(`${b.node}:${b.path}`));
    return { index, name: animation.name || `animation_${index}`, duration, channels: channels.length,
      fingerprint: sha256(JSON.stringify(channels)), targets: [...new Set(channels.map(channel => channel.node))] };
  });
}
export async function auditMotionSources() {
  const sources = [...MOTION_LIBRARY_SOURCES, ...KAYKIT_MODELS.slice(1).map(model => ({
    ...model.source, id: `baseline-${model.key}`, family: 'kaykit', url: model.runtime.url, baseline: true
  }))];
  const inventory = [];
  for (const source of sources) {
    const bytes = await acquireMotionSource(source), document = readSourceGlb(bytes), clips = inspectSourceAnimations(document);
    const nodes = document.json.nodes.map((node, index) => ({ index, name: node.name, translation: node.translation, rotation: node.rotation, scale: node.scale, children: node.children }));
    const report = { source, sha256: sha256(bytes), clips, nodes };
    inventory.push(report);
    console.log('SOURCE_INVENTORY ' + JSON.stringify({ source, sha256: report.sha256, clips: clips.map(({ targets, ...clip }) => clip) }));
    if (['kaykit-embedded', 'kaykit-tools', 'quaternius-ual1', 'quaternius-ual2'].includes(source.id)) console.log('SOURCE_RIG ' + source.id + ' ' + JSON.stringify(nodes));
  }
  const baseline = inventory.filter(row => row.source.baseline), fingerprints = new Set(baseline.flatMap(row => row.clips.map(clip => clip.fingerprint)));
  const summary = { baselineEmbeddedOccurrences: baseline.reduce((sum, row) => sum + row.clips.length, 0), baselineExactUnique: fingerprints.size,
    candidateOccurrences: inventory.filter(row => !row.source.baseline).reduce((sum, row) => sum + row.clips.length, 0),
    note: 'Raw inventory only. Source-family aliases, partial clips and quality exclusions must be applied before publishing the real motion count.' };
  await mkdir(path.join(root, 'artifacts/motion-source-audit'), { recursive: true });
  await writeFile(path.join(root, 'artifacts/motion-source-audit/inventory.json'), JSON.stringify({ summary, inventory }, null, 2) + '\n');
  console.log('SOURCE_INVENTORY_SUMMARY ' + JSON.stringify(summary));
  return { summary, inventory };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  auditMotionSources().catch(error => { console.error(error); process.exitCode = 1; });
}
