import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateCatalog, sourceFile, readLimited, sha256 } from './import-bgm150.mjs';

/** Streaming, interleaved f32le analysis. No decoded full-track cache is retained. */
export function pcmMeter({ sampleRate, channels, loopStart = null, loopEnd = null, maxFrames = sampleRate * 601 }) {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || ![1, 2].includes(channels)) throw new Error('Invalid PCM format');
  const startFrame = loopStart === null ? null : Math.round(loopStart * sampleRate);
  const endFrame = loopEnd === null ? null : Math.round(loopEnd * sampleRate) - 1;
  const previous = Array(channels).fill(null), beforePrevious = Array(channels).fill(null);
  const start = Array(channels).fill(null), end = Array(channels).fill(null);
  let carry = Buffer.alloc(0), count = 0, sum = 0, squares = 0;
  let peak = 0, maxStep = 0, clipped = 0, nonFinite = 0, impulseCandidates = 0;
  return {
    push(input) {
      const bytes = carry.length ? Buffer.concat([carry, input]) : input;
      const length = bytes.length - bytes.length % 4;
      for (let i = 0; i < length; i += 4) {
        const value = bytes.readFloatLE(i), channel = count % channels, frame = Math.floor(count / channels);
        if (frame >= maxFrames) throw new Error('Decoded audio exceeds the declared duration budget');
        count++;
        if (!Number.isFinite(value)) { nonFinite++; continue; }
        const abs = Math.abs(value);
        if (abs >= 1) clipped++;
        peak = Math.max(peak, abs); sum += value; squares += value * value;
        if (previous[channel] !== null) maxStep = Math.max(maxStep, Math.abs(value - previous[channel]));
        // A conservative review heuristic, NOT a declaration that music is noise-free.
        const a = beforePrevious[channel], b = previous[channel];
        if (a !== null && b !== null && (b - a) * (value - b) < 0 &&
            Math.min(Math.abs(b - a), Math.abs(value - b)) > 0.25 &&
            Math.abs(b) > 8 * Math.max(Math.abs(a), Math.abs(value), 0.001)) impulseCandidates++;
        beforePrevious[channel] = b; previous[channel] = value;
        if (frame === startFrame) start[channel] = value;
        if (frame === endFrame) end[channel] = value;
      }
      carry = Buffer.from(bytes.subarray(length));
    },
    finish() {
      if (carry.length || count % channels) throw new Error('Truncated PCM frame');
      if (!count) throw new Error('No decoded PCM samples');
      const valid = count - nonFinite, rms = valid ? Math.sqrt(squares / valid) : 0;
      const captured = start.every(v => v !== null) && end.every(v => v !== null);
      return {
        frames: count / channels, duration: count / channels / sampleRate,
        sampleRate, channels, samplePeak: peak, samplePeakDbfs: peak > 0 ? 20 * Math.log10(peak) : null,
        rms, dcMean: valid ? sum / valid : null, clippedSamples: clipped, nonFiniteSamples: nonFinite,
        maxAdjacentStep: maxStep, isolatedImpulseCandidates: impulseCandidates,
        loopBoundaryCaptured: startFrame === null ? null : captured,
        loopBoundaryStep: captured ? Math.max(...start.map((value, i) => Math.abs(value - end[i]))) : null,
      };
    },
  };
}

export function classifyTrack(track, metrics) {
  const failures = [], warnings = [];
  if (metrics.nonFiniteSamples) failures.push('non-finite PCM');
  if (metrics.clippedSamples) failures.push('full-scale clipping');
  if (metrics.rms < 0.000001) failures.push('effectively silent output');
  if (Math.abs(metrics.duration - track.duration) > 0.1) failures.push('decoded duration differs by more than 100 ms');
  if (track.loop && !metrics.loopBoundaryCaptured) failures.push('loop points outside decoded frames');
  if (metrics.isolatedImpulseCandidates) warnings.push('isolated-impulse candidates require listening review');
  if (track.loop && metrics.loopBoundaryStep > 0.02) warnings.push('loop sample step exceeds review threshold 0.02');
  return { failures, warnings, structuralPass: failures.length === 0 };
}

export async function decodeAndMeasure(path, track, { ffmpeg = 'ffmpeg', ffprobe = 'ffprobe' } = {}) {
  const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'a',
    '-show_entries', 'stream=codec_name,sample_rate,channels', '-of', 'json', path],
  { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 }));
  const stream = probe.streams?.[0];
  if (probe.streams?.length !== 1 || stream.codec_name !== 'mp3' ||
      Number(stream.sample_rate) !== track.sampleRate || stream.channels !== track.channels) {
    throw new Error(`${track.id}: source codec/sample rate/channels differ from catalog`);
  }
  const meter = pcmMeter({ sampleRate: track.sampleRate, channels: track.channels,
    loopStart: track.loop ? track.loopStart : null, loopEnd: track.loop ? track.loopEnd : null,
    maxFrames: Math.ceil((track.duration + 1) * track.sampleRate) });
  await new Promise((accept, reject) => {
    const child = spawn(ffmpeg, ['-v', 'error', '-nostdin', '-xerror', '-err_detect', 'explode',
      '-i', path, '-map', '0:a:0', '-vn', '-sn', '-dn', '-c:a', 'pcm_f32le', '-f', 'f32le', 'pipe:1'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '', failure = null;
    const timer = setTimeout(() => { failure = new Error('Audio decode timed out'); child.kill('SIGKILL'); }, 120000);
    child.stdout.on('data', bytes => {
      if (failure) return;
      try { meter.push(bytes); } catch (error) { failure = error; child.kill('SIGKILL'); }
    });
    child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-8192); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0 || stderr.trim()) reject(new Error(`Decoder error (${code}): ${stderr}`));
      else accept();
    });
  });
  return meter.finish();
}

export async function auditBgm150(root, options = {}) {
  root = resolve(root);
  const catalog = JSON.parse(readLimited(sourceFile(root, 'catalog.json'), 4 * 1024 * 1024));
  validateCatalog(catalog);
  const results = [];
  for (const track of catalog.tracks) {
    try {
      const path = sourceFile(root, track.previewFile);
      if (sha256(readLimited(path, 32 * 1024 * 1024)) !== track.previewSha256) throw new Error('Source SHA-256 mismatch');
      const metrics = await decodeAndMeasure(path, track, options);
      results.push({ id: track.id, sourceSha256: track.previewSha256, ...metrics, ...classifyTrack(track, metrics) });
    } catch (error) { results.push({ id: track.id, structuralPass: false, failures: [error.message], warnings: [] }); }
  }
  return {
    schemaVersion: 1, collectionId: catalog.collectionId, catalogSha256: sha256(readFileSync(resolve(root, 'catalog.json'))),
    tracksExamined: results.length, structuralPassCount: results.filter(item => item.structuralPass).length,
    warningTrackCount: results.filter(item => item.warnings.length).length,
    ffmpegVersion: execFileSync(options.ffmpeg || 'ffmpeg', ['-version'], { encoding: 'utf8', timeout: 30000 }).split('\n')[0],
    scope: 'MP3 full decode, sample peak, PCM finiteness, silence, duration and declared loop endpoints only',
    exclusions: ['human listening', 'loudness / oversampled true peak', 'all perceptual noise',
      'browser loop scheduling / UI / HTTP', 'lossless masters and Ogg', 'Pixel Fold / Bluetooth / device performance', 'license clearance'],
    commercialClearance: false, perceptualNoiseClearance: 'not-determined', readyForReview: false,
    results,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { root: { type: 'string' }, report: { type: 'string' } } });
    if (!values.root || !values.report) throw new Error('Use --root IMPORTED_SOURCE --report NEW_JSON_FILE');
    const report = await auditBgm150(values.root);
    writeFileSync(values.report, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    console.log(`${report.structuralPassCount}/${report.tracksExamined} structural passes; ${report.warningTrackCount} listening-review warnings`);
    if (report.structuralPassCount !== 150 || report.warningTrackCount) process.exitCode = 1;
  } catch (error) { console.error(`BGM audit failed: ${error.message}`); process.exitCode = 1; }
}
