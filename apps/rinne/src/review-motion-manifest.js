import { MOTION_LIBRARY_MANIFEST_URL } from './review-motion-sources.js';
import { countSourceMotions, safeMotionPath, sourceMotionIdentity } from './review-motion-identity.js';

export function motionCountLabel(records) { return `MOTION CLIPS ${countSourceMotions(records)}`; }
export function validateMotionManifest(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.records) || !manifest.records.length || !Array.isArray(manifest.sources)) {
    throw new Error('Invalid motion source manifest');
  }
  const ids = new Set(), sources = new Map(manifest.sources.map(source => [source.id, source]));
  for (const row of manifest.records) {
    if (ids.has(row.id)) throw new Error('Duplicate motion catalog ID');
    ids.add(row.id);
    const source = sources.get(row.sourceId), provenance = row.source;
    if (!source || !safeMotionPath(row.url) || row.url !== source.url || !provenance?.license || !provenance?.author
      || !/^[a-f0-9]{40}$/.test(provenance.gitBlobSha || '') || !/^[a-f0-9]{64}$/.test(provenance.sha256 || '')
      || source.repository !== provenance.repository || source.revision !== provenance.revision || source.path !== provenance.path
      || row.sourceIdentity !== sourceMotionIdentity(row) || !(row.duration > 0)) throw new Error(`Invalid motion provenance: ${row.id}`);
  }
  const count = countSourceMotions(manifest.records);
  if (count !== manifest.records.length || count !== manifest.summary?.total) throw new Error('Motion count/source registry mismatch');
  return manifest;
}
let pending;
export function loadMotionManifest() {
  pending ||= fetch(new URL(MOTION_LIBRARY_MANIFEST_URL, location.href), { signal: AbortSignal.timeout(30000) })
    .then(response => { if (!response.ok) throw new Error(`Motion catalog HTTP ${response.status}`); return response.json(); })
    .then(validateMotionManifest).catch(error => { pending = null; throw error; });
  return pending;
}
