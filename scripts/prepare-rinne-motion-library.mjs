import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AnimationMixer, LoopOnce } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KAYKIT_MODELS } from '../packages/characters/src/kaykit-foundation.js';
import { MOTION_LIBRARY_SOURCES } from '../apps/rinne/src/review-motion-sources.js';
import { buildSourceMotionRegistry, countSourceMotions } from '../apps/rinne/src/review-motion-identity.js';
import { captureReviewRig, createReviewMotionBridge, inspectReviewRig } from '../apps/rinne/src/review-motion-retarget.js';
import { acquireMotionSource, readSourceGlb, inspectSourceAnimations, sha256 } from './audit-rinne-motion-sources.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'apps/rinne/public/simulator/assets/motion-library');
const evidenceRoot = path.join(root, 'artifacts/motion-source-qa');
export const MOTION_QA_FPS = 30;

// Use the SAME glTF loader, node names, bone flags and interpolation as the
// browser. Omit only render resources so Node does not need an image decoder.
export async function loadMotionRig(document, family) {
  const json = structuredClone(document.json);
  delete json.images; delete json.textures; delete json.materials; delete json.meshes;
  for (const node of json.nodes) { delete node.mesh; delete node.weights; }
  const text = Buffer.from(JSON.stringify(json)), padding = (4 - text.length % 4) % 4;
  const chunk = Buffer.concat([text, Buffer.alloc(padding, 32)]), bin = document.binary;
  const bytes = Buffer.alloc(12 + 8 + chunk.length + 8 + bin.length);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(chunk.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); chunk.copy(bytes, 20);
  const offset = 20 + chunk.length;
  bytes.writeUInt32LE(bin.length, offset); bytes.writeUInt32LE(0x004e4942, offset + 4); bin.copy(bytes, offset + 8);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return { gltf, rig: captureReviewRig(gltf.scene, family) };
}

export function validateMotionOnRig(source, target, clip) {
  source.rig.reset(); target.rig.reset();
  const mixer = new AnimationMixer(source.gltf.scene), bridge = createReviewMotionBridge(source.rig, target.rig);
  const action = mixer.clipAction(clip); action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const reference = target.rig.restNodes.filter(row => row.node.isBone && row.node !== target.rig.bones.hips);
  const result = { samples: 0, minY: Infinity, maxRadius: 0, maxHeight: 0, maxLift: 0, valid: true, failures: [] };
  const fail = reason => { result.valid = false; if (!result.failures.includes(reason)) result.failures.push(reason); };
  try {
    if (!clip.tracks.length || !(clip.duration > 0)) fail('empty animation');
    const frames = Math.max(2, Math.ceil(clip.duration * MOTION_QA_FPS));
    for (let frame = 0; frame <= frames; frame++) {
      mixer.setTime(clip.duration * frame / frames); bridge.apply();
      const sample = inspectReviewRig(target.rig), height = target.rig.rest.height;
      result.samples++; result.minY = Math.min(result.minY, sample.minY);
      result.maxRadius = Math.max(result.maxRadius, sample.maxRadius);
      result.maxHeight = Math.max(result.maxHeight, sample.height);
      result.maxLift = Math.max(result.maxLift, bridge.lastLift);
      if (!sample.finite) fail('non-finite skeletal transform');
      if (sample.maxRadius > height * 4) fail('unbounded horizontal displacement');
      if (sample.height > height * 6) fail('unbounded vertical displacement');
      if (sample.minY < target.rig.floor - height * .25) fail('joint penetrates floor');
      if (bridge.lastLift > height * 1.25) fail('excessive retarget floor correction');
      // Same-family root bone translation is deliberately excluded, but target
      // limb lengths/scales must never be replaced with another rig's values.
      if (source !== target) for (const row of reference) {
        if (row.node.position.distanceTo(row.position) > 1e-5 || row.node.scale.distanceTo(row.scale) > 1e-5) fail('target bone length or scale changed');
      }
    }
  } finally {
    mixer.stopAllAction(); mixer.uncacheRoot(source.gltf.scene); source.rig.reset(); target.rig.reset();
  }
  return result;
}

let preparation;
export function prepareRinneMotionLibrary() {
  // Focused tests and build callers in one process share the verified result.
  preparation ||= prepare().catch(error => { preparation = null; throw error; });
  return preparation;
}
async function prepare() {
  const baselineSource = MOTION_LIBRARY_SOURCES.find(source => source.baseline);
  const sources = [...MOTION_LIBRARY_SOURCES, ...KAYKIT_MODELS.slice(1).map(model => ({
    ...baselineSource, ...model.source, id: `baseline-${model.key}`, label: model.label,
    url: model.runtime.url, baseline: true
  }))];
  const inventory = [], assets = new Map();
  for (const source of sources) {
    const bytes = await acquireMotionSource(source), document = readSourceGlb(bytes);
    inventory.push({ source, sha256: sha256(bytes), clips: inspectSourceAnimations(document) });
    assets.set(source.id, await loadMotionRig(document, source.family));
  }
  const registry = buildSourceMotionRegistry(inventory), quality = [], admitted = [], rejected = [];
  const targets = sources.filter(source => source.baseline);
  for (const record of registry.records) {
    const source = assets.get(record.sourceId), clip = source.gltf.animations[record.source.clipIndex];
    if (!clip || clip.name !== record.source.clipName) throw new Error(`Source clip mismatch: ${record.id}`);
    const models = [];
    for (const target of targets) {
      // A distinct loaded target ensures the shared-source bridge, rather than
      // only native playback, is tested for every character.
      const result = validateMotionOnRig(source, assets.get(target.id), clip);
      models.push({ model: target.id, ...result });
    }
    const row = { id: record.id, sourceIdentity: record.sourceIdentity, models, valid: models.every(model => model.valid) };
    quality.push(row);
    if (row.valid || record.baseline) admitted.push(record);
    else rejected.push({ ...record, reason: 'rig QA rejected', models });
  }
  // Existing embedded clips remain accessible verbatim, even when an old asset
  // has an advisory floor warning. Never remove an existing motion to pass QA.
  const baselineWarnings = quality.filter(row => !row.valid && registry.records.find(record => record.id === row.id)?.baseline);
  const records = admitted.map((row, index) => {
    const { aliases, fingerprint, ...record } = row;
    return { ...record, index, aliasCount: aliases.length };
  });
  const baseline = records.filter(row => row.baseline).length;
  const manifest = { version: registry.version, sources: inventory.map(({ source, sha256: digest }) => ({ ...source, sha256: digest })),
    records, legacy: registry.legacy.filter(row => row.sourceId === baselineSource.id).map(row => ({ name: row.name, index: row.source.clipIndex, duration: row.duration })),
    summary: { baseline, added: records.length - baseline, total: countSourceMotions(records),
      baselineEmbeddedOccurrences: inventory.filter(row => row.source.baseline).reduce((n, row) => n + row.clips.length, 0),
      candidateOccurrences: inventory.filter(row => !row.source.baseline).reduce((n, row) => n + row.clips.length, 0),
      duplicateOccurrences: registry.summary.duplicateOccurrences, excludedOccurrences: registry.excluded.length,
      rigRejected: rejected.length, baselineWarnings: baselineWarnings.length },
    qa: { fps: MOTION_QA_FPS, targetModels: targets.length, visualApproval: 'pending-human-review' } };
  await mkdir(publicRoot, { recursive: true }); await mkdir(evidenceRoot, { recursive: true });
  await writeFile(path.join(publicRoot, 'catalog.json'), JSON.stringify(manifest) + '\n');
  await writeFile(path.join(evidenceRoot, 'source-motion-evidence.json'), JSON.stringify({
    head: process.env.HEAD_SHA || process.env.GITHUB_SHA || null, manifest, quality, baselineWarnings,
    aliases: registry.records.map(({ id, aliases }) => ({ id, aliases })), excluded: registry.excluded, rejected
  }, null, 2) + '\n');
  console.log('MOTION_SOURCE_COUNT ' + JSON.stringify(manifest.summary));
  return { manifest, quality, rejected, baselineWarnings, registry };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  prepareRinneMotionLibrary().catch(error => { console.error(error); process.exitCode = 1; });
}
