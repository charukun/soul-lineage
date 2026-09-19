import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareRinneMotionLibrary } from '../../../scripts/prepare-rinne-motion-library.mjs';
import { acquireMotionSource, verifySourceBytes } from '../../../scripts/audit-rinne-motion-sources.mjs';
import { buildMotionReviewCatalog, classifyReviewMotion, filterMotionReviewCatalog } from '../src/review-motion-catalog.js';
import { countSourceMotions, sourceMotionIdentity, safeMotionPath, motionFamilyKey } from '../src/review-motion-identity.js';
import { motionCountLabel, validateMotionManifest } from '../src/review-motion-manifest.js';

// This is an actual glTF/mixer/rig integration test, not a static catalog mock.
// The final-head hosted runner acquires hash-pinned bytes and samples all rigs.
const prepared = await prepareRinneMotionLibrary();
const { manifest, registry, quality, baselineWarnings } = prepared;
const catalog = buildMotionReviewCatalog(manifest.records);

test('all admitted upstream identities and UI IDs are unique', () => {
  assert.equal(countSourceMotions(catalog), catalog.length);
  assert.equal(new Set(catalog.map(row => row.id)).size, catalog.length);
  for (const row of catalog) assert.equal(row.sourceIdentity, sourceMotionIdentity(row));
  assert.equal(validateMotionManifest(manifest), manifest);
});

test('playback, mirror, trim, retarget, conversion and additive variants never increase the count', () => {
  const first = catalog[0];
  const variants = [
    { speed: .5 }, { speed: 2 }, { mirror: true }, { loop: false }, { trim: [0, .2] },
    { rootMotion: true }, { position: [1, 2, 3], rotation: [0, 3.14, 0], scale: 2 },
    { interpolation: 'STEP' }, { targetModel: 'mage', retargetRevision: 'another' },
    { format: 'fbx' }, { blend: .5 }, { additive: true }, { ikStrength: .4 }
  ].map(variant => ({ ...first, ...variant }));
  assert.equal(countSourceMotions([first, ...variants]), 1);
  const converted = { source: { ...first.source, path: 'converted/model.fbx' }, canonicalSource: first.source };
  assert.equal(countSourceMotions([first, converted]), 1);
  assert.throws(() => sourceMotionIdentity({ ...first.source, revision: 'develop' }), /immutable/);
});

test('different model embeddings map back to one source family', () => {
  const name = '1H_Melee_Attack_Chop';
  const embedded = registry.legacy.filter(row => row.name === name);
  assert.equal(embedded.length, manifest.sources.filter(source => source.baseline).length);
  const family = motionFamilyKey({ family: 'kaykit' }, { name });
  assert.equal(catalog.filter(row => row.familyKey === family).length, 1);
  const canonical = catalog.find(row => row.familyKey === family);
  assert.equal(countSourceMotions(embedded.map(row => ({ ...row, canonicalSource: canonical.source }))), 1);
  for (const alias of ['Melee_1H_Attack_Chop', name]) assert.equal(motionFamilyKey({ family: 'kaykit' }, { name: alias }), family);
});

test('upstream loop, root motion, mirror and partial exports are conservatively grouped', () => {
  const same = (family, names) => assert.equal(new Set(names.map(name => motionFamilyKey({ family }, { name }))).size, 1);
  same('kaykit', ['1H_Ranged_Shoot', '1H_Ranged_Shooting', 'Ranged_1H_Shoot']);
  same('kaykit', ['Jump_Full_Long', 'Jump_Full_Short', 'Jump_Start', 'Jump_Idle', 'Jump_Land']);
  same('kaykit', ['Dodge_Left', 'Dodge_Right']);
  same('quaternius', ['Sword_Attack', 'Sword_Attack_RM']);
  same('quaternius', ['Sword_Regular_A', 'Sword_Regular_A_Rec', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Regular_Combo']);
});

test('every motion retains original path, clip, license, author and immutable file/clip hashes', () => {
  for (const row of catalog) {
    const source = row.source;
    for (const key of ['repository', 'revision', 'path', 'clipName', 'author', 'license', 'originalSource', 'licenseUrl']) assert.ok(source[key], `${row.id}: ${key}`);
    assert.match(source.revision, /^[a-f0-9]{40}$/); assert.match(source.gitBlobSha, /^[a-f0-9]{40}$/);
    assert.match(source.sha256, /^[a-f0-9]{64}$/); assert.match(source.clipFingerprint, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(source.clipIndex) && source.clipIndex >= 0);
    assert.equal(source.license, 'CC0-1.0'); assert.equal(source.clipName, row.name);
  }
});

test('the pinned bytes reject tampering and unsafe deployment paths', async () => {
  const source = manifest.sources[0], bytes = await acquireMotionSource(source);
  assert.equal(verifySourceBytes(source, bytes), true);
  const corrupt = Buffer.from(bytes); corrupt[corrupt.length - 1] ^= 1;
  assert.throws(() => verifySourceBytes(source, corrupt), /Immutable motion source mismatch/);
  for (const row of catalog) assert.equal(safeMotionPath(row.url), true);
  for (const url of ['../x.glb', '/assets/x.glb', './simulator/assets/../x.glb', './simulator/assets/%2e%2e/x.glb', 'https://example.com/x.glb', './simulator/assets//x.glb']) assert.equal(safeMotionPath(url), false);
});

test('catalog, all filter and both UI count labels use the same source registry', () => {
  assert.equal(filterMotionReviewCatalog(catalog, 'all').length, catalog.length);
  assert.equal(manifest.summary.total, catalog.length);
  assert.equal(manifest.summary.baseline + manifest.summary.added, catalog.length);
  assert.equal(motionCountLabel(catalog), `MOTION CLIPS ${countSourceMotions(catalog)}`);
  assert.equal(motionCountLabel(catalog.slice(1)), `MOTION CLIPS ${countSourceMotions(catalog) - 1}`);
  for (const category of ['life', 'move', 'combat', 'reaction', 'other']) {
    assert.deepEqual(filterMotionReviewCatalog(catalog, category), catalog.filter(row => classifyReviewMotion(row.name) === category));
  }
  const recommended = filterMotionReviewCatalog(catalog, 'recommended');
  assert.ok(recommended.length <= 24);
  for (const category of ['life', 'move', 'combat', 'reaction']) assert.ok(recommended.some(row => row.category === category));
});

test('all admitted motions actually sample on every current KayKit target', () => {
  assert.equal(baselineWarnings.length, 0);
  for (const row of catalog) {
    const evidence = quality.find(item => item.id === row.id);
    assert.ok(evidence?.valid, `${row.name} failed actual rig validation`);
    assert.equal(evidence.models.length, manifest.qa.targetModels);
    for (const model of evidence.models) { assert.ok(model.samples > 1); assert.equal(model.valid, true); assert.deepEqual(model.failures, []); }
  }
  assert.ok(manifest.summary.added > manifest.summary.baseline, 'This expansion must remain substantial, not a few aliases');
});

test('every original embedded clip, including non-counted variants, remains selectable', () => {
  const originals = registry.legacy.filter(row => row.sourceId === 'kaykit-embedded');
  assert.deepEqual(manifest.legacy.map(row => [row.index, row.name, row.duration]), originals.map(row => [row.source.clipIndex, row.name, row.duration]));
  for (const row of registry.legacy) assert.ok(manifest.legacy.some(clip => clip.name === row.name));
});

test('viewer and workshop do not hardcode motion counts or remove the playback controls', async () => {
  const [viewer, workshop, html, entrypoint] = await Promise.all([
    readFile(new URL('../src/review-motion.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/review-motion-workshop.js', import.meta.url), 'utf8'),
    readFile(new URL('../review-motion.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/motion-review-entrypoint.js', import.meta.url), 'utf8')
  ]);
  for (const text of [viewer, workshop, html]) assert.doesNotMatch(text, /MOTION CLIPS\s+\d+/);
  assert.match(viewer, /motionCountLabel\(catalog\)/); assert.match(workshop, /motionCountLabel\(manifest.records\)/);
  assert.match(entrypoint, /review-motion-workshop/);
  assert.match(viewer, /filterMotionReviewCatalog\(catalog, filter\)/);
  for (const id of ['motion-play', 'motion-restart', 'motion-speed', 'motion-loop', 'motion-time', 'motion-prev-frame', 'motion-next-frame', 'motion-model-grid']) assert.ok(html.includes(`id="${id}"`));
  assert.match(workshop, /review-motion\.html\?embedded=1/);
});
