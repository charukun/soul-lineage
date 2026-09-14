import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/** Only a successfully played, same-origin local audio range may be aborted by
 * the media demuxer. HTTP failures, model blobs and unproven audio still fail.
 */
export function isVerifiedAudioRangeAbort(record, playedSources, pageOrigin) {
  if (!record || record.method !== 'GET' || record.resourceType !== 'media' ||
      record.errorText !== 'net::ERR_ABORTED' || record.status !== 206 ||
      typeof record.contentType !== 'string' || !/^audio\//i.test(record.contentType) ||
      !(playedSources instanceof Set) || !playedSources.has(record.url)) return false;
  try {
    const url = new URL(record.url);
    return url.protocol === 'blob:' && url.origin !== 'null' && url.origin === pageOrigin;
  } catch { return false; }
}

/**
 * Some loaders intentionally abort an optional model/motion consumer after the
 * server has successfully answered it. That is only non-fatal when the request
 * is a successful same-origin model fetch AND the exact path exists as a
 * non-empty file in the trusted snapshot being verified. A URL/status alone is
 * never enough, so missing assets and real transport/HTTP failures still fail.
 */
export function isVerifiedSnapshotAssetAbort(record, pageOrigin, siteRoot, siteMount = '/soul-lineage/') {
  if (!record || record.method !== 'GET' || record.resourceType !== 'fetch' ||
      record.errorText !== 'net::ERR_ABORTED' || ![200, 206].includes(record.status) ||
      typeof record.contentType !== 'string' ||
      !/^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/i.test(record.contentType) ||
      typeof record.url !== 'string' || typeof siteRoot !== 'string' || !siteRoot ||
      typeof siteMount !== 'string' || !siteMount) return false;
  try {
    const url = new URL(record.url);
    if (url.origin !== pageOrigin || !/\.(?:glb|vrm|vrma)$/i.test(url.pathname)) return false;
    const mount = siteMount.endsWith('/') ? siteMount : `${siteMount}/`;
    if (!url.pathname.startsWith(mount)) return false;
    const root = resolve(siteRoot);
    const target = resolve(root, decodeURIComponent(url.pathname.slice(mount.length)).replace(/^\/+/, ''));
    const rel = relative(root, target);
    if (!rel || rel.startsWith('..') || isAbsolute(rel) || !existsSync(target)) return false;
    return statSync(target).isFile() && statSync(target).size > 0;
  } catch { return false; }
}

/**
 * Legacy explicit teardown classification is retained for diagnostics, but
 * snapshot verification is preferred because requestfailed can arrive after a
 * teardown callback has completed.
 */
export function isVerifiedLifecycleAssetAbort(record, pageOrigin, lifecycleTeardown = false) {
  if (!lifecycleTeardown || !record || record.method !== 'GET' || record.resourceType !== 'fetch' ||
      record.errorText !== 'net::ERR_ABORTED' || ![200, 206].includes(record.status) ||
      typeof record.contentType !== 'string' ||
      !/^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/i.test(record.contentType) ||
      typeof record.url !== 'string' || !/\.(?:glb|vrm|vrma)(?:$|[?#])/i.test(record.url)) return false;
  try { return new URL(record.url).origin === pageOrigin; } catch { return false; }
}

/** Snapshot before asserting, so unexpected failures remain in the artifact. */
export async function describeFailedRequest(request) {
  const response = await request.response();
  return { url: request.url(), method: request.method(), resourceType: request.resourceType(),
    errorText: request.failure()?.errorText ?? 'unknown', status: response?.status() ?? null,
    contentType: response?.headers()['content-type'] ?? null };
}
