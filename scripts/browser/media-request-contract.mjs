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
 * A browser may cancel a same-origin model/motion fetch while an intentional
 * lifecycle operation (reload, iframe removal, runtime stop) tears its consumer
 * down. Keep this separate from ordinary request handling: callers must opt in
 * for the exact teardown window and the server must already have answered 200/206.
 * Missing assets, transport failures, cross-origin requests and ordinary model
 * aborts therefore remain hard failures.
 */
export function isVerifiedLifecycleAssetAbort(record, pageOrigin, lifecycleTeardown = false) {
  if (!lifecycleTeardown || !record || record.method !== 'GET' || record.resourceType !== 'fetch' ||
      record.errorText !== 'net::ERR_ABORTED' || ![200, 206].includes(record.status) ||
      typeof record.contentType !== 'string' ||
      !/^(?:model\/gltf-binary|application\/octet-stream)(?:;|$)/i.test(record.contentType) ||
      typeof record.url !== 'string' || !/\.(?:glb|vrm|vrma)(?:$|[?#])/i.test(record.url)) return false;
  try {
    const url = new URL(record.url);
    return url.origin === pageOrigin;
  } catch { return false; }
}

/** Snapshot before asserting, so unexpected failures remain in the artifact. */
export async function describeFailedRequest(request) {
  const response = await request.response();
  return { url: request.url(), method: request.method(), resourceType: request.resourceType(),
    errorText: request.failure()?.errorText ?? 'unknown', status: response?.status() ?? null,
    contentType: response?.headers()['content-type'] ?? null };
}
