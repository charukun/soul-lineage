import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COLLECTION_ID, importBgm150, readStudioCatalog, sha256, sourceFile, validateCatalog } from '../tools/import-bgm150.mjs';
import { classifyTrack, pcmMeter } from '../tools/audit-bgm150.mjs';

// Synthetic metadata/bytes for tool tests ONLY. These are NOT the user's music.
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'soul-bgm-fixture-')), root = join(dir, 'source');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(root, 'audio'), { recursive: true }); mkdirSync(join(root, 'midi'));
  const catalog = { schemaVersion: 2, collectionId: COLLECTION_ID, repository: 'charukun/soul-lineage',
    productionStatus: 'audition', commercialClearance: false, totalDuration: 150, tracks: [] };
  for (const [game, prefix, count] of [['rinne', 'r', 48], ['village', 'v', 48], ['demon', 'd', 48], ['fixture-common', 'c', 6]]) {
    for (let n = 1; n <= count; n++) {
      const id = prefix + String(n).padStart(2, '0');
      const previewFile = `audio/${id}.mp3`, midiFile = `midi/${id}.mid`;
      const preview = Buffer.from(`NOT AUDIO: ${id}`), midi = Buffer.from(`NOT MIDI: ${id}`);
      writeFileSync(join(root, previewFile), preview); writeFileSync(join(root, midiFile), midi);
      catalog.tracks.push({ id, title: `TEST ONLY ${id}`, game, previewFile, midiFile,
        previewSha256: sha256(preview), midiSha256: sha256(midi), duration: 1, loop: true, loopStart: 0, loopEnd: 1,
        sampleRate: 8000, channels: 2, productionStatus: 'audition', commercialClearance: false,
        licenseStatus: 'review-required', availableInGames: ['rinne', 'village', 'demon'] });
    }
  }
  const html = `<html><script id="catalogData" type="application/json">${JSON.stringify(catalog)}</script></html>`;
  writeFileSync(join(root, 'studio.html'), html);
  writeFileSync(join(root, 'PROVENANCE.md'), 'Synthetic fixture only; not a real music license.');
  return { root, dir, html, catalog, options: { root, studio: 'studio.html', output: join(dir, 'imported'), evidence: ['PROVENANCE.md'] } };
}

function pcm(values) {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeFloatLE(value, index * 4));
  return bytes;
}

test('imports 150 original-bytes fixtures, preserves HTML and uncleared status', t => {
  const f = fixture(t), result = importBgm150(f.options);
  assert.equal(result.tracks, 150); assert.equal(result.files.length, 303);
  assert.deepEqual(result.counts, { rinne: 48, village: 48, demon: 48, common: 6 });
  assert.equal(result.readyForReview, false); assert.equal(result.commercialClearance, false);
  assert.equal(result.audioAudit, 'not-run'); assert.equal(result.hostedUiVerification, 'not-run');
  assert.equal(readFileSync(join(f.options.output, 'original-studio.html'), 'utf8'), f.html);
  assert.deepEqual(JSON.parse(readFileSync(join(f.options.output, 'catalog.json'))), f.catalog);
  for (const file of result.files) assert.equal(sha256(readFileSync(join(f.options.output, file.path))), file.sha256);
});

test('late checksum failure leaves no incomplete output or staging folder', t => {
  const f = fixture(t); writeFileSync(join(f.root, 'audio/c06.mp3'), 'tampered');
  assert.throws(() => importBgm150(f.options), /SHA-256 mismatch/);
  assert.equal(existsSync(f.options.output), false);
  assert.deepEqual(readdirSync(f.dir), ['source']);
});

test('missing audio cannot be replaced by a placeholder', t => {
  const f = fixture(t); rmSync(join(f.root, 'audio/c06.mp3'));
  assert.throws(() => importBgm150(f.options), /ENOENT/); assert.equal(existsSync(f.options.output), false);
});

test('missing MIDI is not silently treated as verified', t => {
  const f = fixture(t); rmSync(join(f.root, 'midi/r01.mid'));
  assert.throws(() => importBgm150(f.options), /ENOENT/);
});

test('refuses symlink assets even when their hash would match', t => {
  const f = fixture(t), path = join(f.root, 'audio/r01.mp3');
  const bytes = readFileSync(path); rmSync(path); writeFileSync(join(f.dir, 'outside.mp3'), bytes);
  symlinkSync(join(f.dir, 'outside.mp3'), path);
  assert.throws(() => importBgm150(f.options), /Symlink rejected/);
});

test('refuses traversal and encoded or absolute paths', t => {
  const f = fixture(t);
  for (const path of ['../outside', '/tmp/test', 'audio//r01.mp3', 'audio/./r01.mp3', 'audio/%2e%2e/test', 'audio\\r01.mp3']) {
    assert.throws(() => sourceFile(f.root, path));
  }
});

test('never overwrites an existing destination', t => {
  const f = fixture(t); mkdirSync(f.options.output); writeFileSync(join(f.options.output, 'keep.txt'), 'keep');
  assert.throws(() => importBgm150(f.options), /already exists/);
  assert.equal(readFileSync(join(f.options.output, 'keep.txt'), 'utf8'), 'keep');
});

test('refuses importing into source tree and absent evidence', t => {
  const f = fixture(t);
  assert.throws(() => importBgm150({ ...f.options, output: join(f.root, 'out') }), /outside/);
  assert.throws(() => importBgm150({ ...f.options, evidence: [] }), /evidence/);
});

test('refuses ambiguous evidence basenames', t => {
  const f = fixture(t); mkdirSync(join(f.root, 'other')); writeFileSync(join(f.root, 'other/PROVENANCE.md'), 'other');
  assert.throws(() => importBgm150({ ...f.options, evidence: ['PROVENANCE.md', 'other/PROVENANCE.md'] }), /Ambiguous/);
});

test('requires an unambiguous actual catalogData script', t => {
  const f = fixture(t); assert.deepEqual(readStudioCatalog(f.html), f.catalog);
  for (const html of [f.html + f.html, '<script id="catalogData">{</script>', f.html.replace('id="catalogData"', 'data-id="catalogData"')]) {
    assert.throws(() => readStudioCatalog(html));
  }
});

for (const [name, change] of [
  ['old collection', c => { c.collectionId = 'old-30'; }],
  ['incomplete catalog', c => { c.tracks.pop(); }],
  ['duplicate ID', c => { c.tracks[1].id = c.tracks[0].id; }],
  ['duplicate MP3 digest', c => { c.tracks[1].previewSha256 = c.tracks[0].previewSha256; }],
  ['changed game balance', c => { c.tracks[0].game = 'demon'; }],
  ['missing game availability', c => { c.tracks[0].availableInGames = ['rinne']; }],
  ['cleared collection license', c => { c.commercialClearance = true; }],
  ['cleared track license', c => { c.tracks[0].commercialClearance = true; }],
  ['missing checksum', c => { delete c.tracks[0].previewSha256; }],
  ['duplicate path', c => { c.tracks[1].previewFile = c.tracks[0].previewFile; }],
  ['unsafe catalog path', c => { c.tracks[0].previewFile = '../r01.mp3'; }],
  ['invalid loop points', c => { c.tracks[0].loopEnd = 2; }],
  ['missing loop policy', c => { delete c.tracks[0].loop; }],
  ['invalid sample format', c => { c.tracks[0].channels = 0; }],
  ['unbounded duration', c => { c.tracks[0].duration = 601; }],
  ['false total duration', c => { c.totalDuration++; }],
]) test(`catalog rejects ${name}`, t => { const f = fixture(t); change(f.catalog); assert.throws(() => validateCatalog(f.catalog)); });

test('PCM analysis is invariant to partial sample/chunk boundaries', () => {
  const bytes = pcm([0.1, -0.1, 0.2, -0.2, 0.1, -0.1, 0, 0]);
  const spec = { sampleRate: 8000, channels: 2, loopStart: 0, loopEnd: 4 / 8000 };
  const single = pcmMeter(spec), chunked = pcmMeter(spec); single.push(bytes);
  for (let i = 0; i < bytes.length; i += 3) chunked.push(bytes.subarray(i, i + 3));
  assert.deepEqual(chunked.finish(), single.finish());
  assert.equal(single.finish().frames, 4); assert.equal(single.finish().loopBoundaryCaptured, true);
});

test('PCM rejects non-finite samples, clipping, silence and missing loop endpoints', () => {
  const meter = pcmMeter({ sampleRate: 8000, channels: 1, loopStart: 0, loopEnd: 1 });
  meter.push(pcm([0, NaN, Infinity, 1, -1, 0])); const stats = meter.finish();
  assert.equal(stats.nonFiniteSamples, 2); assert.equal(stats.clippedSamples, 2);
  assert.equal(classifyTrack({ duration: 1, loop: true }, stats).structuralPass, false);
  const silent = pcmMeter({ sampleRate: 8000, channels: 1 }); silent.push(pcm([0, 0]));
  assert.ok(classifyTrack({ duration: 2 / 8000, loop: false }, silent.finish()).failures.includes('effectively silent output'));
});

test('impulse and loop thresholds produce review warnings, not noise-free claims', () => {
  const meter = pcmMeter({ sampleRate: 8000, channels: 1, loopStart: 0, loopEnd: 3 / 8000 });
  meter.push(pcm([0, 0.8, 0.1])); const stats = meter.finish();
  const result = classifyTrack({ duration: 3 / 8000, loop: true }, stats);
  assert.equal(stats.isolatedImpulseCandidates, 0); // ratio is strict, exact 8x is not accepted
  assert.ok(result.warnings.some(s => s.includes('loop sample step')));
  const impulse = pcmMeter({ sampleRate: 8000, channels: 1 }); impulse.push(pcm([0, 0.8, 0]));
  assert.equal(impulse.finish().isolatedImpulseCandidates, 1);
});

test('bounded PCM decoder rejects truncated and oversized output', () => {
  const partial = pcmMeter({ sampleRate: 8000, channels: 1 }); partial.push(Buffer.from([1]));
  assert.throws(() => partial.finish(), /Truncated/);
  const oversized = pcmMeter({ sampleRate: 8000, channels: 1, maxFrames: 1 });
  assert.throws(() => oversized.push(pcm([0, 0])), /exceeds/);
  assert.throws(() => pcmMeter({ sampleRate: 0, channels: 1 }), /Invalid/);
});
