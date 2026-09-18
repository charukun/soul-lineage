import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SHINO_MASTER, MAX_CHARACTERS, createCharacter, auditShinoDocument, integer, invariant } from '../packages/characters/src/master-character.js';

/** Reject corrupt containers before a renderer sees them. No external glTF resources. */
export function parseGLB(bytes) {
  const b = Buffer.from(bytes);
  invariant(b.length >= 20 && b.length <= 128 * 1024 * 1024, 'Invalid GLB length');
  invariant(b.readUInt32LE(0) === 0x46546c67 && b.readUInt32LE(4) === 2 && b.readUInt32LE(8) === b.length, 'Invalid GLB header');
  let offset = 12, document = null, binary = null, chunks = 0;
  while (offset < b.length) {
    invariant(offset + 8 <= b.length, 'Truncated chunk');
    const length = b.readUInt32LE(offset), type = b.readUInt32LE(offset + 4); offset += 8;
    invariant(length % 4 === 0 && offset + length <= b.length, 'Invalid chunk length');
    const content = b.subarray(offset, offset + length);
    if (type === 0x4e4f534a) {
      invariant(chunks === 0 && !document, 'JSON must be first and unique'); document = JSON.parse(content.toString('utf8').trim());
    } else if (type === 0x004e4942) { invariant(document && !binary, 'Invalid binary chunk'); binary = content; }
    else throw new Error('Unsupported GLB chunk');
    offset += length; chunks++;
  }
  invariant(document && binary && Array.isArray(document.buffers) && document.buffers.length === 1 &&
    Number.isInteger(document.buffers[0].byteLength) && document.buffers[0].byteLength <= binary.length &&
    binary.length - document.buffers[0].byteLength < 4, 'Missing or mismatched glTF buffer');
  for (const view of document.bufferViews || []) {
    integer(view.byteOffset ?? 0, 0, binary.length, 'buffer offset'); integer(view.byteLength, 0, binary.length, 'buffer length');
    invariant((view.buffer ?? 0) === 0 && (view.byteOffset ?? 0) + view.byteLength <= document.buffers[0].byteLength, 'Out-of-bounds buffer view');
  }
  return { document, binary, sha256: createHash('sha256').update(b).digest('hex') };
}
export function inspectMaster(bytes) {
  const parsed = parseGLB(bytes), { document, sha256 } = parsed;
  const rights = auditShinoDocument(document, sha256); invariant(rights.approved, `Asset rejected: ${rights.errors.join(', ')}`);
  let triangles = 0, primitives = 0;
  for (const mesh of document.meshes || []) for (const primitive of mesh.primitives) {
    invariant((primitive.mode ?? 4) === 4, 'Only triangle assets are accepted');
    const count = document.accessors[primitive.indices ?? primitive.attributes.POSITION]?.count;
    integer(count, 0, 10_000_000, 'primitive count'); invariant(count % 3 === 0, 'Malformed triangle primitive');
    triangles += count / 3; primitives++;
  }
  return { masterId: SHINO_MASTER.id, contentVersion: SHINO_MASTER.contentVersion, sha256,
    originalSHA256: SHINO_MASTER.source.sha256, inputBytes: bytes.byteLength, triangles, primitives,
    materials: document.materials?.length || 0, humanoidBones: Object.keys(document.extensions.VRMC_vrm.humanoid.humanBones).length,
    license: rights.license, budgets: { maxCharacters: 30, desktopFrameMs: 16.67, mobileFrameMs: 33.34 },
    capabilities: { completeBodyUnderClothing: false, authoredGeometryLODs: false, builtInAnimations: (document.animations?.length || 0) > 0 },
    // Import/contract success is not a production, gameplay or device-performance approval.
    gates: { sourceAndLicense: 'pass', gameplayIntegration: 'not-run', targetDevice30: 'not-run', wardrobeGeometry: 'not-run' } };
}
export async function prepareMaster({ source, out, count = 30, seed = 1, download = false }) {
  integer(count, 1, MAX_CHARACTERS, 'count'); integer(seed, 0, 0xffffffff - count, 'seed');
  invariant(typeof out === 'string' && out.length > 0, 'Output directory required');
  invariant(download ? !source : typeof source === 'string', 'Supply a local source OR --fetch');
  let bytes;
  if (download) {
    const response = await fetch(SHINO_MASTER.source.url, { signal: AbortSignal.timeout(60_000) });
    invariant(response.ok, `Source HTTP ${response.status}`);
    const parts = []; let length = 0;
    for await (const part of response.body) { length += part.byteLength; invariant(length <= 128 * 1024 * 1024, 'Source too large'); parts.push(part); }
    bytes = Buffer.concat(parts);
  } else bytes = await readFile(source);
  const audit = inspectMaster(bytes);
  const roster = Array.from({ length: count }, (_, i) => createCharacter({ id: `production-${i + 1}`, seed: seed + i }));
  // Refuse overwrites. Failed imports never touch an existing asset directory.
  const directory = resolve(out); await mkdir(directory, { recursive: false });
  try {
  await writeFile(resolve(directory, 'master.vrm'), bytes, { flag: 'wx' });
  await writeFile(resolve(directory, 'audit.json'), JSON.stringify(audit, null, 2) + '\n', { flag: 'wx' });
  await writeFile(resolve(directory, 'roster.json'), JSON.stringify(roster, null, 2) + '\n', { flag: 'wx' });
  await writeFile(resolve(directory, 'LICENSE-NOTICE.txt'), [
    'Sendagaya_Shino / MasterCharacter source notice', ...SHINO_MASTER.license.authors,
    `Original: ${SHINO_MASTER.license.original} — ${SHINO_MASTER.license.originalTerms}`,
    `VRM conversion: ${SHINO_MASTER.license.conversion} — ${SHINO_MASTER.license.licenseUrl}`,
    SHINO_MASTER.license.conversionTerms, `Source commit: ${SHINO_MASTER.source.commit}`, `SHA-256: ${audit.sha256}`,
    'The conversion publisher also declares CC0. Preserve the embedded VRM license settings and source chain; do not substitute a repository code license.',
    'Uniform color variants do not constitute new garment geometry. No endorsement by pixiv or Coatie.',
    'Input model bytes are preserved; the reviewed input differs from upstream in thumbnail size.'
  ].join('\n') + '\n', { flag: 'wx' });
  } catch (error) { await rm(directory, {recursive:true, force:true}); throw error; }
  return { directory, audit, count: roster.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i = 0; i < args.length; i++) {
      const key = args[i]; invariant(['--source', '--out', '--count', '--seed', '--fetch'].includes(key), `Unknown option ${key}`);
      if (key === '--fetch') options.download = true;
      else { invariant(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value ${key}`); options[key.slice(2)] = ['--count', '--seed'].includes(key) ? Number(args[++i]) : args[++i]; }
    }
    console.log(JSON.stringify(await prepareMaster(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
