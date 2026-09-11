import { constants, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, closeSync, fstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const COLLECTION_ID = 'rinne-three-worlds-150-v2';
const GAMES = ['rinne', 'village', 'demon'];
const SHA = /^[a-f0-9]{64}$/;
const MiB = 1024 * 1024;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const number = value => typeof value === 'number' && Number.isFinite(value);
const inside = (root, path) => { const rel = relative(root, path); return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)); };

export function sourceFile(root, path) {
  requireValue(typeof path === 'string' && /^[a-zA-Z0-9_./-]+$/.test(path), `Invalid asset path: ${path}`);
  requireValue(!isAbsolute(path) && path.split('/').every(p => p && p !== '.' && p !== '..'), `Unsafe asset path: ${path}`);
  let target = root;
  for (const part of path.split('/')) {
    target = resolve(target, part);
    requireValue(!lstatSync(target).isSymbolicLink(), `Symlink rejected: ${path}`);
  }
  requireValue(inside(realpathSync(root), realpathSync(target)), `Asset escaped root: ${path}`);
  return target;
}

export function readLimited(path, limit) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const info = fstatSync(fd);
    requireValue(info.isFile() && info.size <= limit, `Not a bounded regular file: ${path}`);
    const bytes = readFileSync(fd);
    requireValue(bytes.length <= limit, `File grew beyond limit: ${path}`);
    return bytes;
  } finally { closeSync(fd); }
}

export function readStudioCatalog(html) {
  const matches = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
    .filter(match => /(?:^|\s)id\s*=\s*(["'])catalogData\1/i.test(match[1]));
  requireValue(matches.length === 1, 'Expected exactly one script#catalogData in the original Studio HTML');
  const text = matches[0][2];
  requireValue(Buffer.byteLength(text) <= 4 * MiB, 'Catalog exceeds 4 MiB');
  const catalog = JSON.parse(text);
  validateCatalog(catalog);
  return catalog;
}

export function validateCatalog(catalog) {
  requireValue(catalog?.schemaVersion === 2 && catalog.collectionId === COLLECTION_ID, 'Wrong BGM collection or schema');
  requireValue(catalog.repository === 'charukun/soul-lineage', 'Wrong repository in catalog');
  requireValue(catalog.productionStatus === 'audition' && catalog.commercialClearance === false, 'Preserve audition / uncleared licensing status');
  requireValue(Array.isArray(catalog.tracks) && catalog.tracks.length === 150, 'Expected the original 150 tracks');
  const ids = new Set(), paths = new Set(), hashes = new Set();
  const counts = Object.fromEntries(GAMES.map(game => [game, 0]));
  let common = 0, seconds = 0;
  for (const track of catalog.tracks) {
    const id = track?.id;
    requireValue(typeof id === 'string' && /^[a-z][a-z0-9_-]{1,63}$/.test(id) && !ids.has(id), `Invalid or duplicate track ID: ${id}`);
    ids.add(id);
    requireValue(typeof track.title === 'string' && track.title.trim().length > 0, `${id}: missing title`);
    requireValue(track.productionStatus === 'audition' && track.commercialClearance === false && track.licenseStatus === 'review-required', `${id}: source licensing status changed`);
    requireValue(Array.isArray(track.availableInGames) && GAMES.every(game => track.availableInGames.includes(game)), `${id}: not available to all three games`);
    requireValue(typeof track.game === 'string' && track.game.length > 0, `${id}: missing source game`);
    if (GAMES.includes(track.game)) counts[track.game]++; else common++;
    requireValue(number(track.duration) && track.duration > 0 && track.duration <= 600, `${id}: invalid duration`);
    requireValue(Number.isInteger(track.sampleRate) && track.sampleRate >= 8000 && track.sampleRate <= 192000, `${id}: invalid sample rate`);
    requireValue(Number.isInteger(track.channels) && track.channels >= 1 && track.channels <= 2, `${id}: expected mono or stereo`);
    requireValue(typeof track.loop === 'boolean', `${id}: missing loop policy`);
    if (track.loop) {
      requireValue(number(track.loopStart) && number(track.loopEnd) && track.loopStart >= 0 && track.loopEnd > track.loopStart && track.loopEnd <= track.duration + 1 / track.sampleRate, `${id}: invalid loop range`);
    }
    for (const [field, digest, directory, extension] of [
      ['previewFile', 'previewSha256', 'audio', 'mp3'], ['midiFile', 'midiSha256', 'midi', 'mid'],
    ]) {
      const path = track[field];
      requireValue(typeof path === 'string' && new RegExp(`^${directory}/[a-zA-Z0-9_-]+\\.${extension}$`).test(path), `${id}: unsafe ${field}`);
      requireValue(!paths.has(path.toLowerCase()), `${id}: duplicate asset path`);
      requireValue(typeof track[digest] === 'string' && SHA.test(track[digest]), `${id}: missing ${digest}`);
      paths.add(path.toLowerCase());
    }
    requireValue(!hashes.has(track.previewSha256), `${id}: duplicate MP3 digest`);
    hashes.add(track.previewSha256);
    seconds += track.duration;
  }
  requireValue(GAMES.every(game => counts[game] === 48) && common === 6, 'Expected 48 tracks per game and six common tracks');
  requireValue(number(catalog.totalDuration) && Math.abs(seconds - catalog.totalDuration) <= 0.1, 'Total duration does not match track durations');
  return { tracks: ids.size, counts: { ...counts, common }, duration: seconds };
}

/** Import only materialized original inputs. This never generates audio or deploys a UI. */
export function importBgm150({ root, studio, output, evidence = [] }) {
  root = realpathSync(root);
  requireValue(lstatSync(root).isDirectory(), 'Source root must be a directory');
  output = resolve(output);
  requireValue(!inside(root, output), 'Output must be outside the source directory');
  requireValue(!existsSync(output), 'Output already exists; refusing to overwrite');
  const studioPath = sourceFile(root, studio);
  const studioBytes = readLimited(studioPath, 64 * MiB);
  const catalog = readStudioCatalog(studioBytes.toString('utf8'));
  const summary = validateCatalog(catalog);
  requireValue(evidence.length > 0, 'Provide original license/provenance evidence; metadata alone is not evidence');
  const evidencePaths = evidence.map(path => {
    requireValue(/\.(md|txt|json)$/i.test(path), 'Evidence must be plain-text .md, .txt or .json');
    return { name: path, path: sourceFile(root, path) };
  });
  const evidenceNames = evidencePaths.map(item => basename(item.name).toLowerCase());
  requireValue(new Set(evidenceNames).size === evidenceNames.length, 'Ambiguous evidence filenames');
  mkdirSync(dirname(output), { recursive: true });
  const stage = mkdtempSync(resolve(dirname(output), '.bgm150-import-'));
  const files = [];
  let outputBytes = 0;
  const save = (path, bytes) => {
    outputBytes += bytes.length;
    requireValue(outputBytes <= 512 * MiB, 'Imported source exceeds the 512 MiB budget');
    mkdirSync(dirname(resolve(stage, path)), { recursive: true });
    writeFileSync(resolve(stage, path), bytes, { flag: 'wx' });
    files.push({ path, size: bytes.length, sha256: sha256(bytes) });
  };
  try {
    for (const track of catalog.tracks) {
      for (const [field, digest, limit] of [['previewFile', 'previewSha256', 32 * MiB], ['midiFile', 'midiSha256', 4 * MiB]]) {
        const bytes = readLimited(sourceFile(root, track[field]), limit);
        requireValue(sha256(bytes) === track[digest], `${track.id}: SHA-256 mismatch for ${track[field]}`);
        save(track[field], bytes);
      }
    }
    // Kept verbatim for subsequent source-aware UI integration, not a hosted-ready claim.
    save('original-studio.html', studioBytes);
    save('catalog.json', Buffer.from(`${JSON.stringify(catalog, null, 2)}\n`));
    for (const item of evidencePaths) save(`evidence/${basename(item.name)}`, readLimited(item.path, 4 * MiB));
    const manifest = {
      schemaVersion: 1, collectionId: COLLECTION_ID, phase: 'source-import-only',
      ...summary, originalStudioSha256: sha256(studioBytes),
      commercialClearance: false, readyForReview: false,
      audioAudit: 'not-run', hostedUiVerification: 'not-run',
      files: files.sort((a, b) => a.path.localeCompare(b.path)),
    };
    writeFileSync(resolve(stage, 'source-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    // Do not replace a destination created while importing.
    requireValue(!existsSync(output), 'Output appeared while importing; refusing to overwrite');
    renameSync(stage, output);
    return manifest;
  } catch (error) { rmSync(stage, { recursive: true, force: true }); throw error; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: {
      root: { type: 'string' }, studio: { type: 'string' }, output: { type: 'string' },
      evidence: { type: 'string', multiple: true, default: [] },
    } });
    requireValue(values.root && values.studio && values.output, 'Use --root EXTRACTED_SOURCE --studio RELATIVE_HTML --evidence RELATIVE_LICENSE --output NEW_DIRECTORY');
    console.log(JSON.stringify(importBgm150(values), null, 2));
  } catch (error) { console.error(`BGM import failed: ${error.message}`); process.exitCode = 1; }
}
